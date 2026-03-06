"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, GraduationCap, Layers3, ListChecks, Sparkles, Target } from "lucide-react";

import {
  enriquecerMateriasConMinors,
  MINOR_COLORES,
  MINOR_DESCRIPTIONS,
  MINOR_LABELS,
  MINOR_OPTIONS,
} from "@/data/minorsMetadata";
import planRaw from "@/data/planDeEstudio.json";
import { getMateriasMinor } from "@/lib/planUtils";
import { useProgreso } from "@/hooks/useProgreso";
import type { EstadoMateria, MateriaPlan, MinorTag, PlanDeEstudio } from "@/types/plan";

const plan = planRaw as PlanDeEstudio;
const STORAGE_MINORS = "malla-curricular:minors:v1";
const STORAGE_PLAN_MINORS = "malla-curricular:plan-minors:v1";
const OBJETIVO_MINOR = 45;

const ETIQUETA_ESTADO: Record<EstadoMateria, string> = {
  pendiente: "Pendiente",
  cursando: "Cursando",
  regular: "Regular",
  aprobada: "Aprobada",
};

const COLOR_ESTADO: Record<EstadoMateria, string> = {
  pendiente: "text-slate-500",
  cursando: "text-sky-400",
  regular: "text-amber-400",
  aprobada: "text-emerald-400",
};

function parseMinors(raw: string | null): MinorTag[] {
  if (!raw) return [];

  try {
    const arr = JSON.parse(raw) as unknown[];
    return arr.filter(
      (minor): minor is MinorTag =>
        typeof minor === "string" && MINOR_OPTIONS.includes(minor as MinorTag),
    );
  } catch {
    return [];
  }
}

