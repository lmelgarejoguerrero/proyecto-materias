"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Download,
  GraduationCap,
  Layers3,
  RotateCcw,
  Upload,
} from "lucide-react";

import { CourseDrawer } from "@/components/CourseDrawer";
import { DashboardView } from "@/components/DashboardView";
import { MinorsView } from "@/components/MinorsView";
import { PlannerView } from "@/components/PlannerView";
import { enriquecerMateriasConMinors } from "@/data/minorsMetadata";
import planRaw from "@/data/planDeEstudio.json";
import { useProgreso } from "@/hooks/useProgreso";
import { validarPlan } from "@/lib/planUtils";
import type { EstadoMateria, PlanDeEstudio } from "@/types/plan";

const plan = planRaw as PlanDeEstudio;
const STORAGE_KEYS = [
  "malla-curricular:progreso:v1",
  "malla-curricular:minors:v1",
  "malla-curricular:plan-minors:v1",
  "tablero-materias:planificador:v1",
] as const;

type View = "avance" | "minors" | "planificar";

const VIEWS: Array<{
  id: View;
  label: string;
  description: string;
  icon: typeof GraduationCap;
}> = [
  { id: "avance", label: "Mi avance", description: "Plan y estados", icon: BookOpenCheck },
  { id: "minors", label: "Minors", description: "Elegir y completar", icon: Layers3 },
  { id: "planificar", label: "Planificar", description: "Próximos cuatris", icon: CalendarRange },
];

function viewFromHash(): View {
  if (typeof window === "undefined") return "avance";
  const hash = window.location.hash.slice(1);
  if (hash === "minors") return "minors";
  if (hash === "planificar" || hash === "planificador") return "planificar";
  return "avance";
}

