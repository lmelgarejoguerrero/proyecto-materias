"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Laptop, MousePointerClick } from "lucide-react";

import { enriquecerMateriasConMinors } from "@/data/minorsMetadata";
import planRaw from "@/data/planDeEstudio.json";
import { LeyendaEstados } from "@/components/LeyendaEstados";
import { MallaGrid } from "@/components/MallaGrid";
import {
  calcularProgresoMinor,
  getInterseccionMaterias,
  validarPlan,
} from "@/lib/planUtils";
import { useProgreso } from "@/hooks/useProgreso";
import type { MinorTag, PlanDeEstudio, SlotElectiva8Cuat } from "@/types/plan";

const plan = planRaw as PlanDeEstudio;
const ONBOARDING_STORAGE_KEY = "tablero-materias:onboarding-v1";

export function MallaApp() {
  const materias = useMemo(() => enriquecerMateriasConMinors(plan.materias), []);
  const validacion = useMemo(() => validarPlan(materias), [materias]);
  const [selectedMinors, setSelectedMinors] = useState<MinorTag[]>([]);
  const [slotActivo, setSlotActivo] = useState<SlotElectiva8Cuat>("gestion");
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);

  const {
    progreso,
    estadoVisualPorMateria,
    creditosAprobados,
    creditosCursando,
    actualizarEstado,
    aprobarCursadas,
    resetearProgreso,
  } = useProgreso(materias);

  const hayInconsistencias =
    validacion.idsDuplicados.length > 0 || validacion.correlativasInexistentes.length > 0;

  const interseccionMateriaIds = useMemo(
    () => new Set(getInterseccionMaterias(materias, selectedMinors)),
    [materias, selectedMinors],
  );

  const progresosMinors = useMemo(
    () => selectedMinors.map((minor) => calcularProgresoMinor(materias, progreso, minor)),
    [selectedMinors, materias, progreso],
  );

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

  const handleToggleMinor = (minor: MinorTag) => {
    setSelectedMinors((actual) =>
      actual.includes(minor) ? actual.filter((item) => item !== minor) : [...actual, minor],
    );
  };

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

  const handleCerrarOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    setMostrarOnboarding(false);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-50">
      <LeyendaEstados
        creditosAprobados={creditosAprobados}
        creditosCursando={creditosCursando}
        creditosProyectados={creditosProyectados}
        creditosTitulo={plan.creditosTitulo}
        selectedMinors={selectedMinors}
        onToggleMinor={handleToggleMinor}
        progresosMinors={progresosMinors}
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1">
          <MallaGrid
            materias={materias}
            estadoVisualPorMateria={estadoVisualPorMateria}
            onMateriaClick={handleCardClick}
            selectedMinors={selectedMinors}
            interseccionMateriaIds={interseccionMateriaIds}
            progresoSlots8Cuat={progresoSlots8Cuat}
            onSeleccionarSlot={handleSeleccionarSlot}
            slotActivo={slotActivo}
          />
        </div>
      </div>

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
                  <span className="text-slate-200">Minors</span>: filtran y resaltan materias por camino.
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
