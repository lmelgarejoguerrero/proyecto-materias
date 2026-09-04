import type {
  AcademicPeriod,
  CeitbaScheduleMeeting,
  CeitbaSubjectsResponse,
  PlannerScheduleEvent,
  ScheduleCommission,
  ScheduleConflict,
  ScheduleOffering,
} from "@/types/schedule";

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Lun",
  TUESDAY: "Mar",
  WEDNESDAY: "Mié",
  THURSDAY: "Jue",
  FRIDAY: "Vie",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};

function academicPeriod(date: string): AcademicPeriod {
  const month = Number(date.slice(5, 7));
  return month < 7 ? 1 : 2;
}

function commissionSignature(name: string, meetings: CeitbaScheduleMeeting[]): string {
  const schedule = meetings
    .map((meeting) =>
      [meeting.day, meeting.time_from, meeting.time_to, meeting.building, meeting.classroom].join("|"),
    )
    .sort()
    .join(";");
  return `${name}|${schedule}`;
}

function commissionKey(name: string): string {
  return name.trim().toLocaleLowerCase("es");
}

function commissionLabel(
  name: string,
  meetings: CeitbaScheduleMeeting[],
  availableSeats?: number | null,
): string {
  const buildings = [...new Set(meetings.map((meeting) => meeting.building).filter(Boolean))];
  const location = buildings.length > 0 ? ` · ${buildings.join("/")}` : "";
  const seats = availableSeats == null
    ? ""
    : availableSeats === 0
      ? " · sin cupo"
      : ` · ${availableSeats} cupo${availableSeats === 1 ? "" : "s"}`;
  return `Comisión ${name}${location}${seats}`;
}

export function normalizeScheduleData(data: CeitbaSubjectsResponse): ScheduleOffering[] {
  const offerings = new Map<string, ScheduleOffering>();

  for (const section of Object.values(data)) {
    if (!section || typeof section !== "object" || Array.isArray(section)) continue;
    for (const yearGroup of Object.values(section)) {
      if (!yearGroup || typeof yearGroup !== "object" || Array.isArray(yearGroup)) continue;
      for (const subjects of Object.values(yearGroup)) {
        if (!Array.isArray(subjects)) continue;
        for (const subject of subjects) {
          if (!subject || typeof subject.subject_id !== "string" || typeof subject.course_start !== "string") continue;
          const year = Number(subject.course_start.slice(0, 4));
          const month = Number(subject.course_start.slice(5, 7));
          if (!Number.isInteger(year) || year < 1900 || !Number.isInteger(month) || month < 1 || month > 12) continue;
          const period = academicPeriod(subject.course_start);
          const key = `${subject.subject_id}:${year}:${period}`;
          const current = offerings.get(key) ?? {
            courseId: subject.subject_id,
            courseName: subject.name,
            year,
            period,
            courseStart: subject.course_start,
            courseEnd: subject.course_end,
            commissions: [],
          };
          const commissionIndexes = new Map(
            current.commissions.map((commission, index) => [commissionKey(commission.name), index]),
          );

          for (const commission of Array.isArray(subject.commissions) ? subject.commissions : []) {
            if (!commission || typeof commission.name !== "string" || !commission.name.trim()) continue;
            const meetings = (Array.isArray(commission.schedule) ? commission.schedule : []).filter(isValidScheduleMeeting);
            if (meetings.length === 0) continue;
            const id = commissionSignature(commission.name, meetings);
            const normalizedCommission = {
              id,
              name: commission.name,
              label: commissionLabel(commission.name, meetings, commission.available_seats),
              meetings,
              applicants: commission.applicants,
              availableSeats: commission.available_seats,
              source: commission.source,
            };
            const nameKey = commissionKey(commission.name);
            const existingIndex = commissionIndexes.get(nameKey);

            // The CEITBA response can repeat the same commission with an older room.
            // Entries are chronological, so the last publication for each name wins.
            if (existingIndex === undefined) {
              commissionIndexes.set(nameKey, current.commissions.length);
              current.commissions.push(normalizedCommission);
            } else {
              current.commissions[existingIndex] = normalizedCommission;
            }
          }

          offerings.set(key, current);
        }
      }
    }
  }

  return [...offerings.values()].map((offering) => ({
    ...offering,
    commissions: offering.commissions.sort((left, right) =>
      left.name.localeCompare(right.name, "es", { numeric: true }),
    ),
  }));
}

export function findOffering(
  offerings: ScheduleOffering[],
  courseId: string,
  year: number,
  period: AcademicPeriod,
): ScheduleOffering | undefined {
  return offerings.find(
    (offering) =>
      offering.courseId === courseId && offering.year === year && offering.period === period,
  );
}

