import type { CeitbaCommission, CeitbaSubject, CeitbaSubjectsResponse } from "@/types/schedule";
import type { SgaCourse, SgaScheduleSnapshot } from "@/types/sgaSchedule";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalCount(value: unknown): boolean {
  return value == null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

function isValidCourse(value: unknown): boolean {
  if (!isRecord(value) || typeof value.courseId !== "string" || !value.courseId.trim() ||
    typeof value.courseName !== "string" || !value.courseName.trim() || !optionalCount(value.credits)) {
    return false;
  }
  if (value.availability !== "available" && value.availability !== "requested") return false;
  if (!Array.isArray(value.commissions)) return false;

  return value.commissions.every((commission) => {
    if (!isRecord(commission) || typeof commission.name !== "string" || !commission.name.trim() ||
      !Array.isArray(commission.meetings) || !optionalCount(commission.applicants) || !optionalCount(commission.availableSeats)) {
      return false;
    }
    return commission.meetings.every(
      (meeting) =>
        isRecord(meeting) &&
        typeof meeting.day === "string" &&
        ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].includes(meeting.day) &&
        validTime(meeting.time_from) &&
        validTime(meeting.time_to) &&
        meeting.time_from < meeting.time_to &&
        typeof meeting.classroom === "string" &&
        typeof meeting.building === "string",
    );
  });
}

export function parseSgaScheduleSnapshot(raw: string | null): SgaScheduleSnapshot | null {
  if (!raw) return null;

  try {
    const snapshot = JSON.parse(raw) as Partial<SgaScheduleSnapshot>;
    if (!isRecord(snapshot)) return null;
    const period = snapshot.academicPeriod;
    if (
      snapshot.schemaVersion !== 1 ||
      snapshot.source !== "sga-itba" ||
      !Array.isArray(snapshot.courses) ||
      !snapshot.courses.every(isValidCourse) ||
      !period ||
      !Number.isInteger(period.year) ||
      period.year < 1900 || period.year > 2200 ||
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
  // Work on a copy so cached responses and previous snapshots remain unchanged.
  const merged = structuredClone(base);
  const imported: CeitbaSubject[] = [];

  for (const course of snapshot.courses) {
    const commissions = sgaCommissions(course);
    if (commissions.length === 0) continue;

    let found = false;
    for (const section of Object.values(merged)) {
      for (const yearGroup of Object.values(section)) {
        for (const subjects of Object.values(yearGroup)) {
          for (const existing of subjects.filter(
            (subject) =>
              subject.subject_id === course.courseId &&
              Number(subject.course_start.slice(0, 4)) === period.year &&
              subjectPeriod(subject) === period.period,
          )) {
            // Every duplicate must be updated: normalization keeps the last publication.
            found = true;
            existing.commissions = commissions;
            existing.name = course.courseName || existing.name;
            if (course.credits != null) existing.credits = course.credits;
          }
        }
      }
    }

    if (!found) {
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
    merged["SGA importado"] ??= {};
    merged["SGA importado"][String(period.year)] ??= {};
    const existing = merged["SGA importado"][String(period.year)][String(period.period)] ?? [];
    merged["SGA importado"][String(period.year)][String(period.period)] = [...existing, ...imported];
  }

  return merged;
}
