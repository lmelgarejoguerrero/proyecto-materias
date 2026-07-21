import assert from "node:assert/strict";

await import("./parser.js");
const { parseCourseLabel, parseMeetings } = globalThis.SgaParser;

assert.deepEqual(parseCourseLabel("71.22 - Sistemas de Inteligencia Artificial (3 Créditos)"), {
  courseId: "71.22",
  courseName: "Sistemas de Inteligencia Artificial",
  credits: 3,
});
assert.deepEqual(parseCourseLabel("72.74 - Visualización de Información"), {
  courseId: "72.74",
  courseName: "Visualización de Información",
  credits: null,
});

const meetings = parseMeetings("Martes (16:00 - 19:00) - Aula ITBA: 401F #----> Sede Distrito Financiero Aula externa: Presencial | Viernes (13:00 - 16:00) - Aula ITBA: 701F #----> Sede Distrito Financiero Aula externa: Presencial |");
assert.equal(meetings.length, 2);
assert.equal(meetings[0].building, "SDF");
assert.equal(meetings[1].day, "FRIDAY");
assert.equal(meetings[1].classroom, "701F");

console.log("SGA parser: pruebas superadas");
