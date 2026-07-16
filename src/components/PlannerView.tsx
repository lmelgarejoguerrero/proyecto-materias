"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Info, Plus, Search, Trash2 } from "lucide-react";

import type { MateriaPlan, ProgresoMaterias } from "@/types/plan";

const STORAGE_PLANNER_KEY = "tablero-materias:planificador:v1";
const MAX_CREDITS = 30;
const IDEAL_CREDITS = 24;

interface Slot {
  id: string;
  label: string;
  shortLabel: string;
}

interface PlannerViewProps {
  materias: MateriaPlan[];
  progreso: ProgresoMaterias;
  materiasHabilitadas: Record<string, boolean>;
  onOpenCourse: (materiaId: string) => void;
}

function createSlots(count = 6): Slot[] {
  const today = new Date();
  let year = today.getFullYear();
  let period: 1 | 2 = today.getMonth() + 1 <= 7 ? 2 : 1;
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
    };
  });
}

function parseStorage(raw: string | null): { active?: string; plan: Record<string, string[]> } {
  if (!raw) return { plan: {} };
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
    return { active: typeof parsed.slotActivoId === "string" ? parsed.slotActivoId : undefined, plan };
  } catch {
    return { plan: {} };
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
  const [activeSlotId, setActiveSlotId] = useState(slots[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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
      if (migrated.length && slots[0]) normalized[slots[0].id] = [...(normalized[slots[0].id] ?? []), ...migrated];
      setPlan(normalized);
      if (stored.active && validSlots.has(stored.active)) setActiveSlotId(stored.active);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [courseMap, slots]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_PLANNER_KEY,
      JSON.stringify({ version: 2, slotActivoId: activeSlotId, planificador: plan }),
    );
  }, [activeSlotId, hydrated, plan]);

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

  const available = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return materias
      .filter((materia) => progreso[materia.id] !== "aprobada")
      .filter((materia) => !plannedIds.has(materia.id))
      .filter((materia) => materia.grupo !== "electiva-proyecto-final" || materia.estadoOferta !== "inactiva")
      .filter(
        (materia) =>
          !term ||
          materia.id.toLocaleLowerCase("es").includes(term) ||
          materia.nombre.toLocaleLowerCase("es").includes(term),
      )
      .sort((a, b) => {
        const aScore = progreso[a.id] === "regular" || progreso[a.id] === "cursando" ? 0 : materiasHabilitadas[a.id] ? 1 : 2;
        const bScore = progreso[b.id] === "regular" || progreso[b.id] === "cursando" ? 0 : materiasHabilitadas[b.id] ? 1 : 2;
        if (aScore !== bScore) return aScore - bScore;
        if (a.cuatrimestre !== b.cuatrimestre) return a.cuatrimestre - b.cuatrimestre;
        return a.id.localeCompare(b.id);
      })
      .slice(0, term ? 24 : 10);
  }, [materias, materiasHabilitadas, plannedIds, progreso, search]);

  const moveCourse = (courseId: string, targetSlotId: string) => {
    const course = courseMap.get(courseId);
    if (!course) return;
    setPlan((current) => {
      const sourceSlot = slots.find((slot) => (current[slot.id] ?? []).includes(courseId))?.id;
      const targetWithoutCourse = (current[targetSlotId] ?? []).filter((id) => id !== courseId);
      const resultCredits = targetWithoutCourse.reduce(
        (total, id) => total + (courseMap.get(id)?.creditos ?? 0),
        course.creditos,
      );
      if (resultCredits > MAX_CREDITS) {
        setError(`${course.nombre} dejaría ese cuatrimestre en ${resultCredits} créditos. El máximo es ${MAX_CREDITS}.`);
        return current;
      }
      const next = { ...current, [targetSlotId]: [...targetWithoutCourse, courseId] };
      if (sourceSlot && sourceSlot !== targetSlotId) {
        next[sourceSlot] = (current[sourceSlot] ?? []).filter((id) => id !== courseId);
      }
      setError(null);
      return next;
    });
  };

  const removeCourse = (courseId: string, slotId: string) => {
    setPlan((current) => ({ ...current, [slotId]: (current[slotId] ?? []).filter((id) => id !== courseId) }));
    setError(null);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <CalendarDays className="size-3.5" /> Próximos 6 cuatrimestres
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Planificá con contexto, no a ciegas.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Elegí un cuatrimestre y agregá materias. Para reorganizar, usá “Mover a”; funciona igual de bien con mouse, teclado o touch.
            </p>
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

      <div className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-28">
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
              placeholder="Buscar para agregar"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <p className="mt-4 text-xs font-semibold text-slate-500">
            {search ? `${available.length} resultados` : "Sugeridas para tu próximo paso"}
          </p>
          <div className="mt-2 max-h-[34rem] space-y-2 overflow-y-auto pr-1">
            {available.map((materia) => {
              const ready = materiasHabilitadas[materia.id];
              return (
                <div key={`available-${materia.id}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] font-semibold text-slate-500">{materia.id}</span>
                        {ready ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700">Podés cursar</span> : null}
                      </div>
                      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{materia.nombre}</p>
                      <p className="mt-1 text-xs text-slate-500">{materia.creditos} cr</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => moveCourse(materia.id, activeSlotId)}
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      aria-label={`Agregar ${materia.nombre} a ${slots.find((slot) => slot.id === activeSlotId)?.label}`}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700" role="alert">{error}</p> : null}
        </aside>

        <section>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {slots.map((slot) => {
              const slotCourses = (plan[slot.id] ?? [])
                .map((id) => courseMap.get(id))
                .filter((materia): materia is MateriaPlan => Boolean(materia));
              const credits = creditsBySlot[slot.id] ?? 0;
              const percent = Math.min(100, (credits / MAX_CREDITS) * 100);
              const high = credits > IDEAL_CREDITS;
              return (
                <article
                  key={slot.id}
                  className={`rounded-[1.75rem] border bg-white p-4 shadow-sm transition ${
                    activeSlotId === slot.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSlotId(slot.id)}
                    className="w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">{slot.shortLabel}</p>
                        <h3 className="mt-1 text-base font-semibold text-slate-950">{slot.label}</h3>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${high ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                        {credits} cr
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${high ? "bg-amber-500" : "bg-blue-600"}`} style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {credits === 0 ? "Elegí este cuatri para empezar." : high ? "Carga alta: revisá si querés mover algo." : `Carga objetivo: cerca de ${IDEAL_CREDITS} cr.`}
                    </p>
                  </button>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {slotCourses.length > 0 ? (
                      slotCourses.map((materia) => (
                        <div key={`${slot.id}-${materia.id}`} className="rounded-2xl bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-mono text-[10px] font-semibold text-slate-500">{materia.id}</span>
                              <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{materia.nombre}</p>
                              <p className="mt-1 text-xs text-slate-500">{materia.creditos} cr</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenCourse(materia.id)}
                              className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                              aria-label={`Ver detalle de ${materia.nombre}`}
                            >
                              <Info className="size-4" />
                            </button>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <select
                              value={slot.id}
                              onChange={(event) => moveCourse(materia.id, event.target.value)}
                              aria-label={`Mover ${materia.nombre} a otro cuatrimestre`}
                              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                            >
                              {slots.map((target) => <option key={target.id} value={target.id}>Mover a {target.shortLabel}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => removeCourse(materia.id, slot.id)}
                              className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-rose-300 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                              aria-label={`Quitar ${materia.nombre} de ${slot.label}`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveSlotId(slot.id)}
                        className="min-h-28 w-full rounded-2xl border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        + Agregar materias acá
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
