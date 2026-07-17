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
} from "lucide-react";

import { PlannerSchedule } from "@/components/PlannerSchedule";
import {
  findOffering,
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

interface Slot {
  id: string;
  label: string;
  shortLabel: string;
  year: number;
  period: AcademicPeriod;
}

interface PlannerStorage {
  active?: string;
  plan: Record<string, string[]>;
  commissions: Record<string, Record<string, string>>;
}

interface PlannerViewProps {
  materias: MateriaPlan[];
  progreso: ProgresoMaterias;
  materiasHabilitadas: Record<string, boolean>;
  onOpenCourse: (materiaId: string) => void;
}

type PlannerPanel = "materias" | "horario";

function createSlots(count = 6): Slot[] {
  const today = new Date();
  let year = today.getFullYear();
  let period: AcademicPeriod = today.getMonth() + 1 <= 7 ? 2 : 1;
  if (today.getMonth() + 1 > 7) year += 1;

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

function parseCommissions(value: unknown): Record<string, Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, Record<string, string>> = {};
  for (const [slotId, selections] of Object.entries(value)) {
    if (!selections || typeof selections !== "object" || Array.isArray(selections)) continue;
    const validSelections: Record<string, string> = {};
    for (const [courseId, commissionId] of Object.entries(selections)) {
      if (typeof commissionId === "string") validSelections[courseId] = commissionId;
    }
    result[slotId] = validSelections;
  }
  return result;
}

function parseStorage(raw: string | null): PlannerStorage {
  if (!raw) return { plan: {}, commissions: {} };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const source =
      parsed.planificador && typeof parsed.planificador === "object"
        ? (parsed.planificador as Record<string, unknown>)
        : parsed;
    const plan: Record<string, string[]> = {};
    for (const [slotId, ids] of Object.entries(source)) {
      if (Array.isArray(ids)) plan[slotId] = ids.filter((id): id is string => typeof id === "string");
    }
    return {
      active: typeof parsed.slotActivoId === "string" ? parsed.slotActivoId : undefined,
      plan,
      commissions: parseCommissions(parsed.comisiones),
    };
  } catch {
    return { plan: {}, commissions: {} };
  }
}

