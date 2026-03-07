"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, GripVertical, Plus, Search, Sparkles, TrendingUp, Trash2 } from "lucide-react";

import type { EstadoMateria, MateriaPlan, ProgresoMaterias } from "@/types/plan";

const STORAGE_PLANNER_KEY = "tablero-materias:planificador:v1";
const MAXIMO_CREDITOS_POR_CUATRIMESTRE = 30;
const MAXIMO_EXCLUSIVO = true;
const CARGA_OBJETIVO_POR_CUATRIMESTRE = 24;

interface SlotPlanificador {
  id: string;
  label: string;
  year: number;
  period: 1 | 2;
}

interface PlannerStorageState {
  version: 2;
  slotActivoId?: string;
  planificador: Record<string, string[]>;
}

interface RoadmapSuggestion {
  slotId: string;
  materia: MateriaPlan;
  projectedCredits: number;
  reason: string;
}

interface PlanificadorCuatrisProps {
  materias: MateriaPlan[];
  progreso: ProgresoMaterias;
  materiasHabilitadas: Record<string, boolean>;
}

function generarSlotsPlanificador(cantidad = 8): SlotPlanificador[] {
  const hoy = new Date();
  let year = hoy.getFullYear();
  let period: 1 | 2 = hoy.getMonth() + 1 <= 7 ? 2 : 1;

  if (hoy.getMonth() + 1 > 7) {
    year += 1;
  }

  return Array.from({ length: cantidad }, (_, index) => {
    if (index > 0) {
      if (period === 1) {
        period = 2;
      } else {
        period = 1;
        year += 1;
      }
    }

    return {
      id: `${year}-${period}`,
      label: `${year} · ${period}° cuatrimestre`,
      year,
      period,
    };
  });
}

function parsePlannerStorage(raw: string | null): PlannerStorageState {
  if (!raw) {
    return {
      version: 2,
      planificador: {},
    };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const base =
      parsed.planificador && typeof parsed.planificador === "object"
        ? (parsed.planificador as Record<string, unknown>)
        : parsed;
    const next: Record<string, string[]> = {};

    for (const [slotId, ids] of Object.entries(base)) {
      if (Array.isArray(ids)) {
        next[slotId] = ids.filter((id): id is string => typeof id === "string");
      }
    }

    return {
      version: 2,
      slotActivoId: typeof parsed.slotActivoId === "string" ? parsed.slotActivoId : undefined,
      planificador: next,
    };
  } catch {
    return {
      version: 2,
      planificador: {},
    };
  }
}

function normalizarPlanificador(
  planificador: Record<string, string[]>,
  slots: SlotPlanificador[],
): Record<string, string[]> {
  const slotIds = new Set(slots.map((slot) => slot.id));
  const vistos = new Set<string>();
  const migradas: string[] = [];
  const normalizado: Record<string, string[]> = {};

  for (const [slotId, ids] of Object.entries(planificador)) {
    const idsUnicos = ids.filter((id) => {
      if (vistos.has(id)) return false;
      vistos.add(id);
      return true;
    });

    if (slotIds.has(slotId)) {
      normalizado[slotId] = idsUnicos;
    } else {
      migradas.push(...idsUnicos);
    }
  }

  if (migradas.length > 0 && slots[0]) {
    normalizado[slots[0].id] = [...(normalizado[slots[0].id] ?? []), ...migradas];
  }

  return normalizado;
}

function getEstadoLabel(estado: EstadoMateria, habilitada: boolean): string {
  if (estado === "aprobada") return "Aprobada";
  if (estado === "regular") return "Regular";
  if (estado === "cursando") return "Cursando";
  if (habilitada) return "Puedo cursar";
  return "Pendiente";
}

