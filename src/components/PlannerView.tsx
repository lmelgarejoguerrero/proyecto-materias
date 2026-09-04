"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  ExternalLink,
  Info,
  ListChecks,
  Plus,
  Search,
  Trash2,
  RotateCcw,
  RefreshCw,
} from "lucide-react";

import { PlannerSchedule } from "@/components/PlannerSchedule";
import { parsePlannerStorage, projectPlannerEligibility, restorePlannerSlots } from "@/lib/plannerUtils";
import type { PlannerSlot, PlannerStorage } from "@/lib/plannerUtils";
import {
  findOffering,
  findReferenceOffering,
  formatCommission,
  foroItbaCourseUrl,
  normalizeScheduleData,
} from "@/lib/scheduleUtils";
import type { MateriaPlan, ProgresoMaterias } from "@/types/plan";
import type {
  AcademicPeriod,
  CeitbaSubjectsResponse,
  PlannerScheduleEvent,
} from "@/types/schedule";

const STORAGE_PLANNER_KEY = "tablero-materias:planificador:v1";
const MAX_CREDITS = 30;
const IDEAL_CREDITS = 24;

interface PlannerViewProps {
  materias: MateriaPlan[];
  progreso: ProgresoMaterias;
  materiasHabilitadas: Record<string, boolean>;
  onOpenCourse: (materiaId: string) => void;
}

type PlannerPanel = "materias" | "horario";

function createSlots(count = 6): PlannerSlot[] {
  const today = new Date();
  let year = today.getFullYear();
  const month = today.getMonth() + 1;
  const periodOneIsActive = month < 7 || (month === 7 && today.getDate() <= 25);
  let period: AcademicPeriod = periodOneIsActive ? 1 : 2;

  return Array.from({ length: count }, (_, index) => {
    if (index > 0) {
      if (period === 1) period = 2;
      else {
        period = 1;
        year += 1;
      }
    }
    return {
      id: `${year}-${period}`,
      label: `${period}° cuatrimestre de ${year}`,
      shortLabel: `${year} · ${period}°`,
      year,
      period,
    };
  });
}