export function MallaApp() {
  const materias = useMemo(() => enriquecerMateriasConMinors(plan.materias), []);
  const validation = useMemo(() => validarPlan(materias), [materias]);
  const [view, setView] = useState<View>("avance");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const {
    progreso,
    estadoVisualPorMateria,
    materiasHabilitadas,
    creditosAprobados,
    creditosCursando,
    actualizarEstadosMasivos,
    aprobarCursadas,
    resetearProgreso,
  } = useProgreso(materias);

  useEffect(() => {
    const sync = () => setView(viewFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const changeView = (next: View) => {
    window.location.hash = next === "avance" ? "" : next;
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const projectedCredits = useMemo(() => {
    const inFlight = materias.reduce((total, materia) => {
      const status = progreso[materia.id] ?? "pendiente";
      return status === "cursando" || status === "regular" ? total + materia.creditos : total;
    }, 0);
    return Math.min(plan.creditosTitulo, creditosAprobados + inFlight);
  }, [creditosAprobados, materias, progreso]);

  const progressPercent = Math.min(100, (creditosAprobados / plan.creditosTitulo) * 100);
  const projectedPercent = Math.min(100, (projectedCredits / plan.creditosTitulo) * 100);
  const remainingCredits = Math.max(0, plan.creditosTitulo - projectedCredits);
  const estimatedTerms = Math.ceil(remainingCredits / 24);
  const selectedCourse = materias.find((materia) => materia.id === selectedCourseId) ?? null;
  const hasValidationIssues = validation.idsDuplicados.length > 0 || validation.correlativasInexistentes.length > 0;

  const exportData = () => {
    const storage = Object.fromEntries(
      STORAGE_KEYS.map((key) => {
        const raw = window.localStorage.getItem(key);
        try {
          return [key, raw ? JSON.parse(raw) : null];
        } catch {
          return [key, null];
        }
      }),
    );
    const blob = new Blob(
      [JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), plan: plan.plan, storage }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mi-plan-l20.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          storage?: Record<string, unknown>;
          storageDump?: Record<string, unknown>;
          appState?: Record<string, unknown>;
        };
        const source = parsed.storage ?? parsed.storageDump;
        if (source) {
          for (const key of STORAGE_KEYS) {
            if (key in source) window.localStorage.setItem(key, JSON.stringify(source[key]));
          }
        } else if (parsed.appState) {
          const legacyMap: Record<string, keyof typeof parsed.appState> = {
            "malla-curricular:progreso:v1": "progreso",
            "malla-curricular:minors:v1": "minors",
            "malla-curricular:plan-minors:v1": "materiasPlanMinors",
            "tablero-materias:planificador:v1": "planner",
          };
          for (const [key, legacyKey] of Object.entries(legacyMap)) {
            if (legacyKey in parsed.appState) {
              window.localStorage.setItem(key, JSON.stringify(parsed.appState[legacyKey]));
            }
          }
        }
        window.location.reload();
      } catch {
        window.alert("No pudimos importar ese archivo. Verificá que sea un backup JSON de esta app.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const setCourseStatus = (courseId: string, status: EstadoMateria) => {
    actualizarEstadosMasivos([courseId], status);
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-[#f4f6f9]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => changeView("avance")}
            className="flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white shadow-sm">
              <GraduationCap className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-950 sm:text-base">Mi carrera</span>
              <span className="block truncate text-[11px] font-medium text-slate-500 sm:text-xs">Gestión de Negocios · L20</span>
            </span>
          </button>

          <div className="hidden items-center gap-5 md:flex">
            <div className="min-w-52">
              <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                <span>{creditosAprobados} aprobados</span>
                <span>{plan.creditosTitulo} cr</span>
              </div>
              <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="absolute inset-y-0 left-0 rounded-full bg-blue-200" style={{ width: `${projectedPercent}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-blue-700" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-slate-200">
              <p className="text-sm font-bold text-slate-950">{remainingCredits} cr</p>
              <p className="text-[10px] font-medium text-slate-500">restantes proyectados</p>
            </div>
          </div>

          <details className="group relative">
            <summary className="flex min-h-10 list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              Datos <ChevronDown className="size-3.5 transition group-open:rotate-180" />
            </summary>
            <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <button type="button" onClick={exportData} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100">
                <Download className="size-4" /> Exportar backup
              </button>
              <button type="button" onClick={() => importRef.current?.click()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100">
                <Upload className="size-4" /> Importar backup
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("¿Querés borrar todos los estados guardados? La planificación y el minor no se borran.")) resetearProgreso();
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                <RotateCcw className="size-4" /> Reiniciar estados
              </button>
              <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={importData} />
            </div>
          </details>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1480px] px-3 sm:px-6 lg:px-8">
          <nav className="grid grid-cols-3 gap-1 py-2 sm:flex sm:gap-2" aria-label="Secciones principales">
            {VIEWS.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => changeView(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:min-w-44 sm:justify-start ${
                    active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>
                    <span className="block text-xs font-bold sm:text-sm">{item.label}</span>
                    <span className={`hidden text-[10px] sm:block ${active ? "text-slate-300" : "text-slate-400"}`}>{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Aprobados", value: `${creditosAprobados} cr`, detail: `${progressPercent.toFixed(0)}% del título`, color: "bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
            { label: "Cursando", value: `${creditosCursando} cr`, detail: "en este momento", color: "bg-blue-50 text-blue-800", icon: BookOpenCheck },
            { label: "Proyección", value: `${projectedCredits} cr`, detail: "incluye regular + cursando", color: "bg-indigo-50 text-indigo-800", icon: GraduationCap },
            { label: "Camino estimado", value: estimatedTerms === 0 ? "Completo" : `${estimatedTerms} cuatris`, detail: "a 24 créditos por cuatri", color: "bg-amber-50 text-amber-800", icon: CalendarRange },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.color}`}><Icon className="size-4" /></span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-950">{item.value}</p>
                  <p className="text-[10px] text-slate-500">{item.detail}</p>
                </div>
              </div>
            );
          })}
        </section>

        {hasValidationIssues ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
            El plan tiene {validation.idsDuplicados.length} IDs duplicados y {validation.correlativasInexistentes.length} correlativas sin materia asociada.
          </div>
        ) : null}

        {view === "avance" ? (
          <DashboardView
            materias={materias}
            progreso={progreso}
            estadoVisualPorMateria={estadoVisualPorMateria}
            onOpenCourse={setSelectedCourseId}
          />
        ) : view === "minors" ? (
          <MinorsView materias={materias} progreso={progreso} onOpenCourse={setSelectedCourseId} />
        ) : (
          <PlannerView
            materias={materias}
            progreso={progreso}
            materiasHabilitadas={materiasHabilitadas}
            onOpenCourse={setSelectedCourseId}
          />
        )}
      </main>

      {creditosCursando > 0 ? (
        <div className="fixed bottom-4 left-4 right-4 z-40 rounded-2xl border border-blue-200 bg-white p-2 shadow-xl sm:left-auto sm:w-96">
          <button
            type="button"
            onClick={aprobarCursadas}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <CheckCircle2 className="size-4" /> Marcar todas las cursadas como regulares
          </button>
        </div>
      ) : null}

      <CourseDrawer
        materia={selectedCourse}
        materias={materias}
        progreso={progreso}
        habilitada={selectedCourse ? materiasHabilitadas[selectedCourse.id] ?? false : false}
        onClose={() => setSelectedCourseId(null)}
        onSetEstado={setCourseStatus}
      />
    </div>
  );
}
