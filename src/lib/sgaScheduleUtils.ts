import type { CeitbaCommission, CeitbaSubject, CeitbaSubjectsResponse } from "@/types/schedule";
import type { SgaCourse, SgaScheduleSnapshot } from "@/types/sgaSchedule";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidCourse(value: unknown): boolean {
  if (!isRecord(value) || typeof value.courseId !== "string" || typeof value.courseName !== "string") {
    return false;
  }
  if (value.availability !== "available" && value.availability !== "requested") return false;
  if (!Array.isArray(value.commissions)) return false;

  return value.commissions.every((commission) => {
    if (!isRecord(commission) || typeof commission.name !== "string" || !Array.isArray(commission.meetings)) {
      return false;
    }
    return commission.meetings.every(
      (meeting) =>
        isRecord(meeting) &&
        typeof meeting.day === "string" &&
        typeof meeting.time_from === "string" &&
        typeof meeting.time_to === "string" &&
        typeof meeting.classroom === "string" &&
        typeof meeting.building === "string",
    );
  });
}

export function parseSgaScheduleSnapshot(raw: string | null): SgaScheduleSnapshot | null {
  if (!raw) return null;

  try {
    const snapshot = JSON.parse(raw) as Partial<SgaScheduleSnapshot>;
    const period = snapshot.academicPeriod;
    if (
      snapshot.schemaVersion !== 1 ||
      snapshot.source !== "sga-itba" ||
      !Array.isArray(snapshot.courses) ||
      !snapshot.courses.every(isValidCourse) ||
      !period ||
      !Number.isInteger(period.year) ||
      (period.period !== 1 && period.period !== 2)
    ) {
      return null;
    }
    return snapshot as SgaScheduleSnapshot;
  } catch {
    return null;
  }
}

function courseDates(year: number, period: 1 | 2): { start: string; end: string } {
  return period === 1
    ? { start: `${year}-03-01`, end: `${year}-06-30` }
    : { start: `${year}-07-01`, end: `${year}-12-31` };
}

function subjectPeriod(subject: CeitbaSubject): 1 | 2 {
  return Number(subject.course_start.slice(5, 7)) < 7 ? 1 : 2;
}

function sgaCommissions(course: SgaCourse): CeitbaCommission[] {
  return (course.commissions ?? [])
    .map((commission) => ({
      name: commission.name,
      applicants: commission.applicants,
      available_seats: commission.availableSeats,
      source: "sga" as const,
      schedule: (commission.meetings ?? [])
        .filter((meeting) => meeting.day && meeting.time_from && meeting.time_to)
        .map((meeting) => ({
          day: meeting.day,
          time_from: meeting.time_from,
          time_to: meeting.time_to,
          classroom: meeting.classroom || "",
          building: meeting.building || "",
        })),
    }))
    .filter((commission) => commission.schedule.length > 0);
}

export function mergeSgaScheduleSnapshot(
  base: CeitbaSubjectsResponse,
  snapshot: SgaScheduleSnapshot,
): CeitbaSubjectsResponse {
  const period = snapshot.academicPeriod;
  if (!period || snapshot.courses.length === 0) return base;

  const dates = courseDates(period.year, period.period);
  const imported: CeitbaSubject[] = [];

  for (const course of snapshot.courses) {
    const commissions = sgaCommissions(course);
    if (commissions.length === 0) continue;

    let existing: CeitbaSubject | undefined;
    for (const section of Object.values(base)) {
      for (const yearGroup of Object.values(section)) {
        for (const subjects of Object.values(yearGroup)) {
          existing = subjects.find(
            (subject) =>
              subject.subject_id === course.courseId &&
              Number(subject.course_start.slice(0, 4)) === period.year &&
              subjectPeriod(subject) === period.period,
          );
          if (existing) break;
        }
        if (existing) break;
      }
      if (existing) break;
    }

    if (existing) {
      // The user's current SGA enrollment offer is the freshest source for this term.
      existing.commissions = commissions;
      existing.name = course.courseName || existing.name;
      if (course.credits != null) existing.credits = course.credits;
    } else {
      imported.push({
        subject_id: course.courseId,
        name: course.courseName,
        credits: course.credits ?? 0,
        course_start: dates.start,
        course_end: dates.end,
        commissions,
      });
    }
  }

  if (imported.length > 0) {
    base["SGA importado"] ??= {};
    base["SGA importado"][String(period.year)] ??= {};
    base["SGA importado"][String(period.year)][String(period.period)] = imported;
  }

  return base;
}