export function PlanificadorCuatris({
  materias,
  progreso,
  materiasHabilitadas,
}: PlanificadorCuatrisProps) {
  const slots = useMemo(() => generarSlotsPlanificador(), []);
  const mapaMaterias = useMemo(() => new Map(materias.map((materia) => [materia.id, materia])), [materias]);
  const [planificador, setPlanificador] = useState<Record<string, string[]>>({});
  const [slotActivoId, setSlotActivoId] = useState(slots[0]?.id ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [plannerSincronizado, setPlannerSincronizado] = useState(false);
  const [dragMateriaId, setDragMateriaId] = useState<string | null>(null);
  const [dragSourceSlotId, setDragSourceSlotId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const parsed = parsePlannerStorage(window.localStorage.getItem(STORAGE_PLANNER_KEY));
      const normalizado = normalizarPlanificador(parsed.planificador, slots);

      setPlanificador(normalizado);
      setSlotActivoId(
        parsed.slotActivoId && slots.some((slot) => slot.id === parsed.slotActivoId)
          ? parsed.slotActivoId
          : slots[0]?.id ?? "",
      );
      setPlannerSincronizado(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [slots]);

  useEffect(() => {
    if (!plannerSincronizado) return;

    const payload: PlannerStorageState = {
      version: 2,
      slotActivoId,
      planificador,
    };

    window.localStorage.setItem(STORAGE_PLANNER_KEY, JSON.stringify(payload));
  }, [planificador, plannerSincronizado, slotActivoId]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_PLANNER_KEY) return;

      const parsed = parsePlannerStorage(event.newValue);
      setPlanificador(normalizarPlanificador(parsed.planificador, slots));
      if (parsed.slotActivoId && slots.some((slot) => slot.id === parsed.slotActivoId)) {
        setSlotActivoId(parsed.slotActivoId);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [slots]);

  const materiasPlanificadasIds = useMemo(
    () => new Set(Object.values(planificador).flat()),
    [planificador],
  );

  const materiasDisponibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return materias
      .filter((materia) => materia.grupo !== "electiva-proyecto-final")
      .filter((materia) => (progreso[materia.id] ?? "pendiente") !== "aprobada")
      .filter((materia) => !materiasPlanificadasIds.has(materia.id))
      .filter((materia) => {
        if (!termino) return true;
        return (
          materia.id.toLowerCase().includes(termino) ||
          materia.nombre.toLowerCase().includes(termino)
        );
      })
      .sort((left, right) => {
        const leftEstado = progreso[left.id] ?? "pendiente";
        const rightEstado = progreso[right.id] ?? "pendiente";
        const leftScore = leftEstado === "pendiente" ? (materiasHabilitadas[left.id] ? 0 : 2) : 1;
        const rightScore = rightEstado === "pendiente" ? (materiasHabilitadas[right.id] ? 0 : 2) : 1;

        if (leftScore !== rightScore) return leftScore - rightScore;
        if (left.cuatrimestre !== right.cuatrimestre) return left.cuatrimestre - right.cuatrimestre;
        return left.id.localeCompare(right.id);
      })
      .slice(0, termino ? 12 : 8);
  }, [busqueda, materias, materiasHabilitadas, materiasPlanificadasIds, progreso]);

  const resumen = useMemo(() => {
    const totalMaterias = Object.values(planificador).reduce((acc, ids) => acc + ids.length, 0);
    const totalCreditos = Object.values(planificador).reduce((acc, ids) => {
      return (
        acc +
        ids.reduce((subtotal, id) => subtotal + (mapaMaterias.get(id)?.creditos ?? 0), 0)
      );
    }, 0);

    const slotsCargados = slots.filter((slot) => (planificador[slot.id]?.length ?? 0) > 0).length;
    const slotsExigidos = slots.filter((slot) => {
      const creditos = (planificador[slot.id] ?? []).reduce(
        (acc, id) => acc + (mapaMaterias.get(id)?.creditos ?? 0),
        0,
      );
      return creditos >= 24;
    }).length;

    return {
      totalMaterias,
      totalCreditos,
      slotsCargados,
      slotsExigidos,
    };
  }, [mapaMaterias, planificador, slots]);

  const creditosPorSlot = useMemo(() => {
    return Object.fromEntries(
      slots.map((slot) => [
        slot.id,
        (planificador[slot.id] ?? []).reduce(
          (acc, id) => acc + (mapaMaterias.get(id)?.creditos ?? 0),
          0,
        ),
      ]),
    ) as Record<string, number>;
  }, [mapaMaterias, planificador, slots]);

  const roadmapSugerido = useMemo(() => {
    const candidatos = materias
      .filter((materia) => materia.grupo !== "electiva-proyecto-final")
      .filter((materia) => (progreso[materia.id] ?? "pendiente") !== "aprobada")
      .filter((materia) => !materiasPlanificadasIds.has(materia.id))
      .sort((left, right) => {
        const leftEstado = progreso[left.id] ?? "pendiente";
        const rightEstado = progreso[right.id] ?? "pendiente";
        const leftScore =
          leftEstado === "regular" || leftEstado === "cursando"
            ? 0
            : materiasHabilitadas[left.id]
              ? 1
              : left.estadoOferta === "activa"
                ? 2
                : 3;
        const rightScore =
          rightEstado === "regular" || rightEstado === "cursando"
            ? 0
            : materiasHabilitadas[right.id]
              ? 1
              : right.estadoOferta === "activa"
                ? 2
                : 3;

        if (leftScore !== rightScore) return leftScore - rightScore;
        if (left.cuatrimestre !== right.cuatrimestre) return left.cuatrimestre - right.cuatrimestre;
        return left.id.localeCompare(right.id);
      });

    const simulacionCreditos = Object.fromEntries(
      slots.map((slot) => [slot.id, creditosPorSlot[slot.id] ?? 0]),
    ) as Record<string, number>;
    const sugerencias: RoadmapSuggestion[] = [];

    for (const materia of candidatos) {
      const slotIdeal =
        slots.find((slot) => {
          const cargaResultante = (simulacionCreditos[slot.id] ?? 0) + materia.creditos;
          return cargaResultante < CARGA_OBJETIVO_POR_CUATRIMESTRE;
        }) ??
        slots.find((slot) => {
          const cargaResultante = (simulacionCreditos[slot.id] ?? 0) + materia.creditos;
          return MAXIMO_EXCLUSIVO
            ? cargaResultante < MAXIMO_CREDITOS_POR_CUATRIMESTRE
            : cargaResultante <= MAXIMO_CREDITOS_POR_CUATRIMESTRE;
        });

      if (!slotIdeal) continue;

      simulacionCreditos[slotIdeal.id] += materia.creditos;
      sugerencias.push({
        slotId: slotIdeal.id,
        materia,
        projectedCredits: simulacionCreditos[slotIdeal.id],
        reason:
          (progreso[materia.id] ?? "pendiente") === "regular" ||
          (progreso[materia.id] ?? "pendiente") === "cursando"
            ? "Ya la tenés avanzada"
            : materiasHabilitadas[materia.id]
              ? "Ya la podés cursar"
              : materia.estadoOferta === "activa"
                ? "Conviene mirar su oferta activa"
                : "Te ayuda a sostener el roadmap",
      });

      if (sugerencias.length >= 10) break;
    }

    return sugerencias;
  }, [creditosPorSlot, materias, materiasHabilitadas, materiasPlanificadasIds, progreso, slots]);

  const roadmapPorSlot = useMemo(() => {
    return slots
      .map((slot) => ({
        slot,
        sugerencias: roadmapSugerido.filter((item) => item.slotId === slot.id),
      }))
      .filter((item) => item.sugerencias.length > 0);
  }, [roadmapSugerido, slots]);

  const moveMateria = (
    materiaId: string,
    targetSlotId: string,
    sourceSlotId: string | null,
  ) => {
    const materia = mapaMaterias.get(materiaId);
    if (!materia) return;

    setPlanificador((actual) => {
      const sourceIds = sourceSlotId ? (actual[sourceSlotId] ?? []).filter((id) => id !== materiaId) : [];
      const targetBase = (sourceSlotId === targetSlotId ? sourceIds : actual[targetSlotId] ?? []).filter(
        (id) => id !== materiaId,
      );
      const creditosResultantes = targetBase.reduce(
        (acc, id) => acc + (mapaMaterias.get(id)?.creditos ?? 0),
        0,
      ) + materia.creditos;
      const superaLimite = MAXIMO_EXCLUSIVO
        ? creditosResultantes >= MAXIMO_CREDITOS_POR_CUATRIMESTRE
        : creditosResultantes > MAXIMO_CREDITOS_POR_CUATRIMESTRE;

      if (superaLimite) {
        setError(
          `Ese cuatrimestre quedaría con ${creditosResultantes} créditos. Dejé el tope en menos de ${MAXIMO_CREDITOS_POR_CUATRIMESTRE}.`,
        );
        return actual;
      }

      const next: Record<string, string[]> = {
        ...actual,
        [targetSlotId]: [...targetBase, materiaId],
      };

      if (sourceSlotId) {
        next[sourceSlotId] = sourceIds;
      }

      setError(null);
      return next;
    });
  };

  const handleAgregarMateria = (materiaId: string) => {
    if (!slotActivoId) return;
    moveMateria(materiaId, slotActivoId, null);
  };

  const handleQuitarMateria = (slotId: string, materiaId: string) => {
    setPlanificador((actual) => ({
      ...actual,
      [slotId]: (actual[slotId] ?? []).filter((id) => id !== materiaId),
    }));
  };

  const limpiarPlanificador = () => {
    setPlanificador({});
    setError(null);
  };

  const handleDragStart = (materiaId: string, sourceSlotId: string | null) => {
    setDragMateriaId(materiaId);
    setDragSourceSlotId(sourceSlotId);
  };

  const clearDragState = () => {
    setDragMateriaId(null);
    setDragSourceSlotId(null);
    setDragOverSlotId(null);
  };

  const handleDropOnSlot = (targetSlotId: string) => {
    if (!dragMateriaId) return;
    moveMateria(dragMateriaId, targetSlotId, dragSourceSlotId);
    clearDragState();
  };

  return (
    <section className="mx-auto w-full max-w-[1800px] px-4 pb-4">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-4 shadow-[0_18px_40px_rgba(2,6,23,0.35)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-cyan-300" />
              <h3 className="text-lg font-semibold text-slate-100">Planificador por cuatrimestre</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Armá una hoja de ruta futura sin pasar el límite de menos de 30 créditos por
              cuatrimestre. Ahora arranca desde el próximo cuatrimestre, así no mezclás lo que ya está
              en curso con lo que querés proyectar hacia adelante.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-slate-300">
              {resumen.totalMaterias} materias planeadas
            </span>
            <span className="rounded-full border border-cyan-500/40 bg-cyan-950/25 px-3 py-1 text-cyan-200">
              {resumen.totalCreditos} créditos proyectados
            </span>
            <span className="rounded-full border border-violet-500/40 bg-violet-950/25 px-3 py-1 text-violet-200">
              {resumen.slotsCargados} cuatris con plan
            </span>
            <span className="rounded-full border border-amber-500/40 bg-amber-950/25 px-3 py-1 text-amber-200">
              {resumen.slotsExigidos} cuatris exigidos (24+ cr)
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Próximo cuatrimestre activo
              </label>
              <select
                value={slotActivoId}
                onChange={(event) => setSlotActivoId(event.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              >
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label}
                  </option>
                ))}
              </select>

              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar materia para agregar"
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400"
                />
              </label>

              <div className="space-y-2">
                {materiasDisponibles.length > 0 ? (
                  materiasDisponibles.map((materia) => {
                    const estado = (progreso[materia.id] ?? "pendiente") as EstadoMateria;
                    return (
                      <button
                        key={`${slotActivoId}-${materia.id}`}
                        type="button"
                        onClick={() => handleAgregarMateria(materia.id)}
                        draggable
                        onDragStart={() => handleDragStart(materia.id, null)}
                        onDragEnd={clearDragState}
                        className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left transition-colors hover:border-slate-600 hover:bg-slate-950"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-400">{materia.id}</span>
                            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                              {getEstadoLabel(estado, materiasHabilitadas[materia.id] ?? false)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-slate-100">{materia.nombre}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {materia.creditos} cr · cuatri sugerido {materia.cuatrimestre}
                          </p>
                        </div>
                        <div className="mt-0.5 flex shrink-0 items-center gap-2 text-cyan-300">
                          <GripVertical className="h-4 w-4 text-slate-500" />
                          <Plus className="h-4 w-4" />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">
                    No hay materias para mostrar con esa búsqueda.
                  </div>
                )}
              </div>

              {error ? <p className="text-xs text-rose-400">{error}</p> : null}

              <button
                type="button"
                onClick={limpiarPlanificador}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-900 hover:text-slate-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar planificación
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <section className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-300" />
                  <h4 className="text-sm font-semibold text-slate-100">Mapa visual de carga</h4>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  La franja ideal está cerca de {CARGA_OBJETIVO_POR_CUATRIMESTRE} cr; si te acercás a 30, el cuatri ya queda muy exigido.
                </p>

                <div className="mt-5 flex min-h-[12rem] items-end gap-3 overflow-x-auto pb-2">
                  {slots.map((slot) => {
                    const creditos = creditosPorSlot[slot.id] ?? 0;
                    const altura = Math.max(10, (creditos / (MAXIMO_CREDITOS_POR_CUATRIMESTRE - 1)) * 160);
                    const enRangoIdeal = creditos >= 18 && creditos <= CARGA_OBJETIVO_POR_CUATRIMESTRE;

                    return (
                      <div key={`chart-${slot.id}`} className="flex min-w-[6rem] flex-1 flex-col items-center gap-2">
                        <div className="text-[10px] text-slate-500">{creditos} cr</div>
                        <div className="flex h-44 w-full items-end justify-center rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                          <div
                            className={`w-full rounded-xl transition-all ${
                              creditos >= 27
                                ? "bg-amber-400"
                                : enRangoIdeal
                                  ? "bg-emerald-400"
                                  : "bg-cyan-400"
                            }`}
                            style={{ height: `${altura}px` }}
                          />
                        </div>
                        <div className="text-center text-[11px] text-slate-400">{slot.label}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-cyan-900/50 bg-cyan-950/10 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  <h4 className="text-sm font-semibold text-cyan-100">Roadmap sugerido</h4>
                </div>
                <p className="mt-2 text-xs text-cyan-200/75">
                  Ordeno materias para que el camino futuro quede balanceado y con prioridad en lo que ya podés cursar o ya tenés avanzado.
                </p>

                <div className="mt-4 space-y-3">
                  {roadmapPorSlot.length > 0 ? (
                    roadmapPorSlot.map(({ slot, sugerencias }) => (
                      <article
                        key={`roadmap-${slot.id}`}
                        className="rounded-2xl border border-cyan-900/40 bg-slate-950/55 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h5 className="text-sm font-semibold text-slate-100">{slot.label}</h5>
                            <p className="mt-1 text-[11px] text-slate-500">
                              Si sumaras estas sugerencias, quedarías cerca de una carga más pareja.
                            </p>
                          </div>
                          <span className="rounded-full border border-cyan-500/40 bg-cyan-950/20 px-2 py-0.5 text-[10px] text-cyan-100">
                            Base actual: {creditosPorSlot[slot.id] ?? 0} cr
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {sugerencias.map((item) => (
                            <div
                              key={`roadmap-item-${slot.id}-${item.materia.id}`}
                              className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-[11px] text-cyan-200/80">{item.materia.id}</span>
                                  <span className="text-sm font-medium text-slate-100">{item.materia.nombre}</span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {item.reason} · quedaría en {item.projectedCredits} cr si la sumás acá.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => moveMateria(item.materia.id, slot.id, null)}
                                className="cursor-pointer rounded-lg border border-cyan-500/60 bg-cyan-500/10 px-3 py-2 text-[11px] font-medium text-cyan-100 transition-colors hover:border-cyan-300 hover:bg-cyan-500/20"
                              >
                                Agregar
                              </button>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-cyan-900/60 px-4 py-10 text-center text-xs text-cyan-200/65">
                      Ya no quedan sugerencias claras para sumar: el roadmap actual está bastante ordenado.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {slots.map((slot) => {
              const materiasSlot = (planificador[slot.id] ?? [])
                .map((id) => mapaMaterias.get(id))
                .filter((materia): materia is MateriaPlan => Boolean(materia));
              const creditosSlot = materiasSlot.reduce((acc, materia) => acc + materia.creditos, 0);
              const estaCargado = materiasSlot.length > 0;
              const estaExigido = creditosSlot >= 24;

              return (
                <article
                  key={slot.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverSlotId(slot.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverSlotId === slot.id) {
                      setDragOverSlotId(null);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleDropOnSlot(slot.id);
                  }}
                  className={`rounded-2xl border p-4 transition-colors ${
                    slotActivoId === slot.id
                      ? "border-cyan-500/70 bg-cyan-950/10"
                      : "border-slate-800 bg-slate-950/45"
                  } ${dragOverSlotId === slot.id ? "ring-2 ring-cyan-400/60" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setSlotActivoId(slot.id)}
                    className="mb-3 w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-100">{slot.label}</h4>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          estaExigido
                            ? "border-amber-500/50 bg-amber-950/20 text-amber-200"
                            : estaCargado
                              ? "border-cyan-500/40 bg-cyan-950/20 text-cyan-200"
                              : "border-slate-700 text-slate-400"
                        }`}
                      >
                        {creditosSlot} cr
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {estaExigido
                        ? "Carga alta pero dentro del rango fuerte."
                        : estaCargado
                          ? "Cuatrimestre planificado."
                          : "Todavía no sumaste materias."}
                    </p>
                  </button>

                  <div className="space-y-2">
                    {materiasSlot.length > 0 ? (
                      materiasSlot.map((materia) => {
                        const estado = (progreso[materia.id] ?? "pendiente") as EstadoMateria;
                        return (
                          <div
                            key={`${slot.id}-${materia.id}`}
                            draggable
                            onDragStart={() => handleDragStart(materia.id, slot.id)}
                            onDragEnd={clearDragState}
                            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-3.5 w-3.5 text-slate-500" />
                                  <p className="font-mono text-[11px] text-slate-400">{materia.id}</p>
                                </div>
                                <p className="mt-1 text-sm font-medium text-slate-100">{materia.nombre}</p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {materia.creditos} cr · {getEstadoLabel(estado, materiasHabilitadas[materia.id] ?? false)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleQuitarMateria(slot.id, materia.id)}
                                className="rounded-lg border border-slate-700 p-1 text-slate-400 transition-colors hover:border-rose-400 hover:text-rose-200"
                                aria-label={`Quitar ${materia.nombre} del cuatrimestre ${slot.label}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">
                        Sin materias todavía.
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
