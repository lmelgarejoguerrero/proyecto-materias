export interface SgaAcademicPeriod {
  year: number;
  period: 1 | 2;
  label: string;
}

export interface SgaScheduleMeeting {
  day: string;
  time_from: string;
  time_to: string;
  classroom: string;
  building: string;
  raw?: string;
}

export interface SgaCommission {
  name: string;
  applicants: number | null;
  availableSeats: number | null;
  rawSchedule?: string;
  meetings: SgaScheduleMeeting[];
}

export interface SgaCourse {
  courseId: string;
  courseName: string;
  credits: number | null;
  availability: "available" | "requested";
  commissions: SgaCommission[];
  error?: string | null;
}

export interface SgaScheduleSnapshot {
  schemaVersion: 1;
  source: "sga-itba";
  academicPeriod: SgaAcademicPeriod | null;
  capturedAt: string | null;
  courses: SgaCourse[];
}
