"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GraduationCap } from "lucide-react";

import { enriquecerMateriasConMinors } from "@/data/minorsMetadata";
import { MINOR_COLORES, MINOR_LABELS } from "@/data/minorsMetadata";
import planRaw from "@/data/planDeEstudio.json";
import { getInterseccionMaterias, getMateriasMinor } from "@/lib/planUtils";
import { useProgreso } from "@/hooks/useProgreso";
import type { MateriaPlan, MinorTag, PlanDeEstudio } from "@/types/plan";

const plan = planRaw as PlanDeEstudio;
const STORAGE_MINORS = "malla-curricular:minors:v1";
const STORAGE_PLAN_MINORS = "malla-curricular:plan-minors:v1";
const OBJETIVO_1_MINOR = 45;
const OBJETIVO_2_MINORS = 90;

function parseMinors(raw: string | null): MinorTag[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    const valid: MinorTag[] = ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"];
    return arr.filter((m): m is MinorTag => typeof m === "string" && valid.includes(m as MinorTag));
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

export function SeccionMinors() {
  const materias = useMemo(() => enriquecerMateriasConMinors(plan.materias), []);
  const { progreso } = useProgreso(materias);

  const [selectedMinors, setSelectedMinors] = useState<MinorTag[]>([]);
  const [materiasPlanIds, setMateriasPlanIds] = useState<Set<string>>(new Set());
  const [expandidoGestion, setExpandidoGestion] = useState(true);
  const [expandidoTecnologia, setExpandidoTecnologia] = useState(true);
  const [codigoInput, setCodigoInput] = useState("");
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const m = window.localStorage.getItem(STORAGE_MINORS);
      const p = window.localStorage.getItem(STORAGE_PLAN_MINORS);
      setSelectedMinors(parseMinors(m));
      setMateriasPlanIds(parsePlanMinors(p));
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (selectedMinors.length === 0) return;
    window.localStorage.setItem(STORAGE_MINORS, JSON.stringify(selectedMinors));
  }, [selectedMinors]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_PLAN_MINORS, JSON.stringify([...materiasPlanIds]));
  }, [materiasPlanIds]);

  const handleToggleMinor = useCallback((minor: MinorTag) => {
    setSelectedMinors((actual) => {
      if (actual.includes(minor)) {
        return actual.filter((m) => m !== minor);
      }
      if (actual.length >= 2) return actual;
      return [...actual, minor];
    });
  }, []);

  const materiasQueCuentan = useMemo(() => {
    if (selectedMinors.length === 0) return [];
    if (selectedMinors.length === 1) {
      return getMateriasMinor(materias, selectedMinors[0]);
    }
    return materias.filter((m) => {
      const tags = m.minorTags ?? [];
      return selectedMinors.every((minor) => tags.includes(minor));
    });
  }, [materias, selectedMinors]);

  const electivasGestion = useMemo(
    () => materiasQueCuentan.filter((m) => m.grupo === "electiva-gestion"),
    [materiasQueCuentan],
  );
  const electivasTecnologia = useMemo(
    () => materiasQueCuentan.filter((m) => m.grupo === "electiva-sistemas-tecnologia"),
    [materiasQueCuentan],
  );

  const materiasInterseccionIds = useMemo(
    () => new Set(getInterseccionMaterias(materias, selectedMinors)),
    [materias, selectedMinors],
  );

  const creditosEnPlan = useMemo(() => {
    let total = 0;
    const mapa = new Map(materias.map((m) => [m.id, m]));
    for (const id of materiasPlanIds) {
      const m = mapa.get(id);
      if (m) total += m.creditos;
    }
    return total;
  }, [materias, materiasPlanIds]);

  const creditosAprobadosQueCuentan = useMemo(() => {
    return materiasQueCuentan.reduce((acc, m) => {
      if ((progreso[m.id] ?? "pendiente") === "aprobada") return acc + m.creditos;
      return acc;
    }, 0);
  }, [materiasQueCuentan, progreso]);

  const objetivo = selectedMinors.length === 2 ? OBJETIVO_2_MINORS : OBJETIVO_1_MINOR;
  const totalPlanificado = creditosEnPlan;
  const creditosFaltantes = Math.max(0, objetivo - totalPlanificado);

  const toggleMateriaPlan = useCallback((id: string) => {
    setMateriasPlanIds((actual) => {
      const next = new Set(actual);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAgregarPorCodigo = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const codigo = codigoInput.trim();
      if (!codigo) return;

      const mapa = new Map(materiasQueCuentan.map((m) => [m.id, m]));
      const materia = mapa.get(codigo);

      if (!materia) {
        setErrorCodigo("No se encontró una materia de los minors seleccionados con ese código.");
        return;
      }

      setMateriasPlanIds((actual) => {
        const next = new Set(actual);
        next.add(codigo);
        return next;
      });
      setErrorCodigo(null);
    },
    [codigoInput, materiasQueCuentan],
  );

  const minors: MinorTag[] = [
    "finanzas-cripto",
    "tecnologia-datos",
    "innovacion-empresarial",
    "gestion-comercial",
  ];

  return (
    <section
      id="minors"
      className="scroll-mt-24 border-t border-slate-800 bg-slate-900/60 px-4 py-8"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-violet-400" />
          <h2 className="text-xl font-semibold text-slate-100">Planificación de Minors</h2>
        </div>

        <p className="mb-6 text-sm text-slate-400">
          Selecciona 1 o 2 minors y agrega materias electivas a tu plan para alcanzar los créditos
          necesarios (45 cr por minor, 90 cr si haces 2).
        </p>

        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
            Seleccionar minors
          </p>
          <div className="flex flex-wrap gap-2">
            {minors.map((minor) => {
              const checked = selectedMinors.includes(minor);
              const disabled = !checked && selectedMinors.length >= 2;
              return (
                <label
                  key={minor}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    disabled
                      ? "cursor-not-allowed border-slate-700 text-slate-500 opacity-60"
                      : checked
                        ? "border-violet-400 bg-violet-900/30 text-violet-100"
                        : "border-slate-600 text-slate-300 hover:border-slate-500"
                  }`}
                  style={checked ? { borderColor: MINOR_COLORES[minor] } : undefined}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-violet-400"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => handleToggleMinor(minor)}
                  />
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: MINOR_COLORES[minor] }}
                  />
                  {MINOR_LABELS[minor]}
                </label>
              );
            })}
          </div>
        </div>

        {selectedMinors.length > 0 ? (
          <>
            <div className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">Progreso hacia el objetivo</span>
                <span className="text-sm text-slate-400">
                  {totalPlanificado} / {objetivo} cr
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{ width: `${Math.min(100, (totalPlanificado / objetivo) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {creditosAprobadosQueCuentan} cr ya aprobados cuentan en tu plan.{" "}
                {creditosFaltantes > 0
                  ? `Faltan ${creditosFaltantes} cr para alcanzar el objetivo.`
                  : "Objetivo alcanzado."}
              </p>

              <form
                onSubmit={handleAgregarPorCodigo}
                className="mt-4 flex flex-wrap items-center gap-2 text-xs"
              >
                <label className="text-slate-300" htmlFor="codigo-minor">
                  Agregar materia por código:
                </label>
                <input
                  id="codigo-minor"
                  type="text"
                  value={codigoInput}
                  onChange={(e) => {
                    setCodigoInput(e.target.value);
                    if (errorCodigo) setErrorCodigo(null);
                  }}
                  placeholder="Ej: 81.14"
                  className="h-7 rounded-md border border-slate-600 bg-slate-900 px-2 font-mono text-xs text-slate-100 outline-none focus:border-violet-400"
                />
                <button
                  type="submit"
                  className="h-7 rounded-md border border-violet-500 bg-violet-600/20 px-3 text-xs font-medium text-violet-100 hover:border-violet-300"
                >
                  Agregar
                </button>
                {errorCodigo ? (
                  <span className="text-[11px] text-rose-400">{errorCodigo}</span>
                ) : null}
              </form>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50">
                <button
                  type="button"
                  onClick={() => setExpandidoGestion((e) => !e)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-200"
                >
                  Electivas de Gestión (27 cr)
                  {expandidoGestion ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandidoGestion && (
                  <div className="max-h-64 space-y-1 overflow-y-auto border-t border-slate-800 px-4 py-2">
                    {electivasGestion.map((m) => {
                      const enPlan = materiasPlanIds.has(m.id);
                      const cuenta = materiasInterseccionIds.has(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                            cuenta ? "bg-violet-950/30" : ""
                          } ${enPlan ? "ring-1 ring-violet-400/50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={enPlan}
                            onChange={() => toggleMateriaPlan(m.id)}
                            className="h-3.5 w-3.5 accent-violet-400"
                          />
                          <span className="font-mono text-slate-400">{m.id}</span>
                          <span className="min-w-0 flex-1 truncate text-slate-200">
                            {m.nombre}
                          </span>
                          <span className="text-slate-500">{m.creditos} cr</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/50">
                <button
                  type="button"
                  onClick={() => setExpandidoTecnologia((e) => !e)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-200"
                >
                  Electivas de Tecnología (30 cr)
                  {expandidoTecnologia ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandidoTecnologia && (
                  <div className="max-h-64 space-y-1 overflow-y-auto border-t border-slate-800 px-4 py-2">
                    {electivasTecnologia.map((m) => {
                      const enPlan = materiasPlanIds.has(m.id);
                      const cuenta = materiasInterseccionIds.has(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                            cuenta ? "bg-violet-950/30" : ""
                          } ${enPlan ? "ring-1 ring-violet-400/50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={enPlan}
                            onChange={() => toggleMateriaPlan(m.id)}
                            className="h-3.5 w-3.5 accent-violet-400"
                          />
                          <span className="font-mono text-slate-400">{m.id}</span>
                          <span className="min-w-0 flex-1 truncate text-slate-200">
                            {m.nombre}
                          </span>
                          <span className="text-slate-500">{m.creditos} cr</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Las materias resaltadas pertenecen a tu(s) minor(s) seleccionado(s). Marca las que
              planeas cursar para sumar créditos al objetivo.
            </p>
          </>
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-6 text-center text-sm text-slate-500">
            Selecciona al menos un minor para ver las materias y armar tu plan.
          </p>
        )}
      </div>
    </section>
  );
}
