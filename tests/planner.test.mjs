import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

async function loadSource(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const schedule = await loadSource("../src/lib/scheduleUtils.ts");
const sga = await loadSource("../src/lib/sgaScheduleUtils.ts");
const planner = await loadSource("../src/lib/plannerUtils.ts");
const meeting = (from = "09:00:00", to = "11:00:00", extra = {}) => ({ day: "MONDAY", time_from: from, time_to: to, classroom: "101", building: "SDF", ...extra });
const event = (id, from, to, extra = {}) => ({ ...meeting(from, to), id, courseId: id, courseName: id, commissionId: "A", commissionName: "A", isReference: false, sourceYear: 2026, sourcePeriod: 2, ...extra });
const snapshot = (courses) => ({ schemaVersion: 1, source: "sga-itba", academicPeriod: { year: 2026, period: 2, label: "2° 2026" }, capturedAt: null, courses });
const importedCourse = (id, room = "Nueva") => ({ courseId: id, courseName: id, credits: 3, availability: "available", commissions: [{ name: "A", applicants: null, availableSeats: 2, meetings: [meeting(undefined, undefined, { classroom: room })] }] });
const baseSubject = (id, room) => ({ subject_id: id, name: id, credits: 3, course_start: "2026-08-01", course_end: "2026-12-01", commissions: [{ name: "A", schedule: [meeting(undefined, undefined, { classroom: room })] }] });

test("detects fixed-time virtual conflicts but ignores explicit asynchronous work", () => {
  const left = event("A", "09:00", "11:00");
  const online = event("B", "10:00", "12:00", { building: "Online", classroom: "Zoom" });
  assert.equal(schedule.detectScheduleConflicts([left, online]).length, 1);
  const asynchronous = { ...online, classroom: "Virtual asincrónica ()" };
  assert.deepEqual(schedule.detectScheduleConflicts([left, asynchronous]), []);
});

test("adjacent meetings and different days do not conflict; invalid ranges are skipped", () => {
  const left = event("A", "09:00", "11:00");
  assert.deepEqual(schedule.detectScheduleConflicts([
    left, event("B", "11:00", "12:00"), event("C", "09:00", "11:00", { day: "TUESDAY" }),
    event("D", "bad", "15:00"), event("E", "14:00", "10:00"),
  ]), []);
  assert.equal(schedule.isValidScheduleMeeting(meeting("12:70", "13:00")), false);
  assert.equal(schedule.isValidScheduleMeeting(meeting("12:00:80", "13:00")), false);
  assert.equal(schedule.isValidScheduleMeeting(meeting("12:00", "13:00", { day: "FUNDAY" })), false);
});

test("overlap layout reuses columns for chained events, including meetings of one course", () => {
  const layout = schedule.layoutScheduleEvents([
    event("A", "09:00", "11:00"), event("B", "10:00", "12:00"), event("C", "11:00", "13:00"),
    event("D", "14:00", "15:00"),
  ]);
  assert.equal(layout.get("A").count, 2);
  assert.equal(layout.get("C").index, layout.get("A").index);
  assert.equal(layout.get("D").count, 1);
});

test("SGA overrides every duplicate without modifying the original response", () => {
  const base = { carrera: { "2026": { "2": [baseSubject("A", "Old 1"), baseSubject("A", "Old 2")] } } };
  const original = structuredClone(base);
  const merged = sga.mergeSgaScheduleSnapshot(base, snapshot([importedCourse("A")]));
  assert.deepEqual(base, original);
  assert.equal(schedule.normalizeScheduleData(merged)[0].commissions[0].meetings[0].classroom, "Nueva");
  assert.equal(schedule.normalizeScheduleData(merged)[0].commissions[0].source, "sga");
});

test("a newer partial SGA snapshot keeps courses imported by an older snapshot", () => {
  const initial = sga.mergeSgaScheduleSnapshot({}, snapshot([importedCourse("A")]));
  const updated = sga.mergeSgaScheduleSnapshot(initial, snapshot([importedCourse("B")]));
  assert.deepEqual(schedule.normalizeScheduleData(updated).map((item) => item.courseId).sort(), ["A", "B"]);
  assert.equal(schedule.normalizeScheduleData(initial).length, 1);
});

test("snapshot validation rejects malformed schedule values and negative credits", () => {
  assert.ok(sga.parseSgaScheduleSnapshot(JSON.stringify(snapshot([importedCourse("A")]))));
  for (const invalid of [null, {}, snapshot([{ ...importedCourse("A"), credits: -3 }]), snapshot([{ ...importedCourse("A"), commissions: [{ name: "A", meetings: [meeting("25:00", "26:00")] }] }])]) {
    assert.equal(sga.parseSgaScheduleSnapshot(JSON.stringify(invalid)), null);
  }
});

test("normalization skips malformed publications without losing valid offerings", () => {
  const result = schedule.normalizeScheduleData({ bad: null, career: { year: { subjects: [null, baseSubject("A", "101"), { ...baseSubject("B", "101"), course_start: "invalid" }] } } });
  assert.deepEqual(result.map((item) => item.courseId), ["A"]);
});

const course = (id, prerequisites = [], extra = {}) => ({ id, nombre: id, creditos: 6, cuatrimestre: 1, creditosRequeridos: 0, correlativas: prerequisites, tipoCorrelativa: "cursada", grupo: "obligatoria", ...extra });

test("future planning unlocks prerequisites only after previous terms", () => {
  const courses = [course("A"), course("B", ["A"]), course("C", ["B"])];
  const plan = { first: ["A"], second: ["B"] };
  const slots = ["first", "second", "third"];
  assert.equal(planner.projectPlannerEligibility(courses, {}, plan, slots, "first").B.ready, false);
  assert.equal(planner.projectPlannerEligibility(courses, {}, plan, slots, "second").B.projected, true);
  assert.equal(planner.projectPlannerEligibility(courses, {}, plan, slots, "third").C.projected, true);
});

test("concurrent courses and invalid prerequisites cannot unlock future courses", () => {
  const courses = [course("A"), course("B", ["A"]), course("C", ["B"])];
  const result = planner.projectPlannerEligibility(courses, {}, { first: ["A", "B"] }, ["first", "second"], "second");
  assert.equal(result.C.ready, false);
  assert.deepEqual(result.C.missingPrerequisites, ["B"]);
});

test("final prerequisites require approval and projected credits are not double counted", () => {
  const courses = [course("A"), course("B", ["A"], { tipoCorrelativa: "final" }), course("C", [], { creditosRequeridos: 12 })];
  const actual = planner.projectPlannerEligibility(courses, { A: "regular" }, {}, ["first"], "first");
  assert.equal(actual.B.ready, false);
  const projected = planner.projectPlannerEligibility(courses, { A: "aprobada" }, { first: ["A"] }, ["first", "second"], "second");
  assert.equal(projected.C.missingCredits, 6);
});

test("restoring a plan retains past and distant future terms, active selection and commissions", () => {
  const stored = planner.parsePlannerStorage(JSON.stringify({
    version: 3, slotActivoId: "2025-2", planificador: { "2025-2": ["A"], "2031-1": ["B"] },
    comisiones: { "2025-2": { A: "commission-2025" }, "2031-1": { B: "commission-2031" } },
  }));
  assert.ok(stored);
  const current = ["2026-2", "2027-1", "2027-2", "2028-1", "2028-2", "2029-1"].map((id) => ({ id }));
  const slots = planner.restorePlannerSlots(current, stored);
  assert.deepEqual(slots.map((slot) => slot.id), ["2025-2", "2026-2", "2027-1", "2027-2", "2028-1", "2028-2", "2029-1", "2031-1"]);
  assert.equal(stored.active, "2025-2");
  assert.deepEqual(stored.plan["2025-2"], ["A"]);
  assert.equal(stored.plan["2026-2"], undefined);
  assert.equal(stored.commissions["2025-2"].A, "commission-2025");
});

test("invalid stored plans remain distinguishable from an empty plan", () => {
  assert.deepEqual(planner.parsePlannerStorage(null), { plan: {}, commissions: {} });
  for (const raw of ["", "broken json", "null", "[]", '{"planificador":null}', '{"planificador":{"2026-3":["A"]}}', '{"planificador":{"2026-2":"A"}}']) {
    assert.equal(planner.parsePlannerStorage(raw), null);
  }
  assert.deepEqual(planner.parsePlannerStorage('{"2025-1":["A"]}').plan, { "2025-1": ["A"] });
});

test("saved active or commission-only terms also remain available in chronological order", () => {
  const slots = planner.restorePlannerSlots([{ id: "2026-2" }], {
    active: "2024-1", plan: {}, commissions: { "2025-1": {} },
  });
  assert.deepEqual(slots.map((slot) => slot.id), ["2024-1", "2025-1", "2026-2"]);
  assert.equal(slots[0].label, "1° cuatrimestre de 2024");
});
