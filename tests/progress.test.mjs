import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTypeScript } from "./load-typescript.mjs";

const {
  calcularCreditosTitulo,
  calcularDisponibilidad,
  cumpleRequisitos,
  getEstadoPersistido,
  normalizarProgreso,
  parsearProgreso,
  sumarCreditosAprobados,
  validarPlan,
} = loadTypeScript("src/lib/planUtils.ts");
const { crearProgresoStore, PROGRESS_STORAGE_KEY } = loadTypeScript("src/lib/progressStore.ts");
const {
  aplicarBackup,
  BACKUP_STORAGE_KEYS,
  crearBackup,
  MAX_BACKUP_BYTES,
  parsearBackup,
} = loadTypeScript("src/lib/progressBackup.ts");

const materia = (id, overrides = {}) => ({
  id, nombre: id, creditos: 6, creditosRequeridos: 0, correlativas: [],
  tipoCorrelativa: "cursada", grupo: "obligatoria", cuatrimestre: 1,
  ...overrides,
});
const materias = [materia("A"), materia("B"), materia("C", { correlativas: ["A", "B"] })];

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    writes: 0,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { this.writes += 1; values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test("saved progress rejects malformed shapes and inherited properties", () => {
  for (const raw of ["null", "[]", "true", '"aprobada"', "{invalid"]) {
    assert.deepEqual(parsearProgreso(raw), {});
  }
  const value = JSON.parse('{"A":"aprobada","B":"pendiente","C":"unknown","__proto__":"aprobada"}');
  assert.deepEqual(normalizarProgreso(value, new Set(["A", "B", "C"])), { A: "aprobada" });
  assert.equal(getEstadoPersistido({}, "constructor"), "pendiente");
});

test("course requirements honor finals and approved-credit thresholds", () => {
  const course = materia("B", { correlativas: ["A"], creditosRequeridos: 24, tipoCorrelativa: "final" });
  assert.equal(cumpleRequisitos(course, { A: "regular" }, 24), false);
  assert.equal(cumpleRequisitos(course, { A: "aprobada" }, 23), false);
  assert.equal(cumpleRequisitos(course, { A: "aprobada" }, 24), true);
  assert.equal(cumpleRequisitos({ ...course, tipoCorrelativa: "cursada" }, { A: "regular" }, 24), true);
});

test("preview requires every prerequisite and cannot invent approved credits or finals", () => {
  assert.equal(calcularDisponibilidad(materias, { A: "cursando" }).materiasPreview.C, undefined);
  assert.equal(calcularDisponibilidad(materias, { A: "cursando", B: "regular" }).materiasPreview.C, true);
  const gated = [...materias, materia("D", { correlativas: ["A"], creditosRequeridos: 6 })];
  assert.equal(calcularDisponibilidad(gated, { A: "cursando" }).materiasPreview.D, undefined);
  assert.equal(calcularDisponibilidad(gated, { A: "cursando", B: "aprobada" }).materiasPreview.D, true);
  assert.equal(calcularDisponibilidad([materia("D", { correlativas: ["A"], tipoCorrelativa: "final" })], { A: "cursando" }).materiasPreview.D, undefined);
  assert.equal(calcularDisponibilidad(materias, { C: "aprobada" }).estadoVisualPorMateria.C, "aprobada");
});

test("excess elective credits cannot replace core, technology or final-project credits", () => {
  const plan = [materia("core"), materia("management", { grupo: "electiva-gestion", creditos: 60 })];
  assert.equal(sumarCreditosAprobados(plan, { management: "aprobada" }), 60);
  assert.equal(calcularCreditosTitulo(plan, { management: "aprobada" }), 27);
  assert.equal(calcularCreditosTitulo(plan, { management: "aprobada", core: "aprobada" }), 33);
});

test("the shipped L20 plan has resolvable prerequisites and title credit buckets total 192", () => {
  const plan = JSON.parse(readFileSync(new URL("../src/data/planDeEstudio.json", import.meta.url), "utf8"));
  assert.deepEqual(validarPlan(plan.materias), { idsDuplicados: [], correlativasInexistentes: [] });
  const allApproved = Object.fromEntries(plan.materias.map((course) => [course.id, "aprobada"]));
  assert.equal(calcularCreditosTitulo(plan.materias, allApproved), plan.creditosTitulo);
});

test("loading and receiving external changes never writes or erases saved progress", () => {
  const storage = createStorage({ [PROGRESS_STORAGE_KEY]: '{"A":"aprobada"}' });
  let onExternal;
  let unsubscribed = false;
  const store = crearProgresoStore({
    getStorage: () => storage,
    subscribeToStorage: (listener) => { onExternal = listener; return () => { unsubscribed = true; }; },
  });
  const stop = store.subscribe(() => {});
  assert.deepEqual(store.getSnapshot().progreso, { A: "aprobada" });
  assert.equal(storage.writes, 0);
  storage.values.set(PROGRESS_STORAGE_KEY, '{"A":"regular","B":"cursando"}');
  onExternal();
  assert.deepEqual(store.getSnapshot().progreso, { A: "regular", B: "cursando" });
  assert.equal(storage.writes, 0);
  storage.values.delete(PROGRESS_STORAGE_KEY);
  onExternal();
  assert.deepEqual(store.getSnapshot().progreso, {});
  stop();
  assert.equal(unsubscribed, true);
});

test("an edit uses the latest stored progress even before a cross-tab event is delivered", () => {
  const storage = createStorage({ [PROGRESS_STORAGE_KEY]: '{"A":"aprobada"}' });
  const store = crearProgresoStore({ getStorage: () => storage, subscribeToStorage: () => () => {} });
  store.subscribe(() => {});
  storage.values.set(PROGRESS_STORAGE_KEY, '{"A":"aprobada","B":"regular"}');
  store.update((current) => ({ ...current, C: "cursando" }));
  assert.deepEqual(JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY)), { A: "aprobada", B: "regular", C: "cursando" });
});

