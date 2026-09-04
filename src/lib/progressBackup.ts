import { MINOR_OPTIONS } from "@/data/minorsMetadata";
import { esEstadoMateria, normalizarProgreso } from "@/lib/planUtils";
import type { MateriaPlan, ProgresoMaterias } from "@/types/plan";

export const MAX_BACKUP_BYTES = 1_000_000;
export const BACKUP_STORAGE_KEYS = [
  "malla-curricular:progreso:v1",
  "malla-curricular:minors:v1",
  "malla-curricular:plan-minors:v1",
  "tablero-materias:planificador:v1",
] as const;

export type BackupStorageKey = (typeof BACKUP_STORAGE_KEYS)[number];

export interface BackupValidado {
  entries: Array<[BackupStorageKey, string]>;
  progreso?: ProgresoMaterias;
  materiasConProgreso: number;
  materiasPlanificadas: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decode(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("El backup contiene un apartado que no es JSON válido.");
  }
}

function validateCourseIds(value: unknown, idsValidos: Set<string>): string[] {
  if (!Array.isArray(value) || !value.every((id) => typeof id === "string" && idsValidos.has(id))) {
    throw new Error("El backup contiene materias desconocidas o una lista de materias inválida.");
  }
  return [...new Set(value as string[])];
}

function validatePlanner(value: unknown, idsValidos: Set<string>) {
  if (value === null) return { version: 3, planificador: {}, comisiones: {} };
  if (!isRecord(value)) throw new Error("La planificación del backup no tiene un formato válido.");
  const source = "planificador" in value ? value.planificador : value;
  if (!isRecord(source)) throw new Error("La planificación del backup no tiene un formato válido.");
  const planificador: Record<string, string[]> = {};
  const seen = new Set<string>();
  for (const [slotId, ids] of Object.entries(source)) {
    if (["version", "slotActivoId", "comisiones"].includes(slotId) && source === value) continue;
    if (!/^(?:19|20|21)\d{2}-[12]$/.test(slotId)) throw new Error("El backup contiene un cuatrimestre inválido.");
    planificador[slotId] = validateCourseIds(ids, idsValidos).filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  if (value.slotActivoId !== undefined && (typeof value.slotActivoId !== "string" || !/^(?:19|20|21)\d{2}-[12]$/.test(value.slotActivoId))) {
    throw new Error("El cuatrimestre seleccionado del backup no es válido.");
  }
  if (value.comisiones !== undefined && !isRecord(value.comisiones)) {
    throw new Error("Las comisiones del backup no tienen un formato válido.");
  }
  const comisiones: Record<string, Record<string, string>> = {};
  for (const [slotId, selections] of Object.entries(value.comisiones ?? {})) {
    if (!/^(?:19|20|21)\d{2}-[12]$/.test(slotId) || !isRecord(selections)) {
      throw new Error("Las comisiones del backup no tienen un formato válido.");
    }
    comisiones[slotId] = {};
    for (const [id, commission] of Object.entries(selections)) {
      if (!idsValidos.has(id) || typeof commission !== "string" || commission.length > 200) {
        throw new Error("El backup contiene una selección de comisión inválida.");
      }
      if (planificador[slotId]?.includes(id)) comisiones[slotId][id] = commission;
    }
  }
  return { version: 3, slotActivoId: value.slotActivoId, planificador, comisiones };
}

/** Validate every section before the caller changes any saved data. */
export function parsearBackup(raw: string, materias: MateriaPlan[], planEsperado = "L20"): BackupValidado {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) {
    throw new Error("El archivo supera el límite de 1 MB para un backup.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("No pudimos leer el archivo. Elegí un backup JSON de esta app.");
  }
  if (!isRecord(parsed)) throw new Error("El archivo no es un backup de esta app.");
  if (parsed.version !== undefined && ![1, 2, 3].includes(parsed.version as number)) {
    throw new Error("Esta versión de backup no es compatible con la app.");
  }
  if (parsed.plan !== undefined && parsed.plan !== planEsperado) {
    throw new Error(`El backup corresponde a otro plan de estudios. Se esperaba ${planEsperado}.`);
  }

  let source = parsed.storage ?? parsed.storageDump;
  if (source === undefined && isRecord(parsed.appState)) {
    const legacyNames = ["progreso", "minors", "materiasPlanMinors", "planner"];
    source = Object.fromEntries(BACKUP_STORAGE_KEYS.flatMap((key, index) =>
      Object.prototype.hasOwnProperty.call(parsed.appState, legacyNames[index])
        ? [[key, (parsed.appState as Record<string, unknown>)[legacyNames[index]]]] : [],
    ));
  }
  if (!isRecord(source)) throw new Error("El archivo no incluye datos reconocibles de esta app.");
  const idsValidos = new Set(materias.map((materia) => materia.id));
  const result: BackupValidado = { entries: [], materiasConProgreso: 0, materiasPlanificadas: 0 };

  for (const key of BACKUP_STORAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = decode(source[key]);
    let validated: unknown;
    if (key === BACKUP_STORAGE_KEYS[0]) {
      if (value !== null && (!isRecord(value) || !Object.entries(value).every(([id, state]) => idsValidos.has(id) && esEstadoMateria(state)))) {
        throw new Error("Los estados del backup contienen una materia o un estado inválido.");
      }
      result.progreso = normalizarProgreso(value, idsValidos);
      result.materiasConProgreso = Object.keys(result.progreso).length;
      validated = result.progreso;
    } else if (key === BACKUP_STORAGE_KEYS[1]) {
      if (value !== null && (!Array.isArray(value) || !value.every((minor) => MINOR_OPTIONS.includes(minor)))) {
        throw new Error("El backup contiene una selección de minor inválida.");
      }
      validated = [...new Set((value ?? []) as string[])];
    } else if (key === BACKUP_STORAGE_KEYS[2]) {
      validated = validateCourseIds(value ?? [], idsValidos);
    } else {
      const planner = validatePlanner(value, idsValidos);
      result.materiasPlanificadas = new Set(Object.values(planner.planificador).flat()).size;
      validated = planner;
    }
    result.entries.push([key, JSON.stringify(validated)]);
  }
  if (result.entries.length === 0) throw new Error("El archivo no incluye ningún apartado de esta app.");
  return result;
}

export function crearBackup(
  storage: Pick<Storage, "getItem"> | null,
  plan: string,
  progreso?: ProgresoMaterias,
): string {
  const entries = storage ? BACKUP_STORAGE_KEYS.map((key) => [key, decode(storage.getItem(key))]) : [];
  const saved = Object.fromEntries(entries);
  if (progreso) saved[BACKUP_STORAGE_KEYS[0]] = normalizarProgreso(progreso);
  return JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), plan, storage: saved }, null, 2);
}

export function aplicarBackup(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  backup: BackupValidado,
): void {
  // Capture all previous values first: a read failure must never produce a partial import.
  const previous = new Map(backup.entries.map(([key]) => [key, storage.getItem(key)]));
  const changed: BackupStorageKey[] = [];
  try {
    for (const [key, value] of backup.entries) {
      storage.setItem(key, value);
      changed.push(key);
    }
  } catch {
    let rollbackFailed = false;
    for (const key of changed.reverse()) {
      try {
        const value = previous.get(key);
        if (value == null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        rollbackFailed = true;
      }
    }
    throw new Error(rollbackFailed
      ? "El navegador bloqueó la importación y no pudo restaurar todos los datos. Conservá el backup para reintentar."
      : "El navegador no pudo guardar el backup. Tus datos anteriores se conservaron.");
  }
}
