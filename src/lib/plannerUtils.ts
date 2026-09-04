import type { MateriaPlan, ProgresoMaterias } from "@/types/plan";

export interface PlannerSlot {
  id: string;
  label: string;
  shortLabel: string;
  year: number;
  period: 1 | 2;
}

export interface PlannerStorage {
  active?: string;
  plan: Record<string, string[]>;
  commissions: Record<string, Record<string, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isPlannerSlotId(id: string): boolean {
  return /^(?:19|20|21)\d{2}-[12]$/.test(id);
}

export function parsePlannerStorage(raw: string | null): PlannerStorage | null {
  if (raw === null) return { plan: {}, commissions: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const source = "planificador" in parsed ? parsed.planificador : parsed;
    if (!isRecord(source)) return null;
    const plan: Record<string, string[]> = {};
    for (const [slotId, ids] of Object.entries(source)) {
      if (["version", "slotActivoId", "comisiones"].includes(slotId)) continue;
      if (!isPlannerSlotId(slotId) || !Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return null;
      plan[slotId] = [...new Set(ids)];
    }
    const commissions: PlannerStorage["commissions"] = {};
    if (parsed.comisiones !== undefined) {
      if (!isRecord(parsed.comisiones)) return null;
      for (const [slotId, selections] of Object.entries(parsed.comisiones)) {
        if (!isPlannerSlotId(slotId) || !isRecord(selections)) return null;
        const rows: Record<string, string> = {};
        for (const [courseId, commissionId] of Object.entries(selections)) {
          if (typeof commissionId !== "string") return null;
          rows[courseId] = commissionId;
        }
        commissions[slotId] = rows;
      }
    }
    return {
      active: typeof parsed.slotActivoId === "string" && isPlannerSlotId(parsed.slotActivoId) ? parsed.slotActivoId : undefined,
      plan,
      commissions,
    };
  } catch {
    return null;
  }
}

export function restorePlannerSlots(current: PlannerSlot[], stored: PlannerStorage): PlannerSlot[] {
  const ids = new Set([
    ...current.map((slot) => slot.id),
    ...Object.keys(stored.plan),
    ...Object.keys(stored.commissions),
    ...(stored.active ? [stored.active] : []),
  ]);
  return [...ids].filter(isPlannerSlotId).sort().map((id) => {
    const [year, period] = id.split("-").map(Number) as [number, 1 | 2];
    return { id, year, period, label: `${period}° cuatrimestre de ${year}`, shortLabel: `${year} · ${period}°` };
  });
}

export interface PlannerEligibility {
  ready: boolean;
  projected: boolean;
  missingPrerequisites: string[];
  missingCredits: number;
}

function eligibility(course: MateriaPlan, progress: ProgresoMaterias, approvedCredits: number) {
  const missingPrerequisites = course.correlativas.filter((id) =>
    progress[id] !== "aprobada" && !(course.tipoCorrelativa === "cursada" && progress[id] === "regular"),
  );
  const missingCredits = Math.max(0, course.creditosRequeridos - approvedCredits);
  return { ready: missingPrerequisites.length === 0 && missingCredits === 0, missingPrerequisites, missingCredits };
}

export function projectPlannerEligibility(
  courses: MateriaPlan[],
  progress: ProgresoMaterias,
  plan: Record<string, string[]>,
  orderedSlotIds: string[],
  activeSlotId: string,
): Record<string, PlannerEligibility> {
  const projectedProgress = { ...progress };
  const byId = new Map(courses.map((course) => [course.id, course]));
  const credits = (current: ProgresoMaterias) => courses.reduce((total, course) =>
    total + (current[course.id] === "aprobada" ? course.creditos : 0), 0);
  const actualCredits = credits(progress);
  const activeIndex = orderedSlotIds.indexOf(activeSlotId);

  for (const slotId of orderedSlotIds.slice(0, Math.max(0, activeIndex))) {
    const previousCredits = credits(projectedProgress);
    // Evaluate the whole term before updating progress: concurrent courses cannot
    // satisfy each other's prerequisites or minimum approved-credit requirements.
    const completable = (plan[slotId] ?? []).filter((id) => {
      const course = byId.get(id);
      return course && eligibility(course, projectedProgress, previousCredits).ready;
    });
    for (const id of completable) projectedProgress[id] = "aprobada";
  }

  const projectedCredits = credits(projectedProgress);
  return Object.fromEntries(courses.map((course) => {
    const result = eligibility(course, projectedProgress, projectedCredits);
    return [course.id, {
      ...result,
      projected: result.ready && !eligibility(course, progress, actualCredits).ready,
    }];
  }));
}