export function PlannerView({
  materias,
  progreso,
  onOpenCourse,
}: PlannerViewProps) {
  const initialSlots = useMemo(() => createSlots(), []);
  const [slots, setSlots] = useState(initialSlots);
  const [hasExplicitChanges, setHasExplicitChanges] = useState(false);
  const [storageReadable, setStorageReadable] = useState(false);
  const courseMap = useMemo(() => new Map(materias.map((materia) => [materia.id, materia])), [materias]);
  const [plan, setPlan] = useState<Record<string, string[]>>({});
  const [commissionSelections, setCommissionSelections] = useState<
    Record<string, Record<string, string>>
  >({});
  const [activeSlotId, setActiveSlotId] = useState(slots[0]?.id ?? "");
  const [activePanel, setActivePanel] = useState<PlannerPanel>("materias");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [scheduleData, setScheduleData] = useState<CeitbaSubjectsResponse | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleRequest, setScheduleRequest] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [lastRemoved, setLastRemoved] = useState<{ courseId: string; slotId: string; commissionId?: string } | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHasExplicitChanges(false);
      setStorageReadable(false);
      let stored: PlannerStorage = { plan: {}, commissions: {} };
      try {
        const parsed = parsePlannerStorage(window.localStorage.getItem(STORAGE_PLANNER_KEY));
        if (parsed) {
          stored = parsed;
          setStorageReadable(true);
          setStorageError(null);
        }
        else setStorageError("No pudimos leer el plan guardado. Conservamos los datos originales; sólo se reemplazarán si modificás tu planificación.");
      } catch {
        setStorageError("El navegador bloqueó el acceso al guardado. Podés planificar en esta sesión, pero los cambios podrían perderse al cerrar.");
      }
      const restoredSlots = restorePlannerSlots(initialSlots, stored);
      const validSlots = new Set(restoredSlots.map((slot) => slot.id));
      const seen = new Set<string>();
      const normalized: Record<string, string[]> = {};

      for (const [slotId, ids] of Object.entries(stored.plan)) {
        const unique = ids.filter((id) => {
          if (!courseMap.has(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        if (validSlots.has(slotId)) normalized[slotId] = unique;
      }

      const normalizedCommissions: Record<string, Record<string, string>> = {};
      for (const [slotId, selections] of Object.entries(stored.commissions)) {
        if (!validSlots.has(slotId)) continue;
        const planned = new Set(normalized[slotId] ?? []);
        normalizedCommissions[slotId] = Object.fromEntries(
          Object.entries(selections).filter(([courseId]) => planned.has(courseId)),
        );
      }

      setSlots(restoredSlots);
      setPlan(normalized);
      setCommissionSelections(normalizedCommissions);
      if (stored.active && validSlots.has(stored.active)) setActiveSlotId(stored.active);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [courseMap, initialSlots]);

  useEffect(() => {
    if (!hydrated || !hasExplicitChanges) return;
    let failure: string | null = null;
    try {
      window.localStorage.setItem(
        STORAGE_PLANNER_KEY,
        JSON.stringify({
          version: 3,
          slotActivoId: activeSlotId,
          planificador: plan,
          comisiones: commissionSelections,
        }),
      );
    } catch {
      failure = "No pudimos guardar el plan en este navegador. Conservá esta pestaña abierta para no perder los cambios.";
    }
    const frame = window.requestAnimationFrame(() => setStorageError(failure));
    return () => window.cancelAnimationFrame(frame);
  }, [activeSlotId, commissionSelections, hasExplicitChanges, hydrated, plan]);

  useEffect(() => {
    const controller = new AbortController();
    const loadSchedules = async () => {
      try {
        setScheduleLoading(true);
        const response = await fetch("/api/horarios", { signal: controller.signal });
        const data = (await response.json()) as CeitbaSubjectsResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar los horarios.");
        setScheduleData(data);
        setScheduleError(null);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setScheduleError(caught instanceof Error ? caught.message : "No se pudieron cargar los horarios.");
      } finally {
        if (!controller.signal.aborted) setScheduleLoading(false);
      }
    };
    void loadSchedules();
    return () => controller.abort();
  }, [scheduleRequest]);

  const offerings = useMemo(
    () => (scheduleData ? normalizeScheduleData(scheduleData) : []),
    [scheduleData],
  );
  const plannedIds = useMemo(() => new Set(Object.values(plan).flat()), [plan]);
  const creditsBySlot = useMemo(
    () =>
      Object.fromEntries(
        slots.map((slot) => [
          slot.id,
          (plan[slot.id] ?? []).reduce((total, id) => total + (courseMap.get(id)?.creditos ?? 0), 0),
        ]),
      ) as Record<string, number>,
    [courseMap, plan, slots],
  );
  const totals = useMemo(() => {
    const credits = Object.values(creditsBySlot).reduce((total, value) => total + value, 0);
    return {
      subjects: plannedIds.size,
      credits,
      terms: slots.filter((slot) => (plan[slot.id]?.length ?? 0) > 0).length,
    };
  }, [creditsBySlot, plan, plannedIds.size, slots]);

  const activeSlot = slots.find((slot) => slot.id === activeSlotId) ?? slots[0];
  const activeCourses = useMemo(
    () =>
      (plan[activeSlotId] ?? [])
        .map((id) => courseMap.get(id))
        .filter((materia): materia is MateriaPlan => Boolean(materia)),
    [activeSlotId, courseMap, plan],
  );
  const activeScheduleRows = useMemo(
    () =>
      activeCourses.map((course) => {
        const exactOffering = activeSlot
          ? findOffering(offerings, course.id, activeSlot.year, activeSlot.period)
          : undefined;
        const referenceOffering =
          activeSlot && !exactOffering?.commissions.length
            ? findReferenceOffering(offerings, course.id, activeSlot.year, activeSlot.period)
            : undefined;
        return {
          course,
          offering: exactOffering?.commissions.length ? exactOffering : referenceOffering ?? exactOffering,
          isReference: Boolean(referenceOffering),
        };
      }),
    [activeCourses, activeSlot, offerings],
  );
  const activeEvents = useMemo(() => {
    if (!activeSlot) return [];
    const events: PlannerScheduleEvent[] = [];
    for (const { course, offering, isReference } of activeScheduleRows) {
      if (!offering) continue;
      const selectedId = commissionSelections[activeSlot.id]?.[course.id];
      const commission = offering.commissions.find((item) => item.id === selectedId);
      if (!commission) continue;
      commission.meetings.forEach((meeting, index) => {
        events.push({
          ...meeting,
          id: `${course.id}:${commission.id}:${index}`,
          courseId: course.id,
          courseName: course.nombre,
          commissionId: commission.id,
          commissionName: commission.name,
          isReference,
          sourceYear: offering.year,
          sourcePeriod: offering.period,
        });
      });
    }
    return events;
  }, [activeScheduleRows, activeSlot, commissionSelections]);
  const selectedScheduleCount = useMemo(
    () =>
      activeScheduleRows.filter(({ course, offering }) =>
        offering?.commissions.some(
          (commission) => commission.id === commissionSelections[activeSlotId]?.[course.id],
        ),
      ).length,
    [activeScheduleRows, activeSlotId, commissionSelections],
  );
  const selectedReferenceCount = useMemo(
    () =>
      activeScheduleRows.filter(
        ({ course, offering, isReference }) =>
          isReference &&
          offering?.commissions.some(
            (commission) => commission.id === commissionSelections[activeSlotId]?.[course.id],
          ),
      ).length,
    [activeScheduleRows, activeSlotId, commissionSelections],
  );
  const eligibility = useMemo(
    () => projectPlannerEligibility(materias, progreso, plan, slots.map((slot) => slot.id), activeSlotId),
    [activeSlotId, materias, plan, progreso, slots],
  );
  const activeCredits = creditsBySlot[activeSlotId] ?? 0;

  const available = useMemo(() => {
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
    const term = normalize(search.trim());
    return materias
      .filter((materia) => progreso[materia.id] !== "aprobada")
      .filter((materia) => !plannedIds.has(materia.id))
      .filter((materia) => showAll || materia.estadoOferta !== "inactiva")
      .filter(
        (materia) =>
          showAll ||
          eligibility[materia.id]?.ready ||
          progreso[materia.id] === "regular" ||
          progreso[materia.id] === "cursando",
      )
      .filter(
        (materia) =>
          !term ||
          normalize(materia.id).includes(term) ||
          normalize(materia.nombre).includes(term),
      )
      .sort((left, right) => {
        const leftScore = eligibility[left.id]?.ready ? 0 : 1;
        const rightScore = eligibility[right.id]?.ready ? 0 : 1;
        if (leftScore !== rightScore) return leftScore - rightScore;
        if (left.cuatrimestre !== right.cuatrimestre) return left.cuatrimestre - right.cuatrimestre;
        return left.id.localeCompare(right.id);
      });
  }, [materias, eligibility, plannedIds, progreso, search, showAll]);

  const moveCourse = (courseId: string, targetSlotId: string) => {
    const course = courseMap.get(courseId);
    if (!course || !slots.some((slot) => slot.id === targetSlotId)) return;
    const sourceSlotId = slots.find((slot) => (plan[slot.id] ?? []).includes(courseId))?.id;
    const targetWithoutCourse = (plan[targetSlotId] ?? []).filter((id) => id !== courseId);
    const resultCredits = targetWithoutCourse.reduce(
      (total, id) => total + (courseMap.get(id)?.creditos ?? 0),
      course.creditos,
    );
    if (resultCredits > MAX_CREDITS) {
      setError(`${course.nombre} dejaría ese cuatrimestre en ${resultCredits} créditos. El máximo es ${MAX_CREDITS}.`);
      return;
    }

    const next = { ...plan, [targetSlotId]: [...targetWithoutCourse, courseId] };
    if (sourceSlotId && sourceSlotId !== targetSlotId) {
      next[sourceSlotId] = (plan[sourceSlotId] ?? []).filter((id) => id !== courseId);
      setCommissionSelections((current) => {
        const updated = { ...current };
        updated[sourceSlotId] = { ...(current[sourceSlotId] ?? {}) };
        delete updated[sourceSlotId][courseId];
        updated[targetSlotId] = { ...(current[targetSlotId] ?? {}) };
        delete updated[targetSlotId][courseId];
        return updated;
      });
    }
    setHasExplicitChanges(true);
    setPlan(next);
    setError(null);
  };

  const removeCourse = (courseId: string, slotId: string) => {
    setHasExplicitChanges(true);
    setLastRemoved({ courseId, slotId, commissionId: commissionSelections[slotId]?.[courseId] });
    setPlan((current) => ({ ...current, [slotId]: (current[slotId] ?? []).filter((id) => id !== courseId) }));
    setCommissionSelections((current) => {
      const updated = { ...current, [slotId]: { ...(current[slotId] ?? {}) } };
      delete updated[slotId][courseId];
      return updated;
    });
    setError(null);
  };

  const undoRemove = () => {
    if (!lastRemoved || plannedIds.has(lastRemoved.courseId)) return;
    const course = courseMap.get(lastRemoved.courseId);
    if (!course) return;
    if ((creditsBySlot[lastRemoved.slotId] ?? 0) + course.creditos > MAX_CREDITS) {
      setError(`Para restaurar ${course.nombre}, liberá créditos en ese cuatrimestre.`);
      return;
    }
    setHasExplicitChanges(true);
    setPlan((current) => ({ ...current, [lastRemoved.slotId]: [...(current[lastRemoved.slotId] ?? []), lastRemoved.courseId] }));
    if (lastRemoved.commissionId) {
      setCommissionSelections((current) => ({ ...current, [lastRemoved.slotId]: { ...current[lastRemoved.slotId], [lastRemoved.courseId]: lastRemoved.commissionId! } }));
    }
    setLastRemoved(null);
    setError(null);
  };

  const selectCommission = (courseId: string, commissionId: string) => {
    setHasExplicitChanges(true);
    setCommissionSelections((current) => {
      const slotSelections = { ...(current[activeSlotId] ?? {}) };
      if (commissionId) slotSelections[courseId] = commissionId;
      else delete slotSelections[courseId];
      return { ...current, [activeSlotId]: slotSelections };
    });
  };

  const selectSlot = (slotId: string) => {
    if (storageReadable) setHasExplicitChanges(true);
    setActiveSlotId(slotId);
    setError(null);
  };

  return (
    <div className="space-y-5">
      {storageError ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{storageError}</p> : null}
      {lastRemoved && !plannedIds.has(lastRemoved.courseId) ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
          <span>Quitaste {courseMap.get(lastRemoved.courseId)?.nombre} del plan.</span>
          <button type="button" onClick={undoRemove} className="inline-flex min-h-9 items-center gap-1.5 font-bold"><RotateCcw className="size-3.5" /> Deshacer</button>
        </div>
      ) : null}
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <CalendarDays className="size-3.5" /> Materias + horarios reales
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Armá un cuatri a la vez.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Organizá los próximos cuatrimestres, revisá tus correlativas y encontrá comisiones que encajen en tu semana.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
              <a href="https://ceitba.org.ar/scheduler/LN?plan=L20" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                Horarios CEITBA <ExternalLink className="size-3" />
              </a>
              <a href="https://foro-itba.vercel.app/carreras/licenciatura-en-negocios" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                Reseñas Foro ITBA <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              [totals.subjects, "materias"],
              [totals.credits, "créditos"],
              [totals.terms, "cuatris"],
            ].map(([value, label]) => (
              <div key={label} className="min-w-20 rounded-2xl bg-slate-100 px-4 py-3 text-center">
                <p className="text-xl font-semibold text-slate-950">{value}</p>
                <p className="text-[11px] font-medium text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tu ruta</p>
            <p className="mt-0.5 text-xs text-slate-500">Tu plan se guarda automáticamente en este navegador.</p>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 sm:inline">Objetivo · {IDEAL_CREDITS} cr</span>
        </div>
        <div className="grid auto-cols-[minmax(11.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1 xl:grid-flow-row xl:grid-cols-6 xl:overflow-visible">
          {slots.map((slot) => {
            const credits = creditsBySlot[slot.id] ?? 0;
            const count = plan[slot.id]?.length ?? 0;
            const active = activeSlotId === slot.id;
            const high = credits > IDEAL_CREDITS;
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => selectSlot(slot.id)}
                disabled={!hydrated}
                aria-pressed={active}
                className={`min-h-24 rounded-2xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  active
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">{slot.shortLabel}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${high ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                    {credits} cr
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${high ? "bg-amber-500" : "bg-blue-600"}`} style={{ width: `${Math.min(100, (credits / MAX_CREDITS) * 100)}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">{count === 0 ? "Vacío" : `${count} materia${count === 1 ? "" : "s"}`}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="flex h-fit min-w-0 flex-col rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-28 xl:max-h-[calc(100vh-8rem)]">
          <label className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500" htmlFor="planner-term">
            Agregar a
          </label>
          <select
            id="planner-term"
            value={activeSlotId}
            disabled={!hydrated}
            onChange={(event) => selectSlot(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
          </select>

          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Buscar materias para agregar al plan"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o código"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="mt-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label="Filtrar materias disponibles">
            <button type="button" onClick={() => setShowAll(false)} aria-pressed={!showAll} className={`min-h-9 rounded-lg px-2 text-xs font-bold ${!showAll ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
              Cursables
            </button>
            <button type="button" onClick={() => setShowAll(true)} aria-pressed={showAll} className={`min-h-9 rounded-lg px-2 text-xs font-bold ${showAll ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
              Todas
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-500">{available.length} para agregar</p>
            {search ? <button type="button" onClick={() => setSearch("")} className="text-xs font-bold text-blue-700">Limpiar</button> : null}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">“Según tu plan” supone aprobar las materias de cuatris anteriores. Las correlativas del mismo cuatri no se dan por cumplidas.</p>
          <div className="mt-2 max-h-[32rem] space-y-2 overflow-y-auto pr-1 xl:flex-1">
            {available.length > 0 ? available.map((materia) => {
              const readiness = eligibility[materia.id];
              const ready = readiness?.ready;
              const exceedsCredits = activeCredits + materia.creditos > MAX_CREDITS;
              return (
                <div key={`available-${materia.id}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] font-semibold text-slate-500">{materia.id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${ready ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                          {materia.estadoOferta === "inactiva" ? "Oferta inactiva" : ready ? readiness.projected ? "Según tu plan" : "Podés cursar" : "Revisar requisitos"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{materia.nombre}</p>
                      <p className="mt-1 text-xs text-slate-500">{materia.creditos} cr{exceedsCredits ? " · No entra en este cuatri" : ""}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => moveCourse(materia.id, activeSlotId)}
                      disabled={!hydrated || exceedsCredits}
                      title={exceedsCredits ? `Máximo ${MAX_CREDITS} créditos por cuatrimestre` : undefined}
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      aria-label={`Agregar ${materia.nombre} a ${activeSlot?.label}`}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-xs leading-5 text-slate-500">
                No hay materias con este filtro. Probá “Todas” o cambiá la búsqueda.
              </div>
            )}
          </div>
          {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700" role="alert">{error}</p> : null}
        </aside>

        <section className="min-w-0 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Editando</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">{activeSlot?.label}</h3>
              <p className="mt-1 text-xs text-slate-500">{activeCourses.length} materias · {activeCredits} créditos · {Math.max(0, MAX_CREDITS - activeCredits)} disponibles</p>
            </div>
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Vista del cuatrimestre" onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? "materias" : event.key === "End" ? "horario" : activePanel === "materias" ? "horario" : "materias";
              setActivePanel(next);
              document.getElementById(`planner-tab-${next}`)?.focus();
            }}>
              <button
                type="button"
                role="tab"
                id="planner-tab-materias"
                aria-controls="planner-panel"
                tabIndex={activePanel === "materias" ? 0 : -1}
                aria-selected={activePanel === "materias"}
                onClick={() => setActivePanel("materias")}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold ${activePanel === "materias" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
              >
                <ListChecks className="size-3.5" /> Materias
              </button>
              <button
                type="button"
                role="tab"
                id="planner-tab-horario"
                aria-controls="planner-panel"
                tabIndex={activePanel === "horario" ? 0 : -1}
                aria-selected={activePanel === "horario"}
                onClick={() => setActivePanel("horario")}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold ${activePanel === "horario" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
              >
                <Clock3 className="size-3.5" /> Horario
                {selectedScheduleCount > 0 ? <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] text-blue-700">{selectedScheduleCount}</span> : null}
              </button>
            </div>
          </div>

          {scheduleError && activePanel === "materias" ? <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><span>No pudimos cargar los horarios. Podés seguir planificando.</span><button type="button" onClick={() => setScheduleRequest((current) => current + 1)} disabled={scheduleLoading} className="inline-flex min-h-9 items-center gap-1.5 font-bold disabled:opacity-50"><RefreshCw className="size-3.5" /> Reintentar</button></div> : null}
          {activeCredits > IDEAL_CREDITS ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Carga alta: superaste la referencia de {IDEAL_CREDITS} créditos. Revisá cuántas horas podés dedicarle a este cuatrimestre.</p> : null}
          <div className="pt-4" role="tabpanel" id="planner-panel" aria-labelledby={`planner-tab-${activePanel}`}>
            {activePanel === "horario" ? (
              <PlannerSchedule
                events={activeEvents}
                activeLabel={activeSlot?.label ?? "Cuatrimestre"}
                subjectsCount={activeCourses.length}
                selectedCount={selectedScheduleCount}
                referenceCount={selectedReferenceCount}
                loading={scheduleLoading}
                sourceError={scheduleError}
                onRetry={() => setScheduleRequest((current) => current + 1)}
                onSelectCourses={() => setActivePanel("materias")}
              />
            ) : activeCourses.length > 0 ? (
              <div className="max-h-[39rem] space-y-2 overflow-y-auto pr-1">
                {activeScheduleRows.map(({ course, offering, isReference }) => {
                  const storedCommission = commissionSelections[activeSlotId]?.[course.id] ?? "";
                  const selectedCommission = offering?.commissions.some((commission) => commission.id === storedCommission) ? storedCommission : "";
                  const readiness = eligibility[course.id];
                  return (
                    <article key={`${activeSlotId}-${course.id}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,24rem)_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-500">{course.id}</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm">{course.creditos} cr</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${readiness?.ready ? "bg-indigo-100 text-indigo-700" : "bg-amber-50 text-amber-800"}`}>
                            {readiness?.ready ? readiness.projected ? "Según tu plan" : "Habilitada" : "Revisar requisitos"}
                          </span>
                          {course.estadoOferta === "inactiva" ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800">Oferta inactiva</span> : null}
                        </div>
                        <h4 className="mt-1.5 text-sm font-semibold leading-snug text-slate-950">{course.nombre}</h4>
                        {!readiness?.ready ? <p className="mt-1 text-[11px] leading-5 text-amber-800">{readiness?.missingPrerequisites.length ? `Faltan: ${readiness.missingPrerequisites.map((id) => courseMap.get(id)?.nombre ?? id).join(", ")}. ` : ""}{readiness?.missingCredits ? `Necesitás ${readiness.missingCredits} créditos aprobados más.` : ""}</p> : null}
                        <a
                          href={foroItbaCourseUrl(course.id, course.nombre)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline"
                        >
                          Ver reseñas y consejos <ExternalLink className="size-3" />
                        </a>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        <label className="min-w-0">
                          <span className="sr-only">Comisión de {course.nombre}</span>
                          <select
                            value={selectedCommission}
                            onChange={(event) => selectCommission(course.id, event.target.value)}
                            disabled={scheduleLoading || !offering || offering.commissions.length === 0}
                            className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            <option value="">
                              {scheduleLoading
                                ? "Cargando horarios…"
                                : offering?.commissions.length
                                  ? isReference
                                    ? `Referencia ${offering.period}° ${offering.year} · elegir comisión`
                                    : "Elegir comisión"
                                  : "Horarios todavía no publicados"}
                            </option>
                            {offering?.commissions.map((commission) => (
                              <option key={commission.id} value={commission.id}>{formatCommission(commission)}</option>
                            ))}
                          </select>
                          {storedCommission && !selectedCommission && !scheduleLoading ? <span className="mt-1 block text-[10px] leading-4 text-amber-700">La comisión guardada cambió o ya no está publicada. Elegí una de la oferta actual.</span> : null}
                          {isReference && offering ? (
                            <span className="mt-1 block text-[10px] font-semibold text-amber-700">
                              Oferta del {offering.period}° cuatrimestre de {offering.year}; usala sólo como referencia.
                            </span>
                          ) : null}
                        </label>
                        <label className="min-w-0">
                          <span className="sr-only">Mover {course.nombre} a otro cuatrimestre</span>
                          <select
                            value={activeSlotId}
                            onChange={(event) => moveCourse(course.id, event.target.value)}
                            className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                          >
                            {slots.map((target) => <option key={target.id} value={target.id}>Mover a {target.shortLabel}</option>)}
                          </select>
                        </label>
                      </div>

                      <div className="flex gap-2 lg:flex-col">
                        <button
                          type="button"
                          onClick={() => onOpenCourse(course.id)}
                          className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                          aria-label={`Ver detalle de ${course.nombre}`}
                        >
                          <Info className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCourse(course.id, activeSlotId)}
                          className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                          aria-label={`Quitar ${course.nombre} de ${activeSlot?.label}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-[30rem] place-items-center rounded-2xl border border-dashed border-slate-300 px-6 text-center">
                <div>
                  <Plus className="mx-auto size-7 text-slate-400" />
                  <p className="mt-3 text-sm font-semibold text-slate-800">Este cuatrimestre está vacío</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Buscá una materia en “Agregar a” y tocá +. Después elegí su comisión para armar tu semana.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
