import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Uso: npm run import:sga -- /ruta/al/horarios-sga.json");
  process.exit(1);
}

const sourcePath = resolve(inputPath);
const targetPath = resolve("src/data/sgaHorarios.json");
const raw = JSON.parse(await readFile(sourcePath, "utf8"));

if (
  raw?.schemaVersion !== 1 ||
  raw?.source !== "sga-itba" ||
  !raw.academicPeriod ||
  !Number.isInteger(raw.academicPeriod.year) ||
  ![1, 2].includes(raw.academicPeriod.period) ||
  !Array.isArray(raw.courses)
) {
  throw new Error("El archivo no es un snapshot válido de la extensión SGA.");
}

const integerOrNull = (value) => (Number.isInteger(value) ? value : null);
const text = (value) => String(value ?? "").trim();
const courses = raw.courses
  .filter((course) => /^\d{2}\.\d{2}$/.test(text(course.courseId)))
  .map((course) => ({
    courseId: text(course.courseId),
    courseName: text(course.courseName),
    credits: integerOrNull(course.credits),
    availability: course.availability === "requested" ? "requested" : "available",
    commissions: (Array.isArray(course.commissions) ? course.commissions : []).map((commission) => ({
      name: text(commission.name),
      applicants: integerOrNull(commission.applicants),
      availableSeats: integerOrNull(commission.availableSeats),
      rawSchedule: text(commission.rawSchedule),
      meetings: (Array.isArray(commission.meetings) ? commission.meetings : [])
        .filter((meeting) => meeting?.day && meeting?.time_from && meeting?.time_to)
        .map((meeting) => ({
          day: text(meeting.day),
          time_from: text(meeting.time_from),
          time_to: text(meeting.time_to),
          classroom: text(meeting.classroom),
          building: text(meeting.building),
          raw: text(meeting.raw),
        })),
    })),
    error: course.error ? text(course.error) : null,
  }));

const snapshot = {
  schemaVersion: 1,
  source: "sga-itba",
  academicPeriod: {
    year: raw.academicPeriod.year,
    period: raw.academicPeriod.period,
    label: text(raw.academicPeriod.label),
  },
  capturedAt: text(raw.capturedAt) || new Date().toISOString(),
  courses,
};

await writeFile(targetPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

const commissionCount = courses.reduce((total, course) => total + course.commissions.length, 0);
console.log(`Importadas ${courses.length} materias y ${commissionCount} comisiones en ${targetPath}`);