export function findReferenceOffering(
  offerings: ScheduleOffering[],
  courseId: string,
  year: number,
  period: AcademicPeriod,
): ScheduleOffering | undefined {
  return offerings.find(
    (offering) =>
      offering.courseId === courseId &&
      offering.year === year &&
      offering.period !== period &&
      offering.commissions.length > 0,
  );
}

export function formatMeeting(meeting: CeitbaScheduleMeeting): string {
  const day = DAY_LABELS[meeting.day] ?? meeting.day;
  const from = meeting.time_from.slice(0, 5);
  const to = meeting.time_to.slice(0, 5);
  const location = meeting.classroom || meeting.building;
  return `${day} ${from}–${to}${location ? ` · ${location}` : ""}`;
}

export function formatCommission(commission: ScheduleCommission): string {
  return `${commission.label} — ${commission.meetings.map(formatMeeting).join(" / ")}`;
}

export function timeToMinutes(time: string): number {
  if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(time)) return Number.NaN;
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  if (hours > 24 || minutes > 59 || seconds > 59 || (hours === 24 && (minutes !== 0 || seconds !== 0))) return Number.NaN;
  return hours * 60 + minutes;
}

export function isValidScheduleMeeting(meeting: CeitbaScheduleMeeting): boolean {
  return Boolean(meeting) && Object.prototype.hasOwnProperty.call(DAY_LABELS, meeting.day) &&
    Number.isFinite(timeToMinutes(meeting.time_from)) &&
    Number.isFinite(timeToMinutes(meeting.time_to)) &&
    timeToMinutes(meeting.time_from) < timeToMinutes(meeting.time_to);
}

export function isAsynchronousMeeting(meeting: CeitbaScheduleMeeting): boolean {
  const location = `${meeting.classroom} ${meeting.building}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /asincronic|asynchronous/.test(location);
}

export function layoutScheduleEvents(events: PlannerScheduleEvent[]): Map<string, { index: number; count: number }> {
  const layout = new Map<string, { index: number; count: number }>();
  const days = [...new Set(events.map((event) => event.day))];
  for (const day of days) {
    const ordered = events.filter((event) => event.day === day && isValidScheduleMeeting(event))
      .sort((left, right) => timeToMinutes(left.time_from) - timeToMinutes(right.time_from) ||
        timeToMinutes(right.time_to) - timeToMinutes(left.time_to));
    let group: { id: string; index: number }[] = [];
    let ends: number[] = [];
    const flush = () => {
      for (const item of group) layout.set(item.id, { index: item.index, count: ends.length });
      group = [];
      ends = [];
    };
    for (const event of ordered) {
      const start = timeToMinutes(event.time_from);
      if (ends.length > 0 && start >= Math.max(...ends)) flush();
      const freeColumn = ends.findIndex((end) => end <= start);
      const index = freeColumn === -1 ? ends.length : freeColumn;
      ends[index] = timeToMinutes(event.time_to);
      group.push({ id: event.id, index });
    }
    flush();
  }
  return layout;
}

export function detectScheduleConflicts(events: PlannerScheduleEvent[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
    const left = events[leftIndex];
    if (!isValidScheduleMeeting(left) || isAsynchronousMeeting(left)) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex += 1) {
      const right = events[rightIndex];
      if (
        left.courseId === right.courseId ||
        left.day !== right.day ||
        !isValidScheduleMeeting(right) ||
        isAsynchronousMeeting(right)
      ) {
        continue;
      }
      const start = Math.max(timeToMinutes(left.time_from), timeToMinutes(right.time_from));
      const end = Math.min(timeToMinutes(left.time_to), timeToMinutes(right.time_to));
      if (start >= end) continue;
      const from = `${Math.floor(start / 60).toString().padStart(2, "0")}:${(start % 60)
        .toString()
        .padStart(2, "0")}`;
      const to = `${Math.floor(end / 60).toString().padStart(2, "0")}:${(end % 60)
        .toString()
        .padStart(2, "0")}`;
      conflicts.push({
        eventIds: [left.id, right.id],
        courseIds: [left.courseId, right.courseId],
        day: left.day,
        from,
        to,
      });
    }
  }

  return conflicts;
}

export function foroItbaCourseUrl(courseId: string, courseName: string): string {
  const code = courseId.replaceAll(".", "-").toLocaleLowerCase("es");
  const slug = courseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `https://foro-itba.vercel.app/materias/${code}-${slug}`;
}
