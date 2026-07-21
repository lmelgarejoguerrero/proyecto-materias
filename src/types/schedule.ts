export type AcademicPeriod = 1 | 2;

export interface CeitbaScheduleMeeting {
  day: string;
  classroom: string;
  building: string;
  time_from: string;
  time_to: string;
}

export interface CeitbaCommission {
  name: string;
  schedule: CeitbaScheduleMeeting[];
  applicants?: number | null;
  available_seats?: number | null;
  source?: "ceitba" | "sga";
}

export interface CeitbaSubject {
  subject_id: string;
  name: string;
  credits: number;
  course_start: string;
  course_end: string;
  commissions: CeitbaCommission[];
}

export type CeitbaSubjectsResponse = Record<
  string,
  Record<string, Record<string, CeitbaSubject[]>>
>;

export interface ScheduleCommission {
  id: string;
  name: string;
  label: string;
  meetings: CeitbaScheduleMeeting[];
  applicants?: number | null;
  availableSeats?: number | null;
  source?: "ceitba" | "sga";
}

export interface ScheduleOffering {
  courseId: string;
  courseName: string;
  year: number;
  period: AcademicPeriod;
  courseStart: string;
  courseEnd: string;
  commissions: ScheduleCommission[];
}

export interface PlannerScheduleEvent extends CeitbaScheduleMeeting {
  id: string;
  courseId: string;
  courseName: string;
  commissionId: string;
  commissionName: string;
  isReference: boolean;
  sourceYear: number;
  sourcePeriod: AcademicPeriod;
}

export interface ScheduleConflict {
  eventIds: [string, string];
  courseIds: [string, string];
  day: string;
  from: string;
  to: string;
}