test("blocked storage keeps edits in memory and preserves them when storage returns", () => {
  const storage = createStorage();
  let blocked = true;
  const store = crearProgresoStore({
    getStorage: () => { if (blocked) throw new Error("SecurityError"); return storage; },
    subscribeToStorage: () => () => {},
  });
  store.subscribe(() => {});
  store.update((current) => ({ ...current, A: "regular" }));
  assert.ok(store.getSnapshot().storageError);
  assert.deepEqual(store.getSnapshot().progreso, { A: "regular" });
  blocked = false;
  storage.values.set(PROGRESS_STORAGE_KEY, '{"B":"aprobada"}');
  store.update((current) => ({ ...current, C: "cursando" }));
  assert.deepEqual(store.getSnapshot().progreso, { A: "regular", B: "aprobada", C: "cursando" });
  assert.equal(store.getSnapshot().storageError, null);
});

test("a failed write and pending removals survive an external refresh", () => {
  const storage = createStorage({ [PROGRESS_STORAGE_KEY]: '{"A":"regular","B":"cursando"}' });
  const write = storage.setItem.bind(storage);
  let blocked = true;
  let external;
  storage.setItem = (key, value) => { if (blocked) throw new Error("QuotaExceededError"); write(key, value); };
  const store = crearProgresoStore({ getStorage: () => storage, subscribeToStorage: (listener) => { external = listener; return () => {}; } });
  store.subscribe(() => {});
  store.update((current) => ({ ...current, A: "pendiente" }));
  storage.values.set(PROGRESS_STORAGE_KEY, '{"A":"regular","B":"aprobada","C":"regular"}');
  external();
  assert.deepEqual(store.getSnapshot().progreso, { B: "aprobada", C: "regular" });
  blocked = false;
  store.update((current) => current);
  assert.deepEqual(JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY)), { B: "aprobada", C: "regular" });
  assert.equal(store.getSnapshot().storageError, null);
});

