"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Laptop, MousePointerClick, Upload } from "lucide-react";

import { enriquecerMateriasConMinors } from "@/data/minorsMetadata";
import planRaw from "@/data/planDeEstudio.json";
import { LeyendaEstados } from "@/components/LeyendaEstados";
import { MallaGrid } from "@/components/MallaGrid";
import { SeccionMinors } from "@/components/SeccionMinors";
import { validarPlan } from "@/lib/planUtils";
import { useProgreso } from "@/hooks/useProgreso";
import type { EstadoMateria, PlanDeEstudio, SlotElectiva8Cuat } from "@/types/plan";

const plan = planRaw as PlanDeEstudio;
const ONBOARDING_STORAGE_KEY = "tablero-materias:onboarding-v1";
const STORAGE_PROGRESO_KEY = "malla-curricular:progreso:v1";
const STORAGE_MINORS_KEY = "malla-curricular:minors:v1";
const STORAGE_PLAN_MINORS_KEY = "malla-curricular:plan-minors:v1";

type VistaActiva = "malla" | "minors";

export function MallaApp() {
  const materias = useMemo(() => enriquecerMateriasConMinors(plan.materias), []);
  const validacion = useMemo(() => validarPlan(materias), [materias]);
  const [slotActivo, setSlotActivo] = useState<SlotElectiva8Cuat>("gestion");
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>("malla");

  const {
    progreso,
    estadoVisualPorMateria,
    creditosAprobados,
    creditosCursando,
    actualizarEstado,
    actualizarEstadosMasivos,
    aprobarCursadas,
    resetearProgreso,
  } = useProgreso(materias);

  const hayInconsistencias =
    validacion.idsDuplicados.length > 0 || validacion.correlativasInexistentes.length > 0;

  const inputImportRef = useRef<HTMLInputElement | null>(null);
  const [seleccionMultipleActiva, setSeleccionMultipleActiva] = useState(false);
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState<Set<string>>(new Set());

  const toggleSeleccionMultiple = () => {
    setSeleccionMultipleActiva((prev) => {
      if (prev) {
        setMateriasSeleccionadas(new Set());
      }
      return !prev;
    });
  };

  const handleToggleSeleccionMateria = (materiaId: string) => {
    setMateriasSeleccionadas((actual) => {
      const next = new Set(actual);
      if (next.has(materiaId)) {
        next.delete(materiaId);
      } else {
        next.add(materiaId);
      }
      return next;
    });
  };

  const handleMarcarSeleccionadas = (estado: EstadoMateria) => {
    if (materiasSeleccionadas.size === 0) return;
    actualizarEstadosMasivos(Array.from(materiasSeleccionadas), estado);
    setMateriasSeleccionadas(new Set());
  };

  const handleExportJson = () => {
    if (typeof window === "undefined") return;

    const progresoRaw = window.localStorage.getItem(STORAGE_PROGRESO_KEY);
    const minorsRaw = window.localStorage.getItem(STORAGE_MINORS_KEY);
    const planMinorsRaw = window.localStorage.getItem(STORAGE_PLAN_MINORS_KEY);

    const payload = {
      version: 1,
      generadoEn: new Date().toISOString(),
      progreso: progresoRaw ? JSON.parse(progresoRaw) : {},
      minors: minorsRaw ? JSON.parse(minorsRaw) : [],
      materiasPlanMinors: planMinorsRaw ? JSON.parse(planMinorsRaw) : [],
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "plan-materias.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleClickImport = () => {
    inputImportRef.current?.click();
  };

  const handleImportChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as {
          progreso?: unknown;
          minors?: unknown;
          materiasPlanMinors?: unknown;
        };

        if (parsed.progreso && typeof parsed.progreso === "object") {
          window.localStorage.setItem(STORAGE_PROGRESO_KEY, JSON.stringify(parsed.progreso));
        }
        if (parsed.minors && Array.isArray(parsed.minors)) {
          window.localStorage.setItem(STORAGE_MINORS_KEY, JSON.stringify(parsed.minors));
        }
        if (parsed.materiasPlanMinors && Array.isArray(parsed.materiasPlanMinors)) {
          window.localStorage.setItem(
            STORAGE_PLAN_MINORS_KEY,
            JSON.stringify(parsed.materiasPlanMinors),
          );
        }

        // Recargar para que los hooks lean el nuevo estado
        window.location.reload();
      } catch {
        // Silencioso: si falla el parseo no hacemos nada
      }
    };
    reader.readAsText(file);
    // limpiar valor para permitir volver a importar el mismo archivo
    event.target.value = "";
  };

  const progresoSlots8Cuat = useMemo(() => {
    const acumulado: Record<SlotElectiva8Cuat, { aprobado: number; objetivo: number }> = {
      gestion: { aprobado: 0, objetivo: 27 },
      "proyecto-final": { aprobado: 0, objetivo: 3 },
      "sistemas-tecnologia": { aprobado: 0, objetivo: 30 },
    };

    for (const materia of materias) {
      const estado = progreso[materia.id] ?? "pendiente";
      if (estado === "pendiente") continue;

      if (materia.grupo === "electiva-gestion") {
        acumulado.gestion.aprobado += materia.creditos;
      } else if (materia.grupo === "electiva-proyecto-final") {
        acumulado["proyecto-final"].aprobado += materia.creditos;
      } else if (materia.grupo === "electiva-sistemas-tecnologia") {
        acumulado["sistemas-tecnologia"].aprobado += materia.creditos;
      }
    }

    return acumulado;
  }, [materias, progreso]);

  const creditosProyectados = useMemo(() => {
    let total = creditosAprobados;

    for (const materia of materias) {
      const estado = progreso[materia.id] ?? "pendiente";
      if (estado === "cursando" || estado === "regular") {
        total += materia.creditos;
      }
    }

    return Math.min(total, plan.creditosTitulo);
  }, [materias, progreso, creditosAprobados]);

  const handleSeleccionarSlot = (slot: SlotElectiva8Cuat) => {
    setSlotActivo(slot);
  };

  const handleCardClick = (materiaId: string) => {
    actualizarEstado(materiaId);
  };

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const onboardingVisto = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!onboardingVisto) {
        setMostrarOnboarding(true);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const actualizarVista = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "minors") {
        setVistaActiva("minors");
      } else {
        setVistaActiva("malla");
      }
    };

    actualizarVista();
    window.addEventListener("hashchange", actualizarVista);

    return () => window.removeEventListener("hashchange", actualizarVista);
  }, []);

  const cambiarVista = (vista: VistaActiva) => {
    window.location.hash = vista === "minors" ? "minors" : "";
    setVistaActiva(vista);
  };

  const handleCerrarOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    setMostrarOnboarding(false);
  };

  return (
    <div className="flex min-h-screen flex-col overflow-y-auto bg-slate-950 text-slate-50">
      <LeyendaEstados
        creditosAprobados={creditosAprobados}
        creditosCursando={creditosCursando}
        creditosProyectados={creditosProyectados}
        creditosTitulo={plan.creditosTitulo}
        onAprobarCursadas={aprobarCursadas}
        onReset={() => {
          if (window.confirm("Se va a borrar todo el progreso guardado. ¿Continuar?")) {
            resetearProgreso();
          }
        }}
      />

      {hayInconsistencias ? (
        <div className="mx-auto my-2 flex w-full max-w-[1800px] items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Se detectaron inconsistencias en el plan cargado.</p>
            <p className="mt-1 text-rose-200/90">
              IDs duplicados: {validacion.idsDuplicados.length} · Correlativas inexistentes:{" "}
              {validacion.correlativasInexistentes.length}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mx-auto mb-4 mt-3 flex w-full max-w-[1800px] items-center justify-between gap-4 px-4">
        <nav className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 p-1">
          <button
            type="button"
            onClick={() => cambiarVista("malla")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              vistaActiva === "malla"
                ? "bg-cyan-500/20 text-cyan-100"
                : "text-slate-300 hover:text-slate-100"
            }`}
          >
            Malla Curricular
          </button>
          <button
            type="button"
            onClick={() => cambiarVista("minors")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              vistaActiva === "minors"
                ? "bg-violet-500/20 text-violet-100"
                : "text-slate-300 hover:text-slate-100"
            }`}
          >
            Minors
          </button>
        </nav>
      </div>

      {vistaActiva === "malla" ? (
        <>
          <section className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 text-xs text-slate-300">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSeleccionMultiple}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] ${
              seleccionMultipleActiva
                ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                : "border-slate-600 text-slate-200 hover:border-slate-300"
            }`}
          >
            <span>
              {seleccionMultipleActiva ? "Selección múltiple: activa" : "Selección múltiple"}
            </span>
          </button>
          {seleccionMultipleActiva ? (
            <>
              <span className="text-[11px] text-slate-400">
                {materiasSeleccionadas.size} materia
                {materiasSeleccionadas.size === 1 ? "" : "s"} seleccionada
                {materiasSeleccionadas.size === 1 ? "" : "s"}.
              </span>
              <button
                type="button"
                onClick={() => handleMarcarSeleccionadas("cursando")}
                className="inline-flex items-center gap-1 rounded-full border border-sky-500/70 px-2 py-0.5 text-[11px] text-sky-100 hover:border-sky-300"
              >
                Cursando
              </button>
              <button
                type="button"
                onClick={() => handleMarcarSeleccionadas("regular")}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/70 px-2 py-0.5 text-[11px] text-amber-100 hover:border-amber-300"
              >
                Regular
              </button>
              <button
                type="button"
                onClick={() => handleMarcarSeleccionadas("aprobada")}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/70 px-2 py-0.5 text-[11px] text-emerald-100 hover:border-emerald-300"
              >
                Aprobada
              </button>
              <button
                type="button"
                onClick={() => handleMarcarSeleccionadas("pendiente")}
                className="inline-flex items-center gap-1 rounded-full border border-slate-500/70 px-2 py-0.5 text-[11px] text-slate-100 hover:border-slate-300"
              >
                Volver a pendiente
              </button>
            </>
          ) : (
            <span className="text-[11px] text-slate-500">
              Activá la selección múltiple para “pintar” varias materias y marcarles un estado.
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-100 hover:border-slate-300"
          >
            <Download className="h-3 w-3" />
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={handleClickImport}
            className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-100 hover:border-slate-300"
          >
            <Upload className="h-3 w-3" />
            Importar JSON
          </button>
          <input
            ref={inputImportRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportChange}
          />
        </div>
      </section>

          <div className="h-[70vh] shrink-0 overflow-hidden">
            <MallaGrid
              materias={materias}
              estadoVisualPorMateria={estadoVisualPorMateria}
              onMateriaClick={handleCardClick}
              progresoSlots8Cuat={progresoSlots8Cuat}
              onSeleccionarSlot={handleSeleccionarSlot}
              slotActivo={slotActivo}
              seleccionMultipleActiva={seleccionMultipleActiva}
              materiasSeleccionadas={materiasSeleccionadas}
              onToggleSeleccion={handleToggleSeleccionMateria}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 px-4 pb-8">
          <SeccionMinors />
        </div>
      )}

      {mostrarOnboarding ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900/95 shadow-[0_20px_70px_rgba(2,6,23,0.9)]">
            <div className="border-b border-slate-800 px-6 py-5">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Bienvenida</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-100">
                Como usar el tablero
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Esta herramienta esta optimizada para escritorio. La experiencia en mobile no es buena
                por la cantidad de columnas y detalle visual.
              </p>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-slate-200">
                  <MousePointerClick className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm font-semibold">Estados de materias</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Click en una card:{" "}
                  <span className="text-slate-200">
                    Pendiente {"->"} Cursando {"->"} Regular {"->"} Aprobada {"->"} Pendiente
                  </span>
                  .
                  <br />
                  <span className="text-slate-200">Puedo cursar</span> se calcula solo.{" "}
                  <span className="text-slate-200">Habilitable preview</span> muestra lo que podrias
                  cursar si aprobas la cursada de la materia que estas cursando.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="mb-2 inline-flex items-center gap-2 text-slate-200">
                  <Laptop className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm font-semibold">Controles principales</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  <span className="text-slate-200">Aprobe cursadas</span>: pasa todo de Cursando a Regular.
                  <br />
                  <span className="text-slate-200">Reiniciar progreso</span>: borra tu avance guardado.
                  <br />
                  <span className="text-slate-200">Minors</span>: accede a la pestaña de Minors para planificar tus electivas.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-6 py-4">
              <p className="text-xs text-slate-500">Este mensaje aparece solo la primera vez.</p>
              <button
                type="button"
                onClick={handleCerrarOnboarding}
                className="rounded-lg border border-cyan-400 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300 hover:bg-cyan-500/30"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