function parsePlanMinors(raw: string | null): Set<string> {
  if (!raw) return new Set();

  try {
    const arr = JSON.parse(raw) as unknown[];
    return new Set(arr.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function esElectivaMinor(materia: MateriaPlan): boolean {
  return (
    (materia.grupo === "electiva-gestion" || materia.grupo === "electiva-sistemas-tecnologia") &&
    (materia.minorTags?.length ?? 0) > 0
  );
}

function sumarCreditos(materias: MateriaPlan[]): number {
  return materias.reduce((total, materia) => total + materia.creditos, 0);
}

function obtenerCantidadMinorsCompartidos(materia: MateriaPlan, selectedMinors: MinorTag[]): number {
  return (materia.minorTags ?? []).filter((minor) => selectedMinors.includes(minor)).length;
}

interface MateriaMinorRowProps {
  materia: MateriaPlan;
  checked: boolean;
  disabled: boolean;
  estado: EstadoMateria;
  esCompartida: boolean;
  selectedMinors: MinorTag[];
  onToggle: (id: string) => void;
}

function MateriaMinorRow({
  materia,
  checked,
  disabled,
  estado,
  esCompartida,
  selectedMinors,
  onToggle,
}: MateriaMinorRowProps) {
  const minorsActivos = (materia.minorTags ?? []).filter((minor) => selectedMinors.includes(minor));

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
        checked ? "border-violet-500/50 bg-violet-950/20" : "border-slate-800 bg-slate-950/45"
      } ${disabled ? "cursor-not-allowed" : "hover:border-slate-700 hover:bg-slate-950/70"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(materia.id)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-violet-400 disabled:opacity-60"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400">{materia.id}</span>
          <span className="min-w-0 flex-1 truncate text-slate-100">{materia.nombre}</span>
          <span className="shrink-0 text-slate-500">{materia.creditos} cr</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-medium ${COLOR_ESTADO[estado]}`}>
            {ETIQUETA_ESTADO[estado]}
          </span>
          {esCompartida ? (
            <span className="rounded-full border border-cyan-500/40 bg-cyan-950/30 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
              Compartida
            </span>
          ) : null}
          {minorsActivos.map((minor) => (
            <span
              key={`${materia.id}-${minor}`}
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
              style={{
                borderColor: `${MINOR_COLORES[minor]}55`,
                color: MINOR_COLORES[minor],
                backgroundColor: `${MINOR_COLORES[minor]}14`,
              }}
            >
              {MINOR_LABELS[minor]}
            </span>
          ))}
        </div>
      </div>
    </label>
  );
}

export function SeccionMinors() {
  const materias = useMemo(() => enriquecerMateriasConMinors(plan.materias), []);
  const { progreso, materiasHabilitadas } = useProgreso(materias);

  const electivasMinor = useMemo(() => materias.filter(esElectivaMinor), [materias]);
  const mapaMaterias = useMemo(() => new Map(materias.map((materia) => [materia.id, materia])), [materias]);

  const [selectedMinors, setSelectedMinors] = useState<MinorTag[]>([]);
  const [materiasPlanIds, setMateriasPlanIds] = useState<Set<string>>(new Set());
  const [codigoInput, setCodigoInput] = useState("");
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setSelectedMinors(parseMinors(window.localStorage.getItem(STORAGE_MINORS)));
      setMateriasPlanIds(parsePlanMinors(window.localStorage.getItem(STORAGE_PLAN_MINORS)));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_MINORS, JSON.stringify(selectedMinors));
  }, [selectedMinors]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_PLAN_MINORS, JSON.stringify([...materiasPlanIds]));
  }, [materiasPlanIds]);

  const materiasConEstadoIds = useMemo(
    () =>
      new Set(
        electivasMinor
          .filter((materia) => (progreso[materia.id] ?? "pendiente") !== "pendiente")
          .map((materia) => materia.id),
      ),
    [electivasMinor, progreso],
  );

  const materiasEnPlanIds = useMemo(
    () => new Set([...materiasPlanIds, ...materiasConEstadoIds]),
    [materiasPlanIds, materiasConEstadoIds],
  );

  const materiasVisibles = useMemo(() => {
    if (selectedMinors.length === 0) return electivasMinor;

    return electivasMinor.filter((materia) =>
      (materia.minorTags ?? []).some((minor) => selectedMinors.includes(minor)),
    );
  }, [electivasMinor, selectedMinors]);

  const materiasCompartidas = useMemo(() => {
    if (selectedMinors.length < 2) return [];

    return electivasMinor.filter(
      (materia) => obtenerCantidadMinorsCompartidos(materia, selectedMinors) >= 2,
    );
  }, [electivasMinor, selectedMinors]);

  const materiasCompartidasEnPlan = useMemo(
    () => materiasCompartidas.filter((materia) => materiasEnPlanIds.has(materia.id)),
    [materiasCompartidas, materiasEnPlanIds],
  );

  const creditosVisiblesEnPlan = useMemo(
    () => sumarCreditos(materiasVisibles.filter((materia) => materiasEnPlanIds.has(materia.id))),
    [materiasVisibles, materiasEnPlanIds],
  );

  const creditosVisiblesAprobados = useMemo(
    () =>
      sumarCreditos(
        materiasVisibles.filter((materia) => (progreso[materia.id] ?? "pendiente") === "aprobada"),
      ),
    [materiasVisibles, progreso],
  );

  const minorSummaries = useMemo(
    () =>
      selectedMinors.map((minor) => {
        const materiasDelMinor = getMateriasMinor(electivasMinor, minor);
        const materiasGestion = materiasDelMinor.filter((materia) => materia.grupo === "electiva-gestion");
        const materiasTecnologia = materiasDelMinor.filter(
          (materia) => materia.grupo === "electiva-sistemas-tecnologia",
        );
        const materiasPlanificadas = materiasDelMinor.filter((materia) => materiasEnPlanIds.has(materia.id));
        const materiasAprobadas = materiasDelMinor.filter(
          (materia) => (progreso[materia.id] ?? "pendiente") === "aprobada",
        );
        const materiasCompartidasMinor = materiasDelMinor.filter(
          (materia) => obtenerCantidadMinorsCompartidos(materia, selectedMinors) >= 2,
        );

        return {
          minor,
          materiasTotal: materiasDelMinor.length,
          materiasGestion,
          materiasTecnologia,
          materiasCompartidas: materiasCompartidasMinor,
          materiasPendientes: materiasDelMinor.filter(
            (materia) => (progreso[materia.id] ?? "pendiente") === "pendiente",
          ),
          creditosPlanificados: sumarCreditos(materiasPlanificadas),
          creditosAprobados: sumarCreditos(materiasAprobadas),
          creditosGestionPlanificados: sumarCreditos(
            materiasGestion.filter((materia) => materiasEnPlanIds.has(materia.id)),
          ),
          creditosTecnologiaPlanificados: sumarCreditos(
            materiasTecnologia.filter((materia) => materiasEnPlanIds.has(materia.id)),
          ),
        };
      }),
    [electivasMinor, materiasEnPlanIds, progreso, selectedMinors],
  );

  const comparativaMinors = useMemo(
    () =>
      [...minorSummaries]
        .map((summary) => {
          const creditosFaltantes = Math.max(0, OBJETIVO_MINOR - summary.creditosPlanificados);
          const materiasPendientesActivas = summary.materiasPendientes.filter(
            (materia) => materia.estadoOferta !== "inactiva",
          ).length;

          return {
            ...summary,
            creditosFaltantes,
            porcentajeCubierto: Math.min(100, (summary.creditosPlanificados / OBJETIVO_MINOR) * 100),
            materiasPendientesActivas,
          };
        })
        .sort((left, right) => {
          if (left.creditosPlanificados !== right.creditosPlanificados) {
            return right.creditosPlanificados - left.creditosPlanificados;
          }
          if (left.creditosAprobados !== right.creditosAprobados) {
            return right.creditosAprobados - left.creditosAprobados;
          }
          return left.creditosFaltantes - right.creditosFaltantes;
        }),
    [minorSummaries],
  );

  const recomendaciones = useMemo(() => {
    if (selectedMinors.length === 0) return [];

    return materiasVisibles
      .filter((materia) => !materiasEnPlanIds.has(materia.id))
      .filter((materia) => (progreso[materia.id] ?? "pendiente") === "pendiente")
      .map((materia) => ({
        materia,
        overlap: obtenerCantidadMinorsCompartidos(materia, selectedMinors),
        habilitada: materiasHabilitadas[materia.id] ?? false,
        ofertaActiva: materia.estadoOferta !== "inactiva",
      }))
      .sort((left, right) => {
        if (left.overlap !== right.overlap) return right.overlap - left.overlap;
        if (left.habilitada !== right.habilitada) return Number(right.habilitada) - Number(left.habilitada);
        if (left.ofertaActiva !== right.ofertaActiva) {
          return Number(right.ofertaActiva) - Number(left.ofertaActiva);
        }
        if (left.materia.cuatrimestre !== right.materia.cuatrimestre) {
          return left.materia.cuatrimestre - right.materia.cuatrimestre;
        }
        return left.materia.id.localeCompare(right.materia.id);
      })
      .slice(0, 6);
  }, [materiasEnPlanIds, materiasHabilitadas, materiasVisibles, progreso, selectedMinors]);

  const handleToggleMinor = useCallback((minor: MinorTag) => {
    setSelectedMinors((actual) =>
      actual.includes(minor) ? actual.filter((item) => item !== minor) : [...actual, minor],
    );
  }, []);

  const toggleMateriaPlan = useCallback(
    (id: string) => {
      if (materiasConEstadoIds.has(id)) return;

      setMateriasPlanIds((actual) => {
        const next = new Set(actual);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [materiasConEstadoIds],
  );

  const handleAgregarPorCodigo = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const codigo = codigoInput.trim();
      if (!codigo) return;

      const materia = mapaMaterias.get(codigo);
      const perteneceASeleccion =
        materia &&
        esElectivaMinor(materia) &&
        (selectedMinors.length === 0 ||
          (materia.minorTags ?? []).some((minor) => selectedMinors.includes(minor)));

      if (!materia || !perteneceASeleccion) {
        setErrorCodigo("No se encontró una electiva válida para los minors seleccionados con ese código.");
        return;
      }

      if (materiasConEstadoIds.has(codigo)) {
        setErrorCodigo("Esa materia ya cuenta automáticamente porque ya la marcaste en el tablero.");
        return;
      }

      setMateriasPlanIds((actual) => new Set(actual).add(codigo));
      setCodigoInput("");
      setErrorCodigo(null);
    },
    [codigoInput, mapaMaterias, materiasConEstadoIds, selectedMinors],
  );

  const limpiarPlanManual = useCallback(() => {
    setMateriasPlanIds(new Set());
    setErrorCodigo(null);
    setCodigoInput("");
  }, []);

  return (
    <section className="border-t border-slate-800 bg-slate-900/60 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-violet-400" />
              <h2 className="text-xl font-semibold text-slate-100">Minors</h2>
            </div>
            <p className="max-w-3xl text-sm text-slate-400">
              Esta pestaña te deja ver tu avance real, planificar electivas y comparar varios minors
              al mismo tiempo. Las materias que ya marcaste en el tablero se cuentan solas; acá solo
              sumás o sacás materias que querés considerar en tu plan.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {MINOR_OPTIONS.map((minor) => {
            const checked = selectedMinors.includes(minor);

            return (
              <button
                key={minor}
                type="button"
                aria-pressed={checked}
                onClick={() => handleToggleMinor(minor)}
                className={`cursor-pointer rounded-2xl border p-4 text-left transition-all ${
                  checked
                    ? "border-slate-500 bg-slate-950/90 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                    : "border-slate-800 bg-slate-950/45 hover:border-slate-700 hover:bg-slate-950/70"
                }`}
                style={checked ? { boxShadow: `0 0 0 1px ${MINOR_COLORES[minor]}55 inset` } : undefined}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: MINOR_COLORES[minor] }}
                    />
                    <span className="text-sm font-semibold text-slate-100">{MINOR_LABELS[minor]}</span>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      checked
                        ? "border-violet-400/40 bg-violet-500/10 text-violet-100"
                        : "border-slate-700 text-slate-400"
                    }`}
                  >
                    {checked ? "Seleccionado" : "Ver minor"}
                  </span>
                </div>
                <p className="text-xs leading-5 text-slate-400">{MINOR_DESCRIPTIONS[minor]}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-300">
              <Layers3 className="h-4 w-4 text-cyan-300" />
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Activos</span>
            </div>
            <p className="text-3xl font-semibold text-slate-100">{selectedMinors.length}</p>
            <p className="mt-2 text-xs text-slate-500">
              Elegí uno o varios minors para compararlos sin perder la planificación actual.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-300">
              <Target className="h-4 w-4 text-violet-300" />
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">En plan</span>
            </div>
            <p className="text-3xl font-semibold text-slate-100">{creditosVisiblesEnPlan}</p>
            <p className="mt-2 text-xs text-slate-500">
              Créditos visibles que ya cuentan por tablero o por selección manual.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-300">
              <ListChecks className="h-4 w-4 text-emerald-300" />
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Aprobados</span>
            </div>
            <p className="text-3xl font-semibold text-slate-100">{creditosVisiblesAprobados}</p>
            <p className="mt-2 text-xs text-slate-500">
              Créditos ya aprobados dentro del conjunto de minors que estás mirando.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-slate-300">
              <GraduationCap className="h-4 w-4 text-amber-300" />
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Compartidas</span>
            </div>
            <p className="text-3xl font-semibold text-slate-100">{materiasCompartidasEnPlan.length}</p>
            <p className="mt-2 text-xs text-slate-500">
              Materias compartidas entre tus minors activos que ya te conviene contar.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Planificación manual</h3>
              <p className="mt-1 text-xs text-slate-500">
                Sumá electivas por código para proyectar minors antes de marcarlas en el tablero.
              </p>
            </div>

            <form onSubmit={handleAgregarPorCodigo} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={codigoInput}
                onChange={(event) => {
                  setCodigoInput(event.target.value);
                  if (errorCodigo) setErrorCodigo(null);
                }}
                placeholder="Ej: 81.14"
                className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 font-mono text-xs text-slate-100 outline-none transition-colors focus:border-violet-400"
              />
              <button
                type="submit"
                className="h-9 cursor-pointer rounded-lg border border-violet-500/70 bg-violet-500/10 px-3 text-xs font-medium text-violet-100 transition-colors hover:border-violet-300 hover:bg-violet-500/20"
              >
                Agregar al plan
              </button>
              <button
                type="button"
                onClick={limpiarPlanManual}
                className="h-9 cursor-pointer rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-900 hover:text-slate-100"
              >
                Limpiar manuales
              </button>
            </form>
          </div>

          {errorCodigo ? <p className="mt-3 text-xs text-rose-400">{errorCodigo}</p> : null}
        </div>

        {selectedMinors.length === 0 ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-500">
            Elegí al menos un minor para ver sus materias, detectar compartidas y revisar cuánto ya
            te cuenta tu progreso actual.
          </p>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-cyan-300" />
                  <h3 className="text-sm font-semibold text-slate-100">Comparación rápida</h3>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Ordenados por cuánto ya cubriste entre aprobadas, materias contadas por tablero y planificación manual.
                </p>

                <div className="mt-4 space-y-3">
                  {comparativaMinors.map((summary, index) => (
                    <article
                      key={`compare-${summary.minor}`}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: MINOR_COLORES[summary.minor] }}
                            />
                            <h4 className="text-sm font-semibold text-slate-100">
                              {MINOR_LABELS[summary.minor]}
                            </h4>
                            {index === 0 ? (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-950/25 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                                Más encaminado
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {summary.creditosFaltantes > 0
                              ? `Te faltan ${summary.creditosFaltantes} cr para cerrar el objetivo de 45.`
                              : "Con lo que ya contaste, este minor queda cubierto."}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] md:min-w-[18rem]">
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-300">
                            <span className="text-slate-500">Cubierto</span>
                            <p className="mt-1 text-sm font-semibold text-slate-100">
                              {summary.creditosPlanificados} cr
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-300">
                            <span className="text-slate-500">Aprobado</span>
                            <p className="mt-1 text-sm font-semibold text-slate-100">
                              {summary.creditosAprobados} cr
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-300">
                            <span className="text-slate-500">Pendientes activas</span>
                            <p className="mt-1 text-sm font-semibold text-slate-100">
                              {summary.materiasPendientesActivas}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-300">
                            <span className="text-slate-500">Compartidas</span>
                            <p className="mt-1 text-sm font-semibold text-slate-100">
                              {summary.materiasCompartidas.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-900/60 bg-cyan-950/10 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  <h3 className="text-sm font-semibold text-cyan-100">Qué conviene mirar ahora</h3>
                </div>
                <p className="mt-2 text-xs text-cyan-200/70">
                  Priorizo materias que abren más de un minor, ya están habilitadas o siguen con oferta activa.
                </p>

                <div className="mt-4 space-y-3">
                  {recomendaciones.length > 0 ? (
                    recomendaciones.map(({ materia, overlap, habilitada, ofertaActiva }) => (
                      <article
                        key={`reco-${materia.id}`}
                        className="rounded-2xl border border-cyan-900/50 bg-slate-950/55 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[11px] text-cyan-200/80">{materia.id}</span>
                              <span className="text-sm font-medium text-slate-100">{materia.nombre}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                              <span className="rounded-full border border-cyan-500/40 bg-cyan-950/20 px-2 py-0.5 text-cyan-100">
                                {overlap > 1 ? `Sirve para ${overlap} minors` : "Suma directo al minor activo"}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 ${
                                  habilitada
                                    ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200"
                                    : "border-slate-700 text-slate-400"
                                }`}
                              >
                                {habilitada ? "Ya la podés cursar" : "Todavía depende de correlativas"}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 ${
                                  ofertaActiva
                                    ? "border-sky-500/40 bg-sky-950/20 text-sky-200"
                                    : "border-amber-500/40 bg-amber-950/20 text-amber-200"
                                }`}
                              >
                                {ofertaActiva ? "Oferta activa" : "Oferta no activa"}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleMateriaPlan(materia.id)}
                            className="cursor-pointer rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-[11px] font-medium text-cyan-100 transition-colors hover:border-cyan-300 hover:bg-cyan-500/20"
                          >
                            Sumarla
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-cyan-900/60 px-4 py-8 text-center text-xs text-cyan-200/65">
                      No quedan electivas pendientes recomendables dentro de la selección actual.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {materiasCompartidas.length > 0 ? (
              <div className="rounded-2xl border border-cyan-900/60 bg-cyan-950/10 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-cyan-100">Materias compartidas</h3>
                    <p className="mt-1 text-xs text-cyan-200/70">
                      Estas materias aparecen en dos o más minors seleccionados y son las primeras que
                      conviene mirar si querés abrir varias opciones a la vez.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-cyan-200">
                    {sumarCreditos(materiasCompartidasEnPlan)} cr compartidos ya cuentan en tu plan
                  </span>
                </div>

                <div className="mt-4 grid gap-2 lg:grid-cols-2">
                  {materiasCompartidas.map((materia) => {
                    const estado = (progreso[materia.id] ?? "pendiente") as EstadoMateria;
                    return (
                      <MateriaMinorRow
                        key={`shared-${materia.id}`}
                        materia={materia}
                        checked={materiasEnPlanIds.has(materia.id)}
                        disabled={materiasConEstadoIds.has(materia.id)}
                        estado={estado}
                        esCompartida
                        selectedMinors={selectedMinors}
                        onToggle={toggleMateriaPlan}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              {minorSummaries.map((summary) => {
                const progresoMinor = Math.min(100, (summary.creditosPlanificados / OBJETIVO_MINOR) * 100);
                const creditosFaltantes = Math.max(0, OBJETIVO_MINOR - summary.creditosPlanificados);

                return (
                  <article
                    key={summary.minor}
                    className="rounded-3xl border border-slate-800 bg-slate-950/50 p-5"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: MINOR_COLORES[summary.minor] }}
                            />
                            <h3 className="text-lg font-semibold text-slate-100">
                              {MINOR_LABELS[summary.minor]}
                            </h3>
                          </div>
                          <p className="mt-2 text-sm text-slate-400">
                            {MINOR_DESCRIPTIONS[summary.minor]}
                          </p>
                        </div>

                        <div className="min-w-[13rem] rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                          <div className="flex items-center justify-between text-sm text-slate-200">
                            <span>Progreso estimado</span>
                            <span>
                              {summary.creditosPlanificados} / {OBJETIVO_MINOR} cr
                            </span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${progresoMinor}%`,
                                backgroundColor: MINOR_COLORES[summary.minor],
                              }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {creditosFaltantes > 0
                              ? `Faltan ${creditosFaltantes} cr para llegar al objetivo de 45.`
                              : "Con lo que ya tenés y planificaste, este minor queda cubierto."}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Aprobados</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-100">
                            {summary.creditosAprobados}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Gestión</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-100">
                            {summary.creditosGestionPlanificados}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tecnología</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-100">
                            {summary.creditosTecnologiaPlanificados}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Compartidas</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-100">
                            {summary.materiasCompartidas.length}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-slate-200">Electivas de Gestión</h4>
                            <span className="text-xs text-slate-500">
                              {summary.materiasGestion.length} materias
                            </span>
                          </div>
                          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                            {summary.materiasGestion.map((materia) => {
                              const estado = (progreso[materia.id] ?? "pendiente") as EstadoMateria;
                              return (
                                <MateriaMinorRow
                                  key={`${summary.minor}-gestion-${materia.id}`}
                                  materia={materia}
                                  checked={materiasEnPlanIds.has(materia.id)}
                                  disabled={materiasConEstadoIds.has(materia.id)}
                                  estado={estado}
                                  esCompartida={obtenerCantidadMinorsCompartidos(materia, selectedMinors) >= 2}
                                  selectedMinors={selectedMinors}
                                  onToggle={toggleMateriaPlan}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-slate-200">Electivas de Tecnología</h4>
                            <span className="text-xs text-slate-500">
                              {summary.materiasTecnologia.length} materias
                            </span>
                          </div>
                          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                            {summary.materiasTecnologia.map((materia) => {
                              const estado = (progreso[materia.id] ?? "pendiente") as EstadoMateria;
                              return (
                                <MateriaMinorRow
                                  key={`${summary.minor}-tecnologia-${materia.id}`}
                                  materia={materia}
                                  checked={materiasEnPlanIds.has(materia.id)}
                                  disabled={materiasConEstadoIds.has(materia.id)}
                                  estado={estado}
                                  esCompartida={obtenerCantidadMinorsCompartidos(materia, selectedMinors) >= 2}
                                  selectedMinors={selectedMinors}
                                  onToggle={toggleMateriaPlan}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