test("backup round-trip preserves all sections and commission selections", () => {
  const storage = createStorage({
    [BACKUP_STORAGE_KEYS[0]]: '{"A":"aprobada"}',
    [BACKUP_STORAGE_KEYS[1]]: '["tecnologia-datos"]',
    [BACKUP_STORAGE_KEYS[2]]: '["B"]',
    [BACKUP_STORAGE_KEYS[3]]: JSON.stringify({ version: 3, slotActivoId: "2026-2", planificador: { "2026-2": ["B", "C"] }, comisiones: { "2026-2": { B: "commission-1" } } }),
  });
  const backup = parsearBackup(crearBackup(storage, "L20"), materias);
  const restored = createStorage();
  aplicarBackup(restored, backup);
  assert.deepEqual(restored.values, storage.values);
  assert.equal(backup.materiasConProgreso, 1);
  assert.equal(backup.materiasPlanificadas, 2);
});

test("legacy backups with string storage dumps and appState remain importable", () => {
  const fromDump = parsearBackup(JSON.stringify({ storageDump: { [BACKUP_STORAGE_KEYS[0]]: '{"A":"regular"}' } }), materias);
  const fromState = parsearBackup(JSON.stringify({ version: 1, appState: { progreso: { A: "regular" }, planner: { "2026-2": ["B"] } } }), materias);
  assert.deepEqual(fromDump.progreso, { A: "regular" });
  assert.deepEqual(fromState.progreso, { A: "regular" });
  assert.equal(fromState.materiasPlanificadas, 1);
});

test("invalid backups are rejected as a whole before anything can be applied", () => {
  for (const invalid of [
    null, [], {}, { storage: {} }, { version: 9, storage: { [BACKUP_STORAGE_KEYS[0]]: {} } },
    { plan: "OTHER", storage: { [BACKUP_STORAGE_KEYS[0]]: {} } },
    { storage: { [BACKUP_STORAGE_KEYS[0]]: { A: "unknown" } } },
    { storage: { [BACKUP_STORAGE_KEYS[0]]: { unknown: "regular" } } },
    { storage: { [BACKUP_STORAGE_KEYS[0]]: { A: "regular" }, [BACKUP_STORAGE_KEYS[1]]: ["invalid-minor"] } },
    { storage: { [BACKUP_STORAGE_KEYS[3]]: { planificador: { "2026-2": ["unknown"] } } } },
  ]) assert.throws(() => parsearBackup(JSON.stringify(invalid), materias));
  assert.throws(() => parsearBackup(" ".repeat(MAX_BACKUP_BYTES + 1), materias), /1 MB/);
});

test("a partial backup leaves unrelated data untouched", () => {
  const storage = createStorage({ [BACKUP_STORAGE_KEYS[1]]: '["tecnologia-datos"]' });
  const backup = parsearBackup(crearBackup(null, "L20", { A: "regular" }), materias);
  aplicarBackup(storage, backup);
  assert.equal(storage.getItem(BACKUP_STORAGE_KEYS[1]), '["tecnologia-datos"]');
  assert.equal(storage.getItem(BACKUP_STORAGE_KEYS[0]), '{"A":"regular"}');
});

test("import restores earlier values if a later storage write fails", () => {
  const storage = createStorage({ [BACKUP_STORAGE_KEYS[0]]: '{"A":"aprobada"}' });
  const initial = new Map(storage.values);
  const write = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === BACKUP_STORAGE_KEYS[1]) throw new Error("QuotaExceededError");
    write(key, value);
  };
  const backup = parsearBackup(JSON.stringify({ storage: { [BACKUP_STORAGE_KEYS[0]]: { B: "regular" }, [BACKUP_STORAGE_KEYS[1]]: [] } }), materias);
  assert.throws(() => aplicarBackup(storage, backup), /se conservaron/);
  assert.deepEqual(storage.values, initial);
});