export function PlannerView({
  materias,
  progreso,
  materiasHabilitadas,
  onOpenCourse,
}: PlannerViewProps) {
  const slots = useMemo(() => createSlots(), []);
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = parseStorage(window.localStorage.getItem(STORAGE_PLANNER_KEY));
      const validSlots = new Set(slots.map((slot) => slot.id));
      const seen = new Set<string>();
      const normalized: Record<string, string[]> = {};
      const migrated: string[] = [];

      for (const [slotId, ids] of Object.entries(stored.plan)) {
        const unique = ids.filter((id) => {
          if (!courseMap.has(id) || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        if (validSlots.has(slotId)) normalized[slotId] = unique;
        else migrated.push(...unique);
      }
      if (migrated.length > 0 && slots[0]) {
        normalized[slots[0].id] = [...(normalized[slots[0].id] ?? []), ...migrated];
      }

      const normalizedCommissions: Record<string, Record<string, string>> = {};
      for (const [slotId, selections] of Object.entries(stored.commissions)) {
        if (!validSlots.has(slotId)) continue;
        const planned = new Set(normalized[slotId] ?? []);
        normalizedCommissions[slotId] = Object.fromEntries(
          Object.entries(selections).filter(([courseId]) => planned.has(courseId)),
        );
      }

      setPlan(normalized);
      setCommissionSelections(normalizedCommissions);
      if (stored.active && validSlots.has(stored.active)) setActiveSlotId(stored.active);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [courseMap, slots]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_PLANNER_KEY,
      JSON.stringify({
        version: 3,
        slotActivoId: activeSlotId,
        planificador: plan,
        comisiones: commissionSelections,
      }),
    );
  }, [activeSlotId, commissionSelections, hydrated, plan]);

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
  }, []);

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
      activeCourses.map((course) => ({
        course,
        offering: activeSlot
          ? findOffering(offerings, course.id, activeSlot.year, activeSlot.period)
          : undefined,
      })),
    [activeCourses, activeSlot, offerings],
  );
  const activeEvents = useMemo(() => {
    if (!activeSlot) return [];
    const events: PlannerScheduleEvent[] = [];
    for (const { course, offering } of activeScheduleRows) {
      const selectedId = commissionSelections[activeSlot.id]?.[course.id];
      const commission = offering?.commissions.find((item) => item.id === selectedId);
      if (!commission) continue;
      commission.meetings.forEach((meeting, index) => {
        events.push({
          ...meeting,
          id: `${course.id}:${commission.id}:${index}`,
          courseId: course.id,
          courseName: course.nombre,
          commissionId: commission.id,
          commissionName: commission.name,
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

  const available = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return materias
      .filter((materia) => progreso[materia.id] !== "aprobada")
      .filter((materia) => !plannedIds.has(materia.id))
      .filter((materia) => materia.grupo !== "electiva-proyecto-final" || materia.estadoOferta !== "inactiva")
      .filter(
        (materia) =>
          showAll ||
          materiasHabilitadas[materia.id] ||
          progreso[materia.id] === "regular" ||
          progreso[materia.id] === "cursando",
      )
      .filter(
        (materia) =>
          !term ||
          materia.id.toLocaleLowerCase("es").includes(term) ||
          materia.nombre.toLocaleLowerCase("es").includes(term),
      )
      .sort((left, right) => {
        const leftScore = materiasHabilitadas[left.id] ? 0 : 1;
        const rightScore = materiasHabilitadas[right.id] ? 0 : 1;
        if (leftScore !== rightScore) return leftScore - rightScore;
        if (left.cuatrimestre !== right.cuatrimestre) return left.cuatrimestre - right.cuatrimestre;
        return left.id.localeCompare(right.id);
      })
      .slice(0, term ? 50 : showAll ? 20 : 12);
  }, [materias, materiasHabilitadas, plannedIds, progreso, search, showAll]);

  const moveCourse = (courseId: string, targetSlotId: string) => {
    const course = courseMap.get(courseId);
    if (!course) return;
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
    setPlan(next);
    setError(null);
  };

  const removeCourse = (courseId: string, slotId: string) => {
    setPlan((current) => ({ ...current, [slotId]: (current[slotId] ?? []).filter((id) => id !== courseId) }));
    setCommissionSelections((current) => {
      const updated = { ...current, [slotId]: { ...(current[slotId] ?? {}) } };
      delete updated[slotId][courseId];
      return updated;
    });
    setError(null);
  };

  const selectCommission = (courseId: string, commissionId: string) => {
    setCommissionSelections((current) => {
      const slotSelections = { ...(current[activeSlotId] ?? {}) };
      if (commissionId) slotSelections[courseId] = commissionId;
      else delete slotSelections[courseId];
      return { ...current, [activeSlotId]: slotSelections };
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <CalendarDays className="size-3.5" /> Materias + horarios reales
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Armá un cuatri a la vez.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Elegí un período, sumá materias y asigná comisiones. La lista queda contenida aunque agregues muchas y el calendario te marca superposiciones.
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
            <p className="mt-0.5 text-xs text-slate-500">Seleccioná un cuatri para editarlo sin abrir seis listas largas.</p>
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
                onClick={() => setActiveSlotId(slot.id)}
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
            onChange={(event) => setActiveSlotId(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
          </select>

          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
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
          <div className="mt-2 max-h-[32rem] space-y-2 overflow-y-auto pr-1 xl:flex-1">
            {available.length > 0 ? available.map((materia) => {
              const ready = materiasHabilitadas[materia.id];
              return (
                <div key={`available-${materia.id}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] font-semibold text-slate-500">{materia.id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${ready ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                          {ready ? "Podés cursar" : "Con correlativas"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{materia.nombre}</p>
                      <p className="mt-1 text-xs text-slate-500">{materia.creditos} cr</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => moveCourse(materia.id, activeSlotId)}
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
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
              <p className="mt-1 text-xs text-slate-500">{activeCourses.length} materias · {creditsBySlot[activeSlotId] ?? 0} créditos</p>
            </div>
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Vista del cuatrimestre">
              <button
                type="button"
                role="tab"
                aria-selected={activePanel === "materias"}
                onClick={() => setActivePanel("materias")}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold ${activePanel === "materias" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
              >
                <ListChecks className="size-3.5" /> Materias
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanel === "horario"}
                onClick={() => setActivePanel("horario")}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold ${activePanel === "horario" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}
              >
                <Clock3 className="size-3.5" /> Horario
                {selectedScheduleCount > 0 ? <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] text-blue-700">{selectedScheduleCount}</span> : null}
              </button>
            </div>
          </div>

          <div className="pt-4" role="tabpanel">
            {activePanel === "horario" ? (
              <PlannerSchedule
                events={activeEvents}
                activeLabel={activeSlot?.label ?? "Cuatrimestre"}
                subjectsCount={activeCourses.length}
                selectedCount={selectedScheduleCount}
                loading={scheduleLoading}
                sourceError={scheduleError}
              />
            ) : activeCourses.length > 0 ? (
              <div className="max-h-[39rem] space-y-2 overflow-y-auto pr-1">
                {activeScheduleRows.map(({ course, offering }) => {
                  const selectedCommission = commissionSelections[activeSlotId]?.[course.id] ?? "";
                  return (
                    <article key={`${activeSlotId}-${course.id}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,24rem)_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-500">{course.id}</span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm">{course.creditos} cr</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${materiasHabilitadas[course.id] ? "bg-indigo-100 text-indigo-700" : "bg-amber-50 text-amber-800"}`}>
                            {materiasHabilitadas[course.id] ? "Habilitada" : "Revisar correlativas"}
                          </span>
                        </div>
                        <h4 className="mt-1.5 text-sm font-semibold leading-snug text-slate-950">{course.nombre}</h4>
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
                                  ? "Elegir comisión"
                                  : "Horarios todavía no publicados"}
                            </option>
                            {offering?.commissions.map((commission) => (
                              <option key={commission.id} value={commission.id}>{formatCommission(commission)}</option>
                            ))}
                          </select>
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
                  <p className="mt-1 text-xs text-slate-500">Elegí materias desde el panel izquierdo. Esta vista no va a crecer más allá de la pantalla.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
