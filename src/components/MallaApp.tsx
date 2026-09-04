"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertCircle, ArrowDownToLine, ArrowRight, BookOpenCheck, CalendarRange,
  Check, CheckCircle2, ChevronDown, Clock3, Download, GraduationCap,
  Layers3, Moon, RotateCcw, ShieldCheck, Sun, Undo2, Upload, X,
} from "lucide-react";

import { CourseDrawer } from "@/components/CourseDrawer";
import { DashboardView } from "@/components/DashboardView";
import { Modal } from "@/components/Modal";
import { enriquecerMateriasConMinors } from "@/data/minorsMetadata";
import planRaw from "@/data/planDeEstudio.json";
import { useProgreso } from "@/hooks/useProgreso";
import { calcularCreditosTitulo, validarPlan } from "@/lib/planUtils";
import { aplicarBackup, crearBackup, MAX_BACKUP_BYTES, parsearBackup, type BackupValidado } from "@/lib/progressBackup";
import type { EstadoMateria, PlanDeEstudio, ProgresoMaterias } from "@/types/plan";

function ViewLoading() {
  return <div role="status" className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Preparando tu espacio…</div>;
}
const MinorsView = dynamic(() => import("@/components/MinorsView").then((module) => module.MinorsView), { loading: ViewLoading });
const PlannerView = dynamic(() => import("@/components/PlannerView").then((module) => module.PlannerView), { loading: ViewLoading });
const plan = planRaw as PlanDeEstudio;
type View = "avance" | "minors" | "planificar";
type Notice = { message: string; error?: boolean; previous?: ProgresoMaterias; courseId?: string };
const VIEWS = [
  { id: "avance", label: "Mi avance", description: "Tu recorrido académico", icon: BookOpenCheck },
  { id: "minors", label: "Mis electivas", description: "Minors y especialización", icon: Layers3 },
  { id: "planificar", label: "Planificador", description: "Materias y horarios", icon: CalendarRange },
] as const;
const PAGE_COPY: Record<View, { title: string; subtitle: string }> = {
  avance: { title: "Cada materia, un paso más.", subtitle: "Tu avance, tus próximos desafíos y todo el plan en un solo lugar." },
  minors: { title: "Dale tu dirección a la carrera.", subtitle: "Explorá los minors y construí una combinación de electivas a tu medida." },
  planificar: { title: "Un buen cuatri empieza acá.", subtitle: "Organizá tu carga, revisá las correlativas y encontrá horarios compatibles." },
};
const STATUS_LABEL: Record<EstadoMateria, string> = { pendiente: "pendiente", cursando: "cursando", regular: "regular", aprobada: "aprobada" };

function viewFromHash(): View {
  const hash = window.location.hash.slice(1);
  return hash === "minors" ? "minors" : hash === "planificar" || hash === "planificador" ? "planificar" : "avance";
}

export function MallaApp() {
  const materias = useMemo(() => enriquecerMateriasConMinors(plan.materias), []);
  const validation = useMemo(() => validarPlan(materias), [materias]);
  const [view, setView] = useState<View>("avance");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<"reset" | "regularize" | null>(null);
  const [pendingBackup, setPendingBackup] = useState<{ data: BackupValidado; name: string } | null>(null);
  const [dataRevision, setDataRevision] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const {
    progreso, estadoVisualPorMateria, materiasHabilitadas, creditosAprobados, creditosCursando,
    actualizarEstadosMasivos, aprobarCursadas, resetearProgreso, reemplazarProgreso,
    storageError, storageSincronizado,
  } = useProgreso(materias);

  useEffect(() => {
    const sync = () => setView(viewFromHash());
    const frame = window.requestAnimationFrame(sync);
    window.addEventListener("hashchange", sync);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("hashchange", sync); };
  }, []);

  useEffect(() => {
    if (!notice || notice.error) return;
    const timeout = window.setTimeout(() => setNotice(null), 12_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menuRef.current?.contains(event.target as Node)) {
        if (menuRef.current) menuRef.current.open = false;
      }
    };
    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => { document.removeEventListener("click", closeMenu); document.removeEventListener("keydown", closeMenu); };
  }, []);

  const changeView = useCallback((next: View) => {
    window.location.hash = next === "avance" ? "" : next;
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const closeCourse = useCallback(() => setSelectedCourseId(null), []);
  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  const degreeCredits = calcularCreditosTitulo(materias, progreso);
  const projectedCredits = useMemo(() => calcularCreditosTitulo(materias, Object.fromEntries(
    Object.entries(progreso).map(([id, status]) => [id, status === "cursando" || status === "regular" ? "aprobada" : status]),
  )), [materias, progreso]);
  const progressPercent = Math.min(100, (degreeCredits / plan.creditosTitulo) * 100);
  const projectedPercent = Math.min(100, (projectedCredits / plan.creditosTitulo) * 100);
  const courseCount = (status: EstadoMateria) => materias.filter((materia) => progreso[materia.id] === status).length;
  const availableCount = materias.filter((materia) => estadoVisualPorMateria[materia.id] === "puedo_cursar" && materia.estadoOferta !== "inactiva").length;
  const selectedCourse = materias.find((materia) => materia.id === selectedCourseId) ?? null;
  const hasValidationIssues = validation.idsDuplicados.length > 0 || validation.correlativasInexistentes.length > 0;

  const exportData = () => {
    closeMenu();
    try {
      let content: string;
      let onlyProgress = false;
      try {
        content = crearBackup(window.localStorage, plan.plan, progreso);
      } catch {
        content = crearBackup(null, plan.plan, progreso);
        onlyProgress = true;
      }
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mi-carrera-l20-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ message: onlyProgress ? "Descargamos una copia de tus estados. No se pudieron leer el minor ni la planificación del navegador." : "Copia de seguridad descargada. Guardala para recuperar tu plan.", error: onlyProgress });
    } catch {
      setNotice({ message: "No pudimos exportar los datos. Revisá los permisos de almacenamiento del navegador.", error: true });
    }
  };

  const importData: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("El archivo es demasiado grande. El máximo es 1 MB.");
      const data = parsearBackup(await file.text(), materias, plan.plan);
      setPendingBackup({ data, name: file.name });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "No pudimos leer el archivo.", error: true });
    }
  };

  const confirmImport = () => {
    if (!pendingBackup) return;
    try {
      aplicarBackup(window.localStorage, pendingBackup.data);
      if (pendingBackup.data.progreso) reemplazarProgreso(pendingBackup.data.progreso);
      setDataRevision((value) => value + 1);
      setPendingBackup(null);
      setNotice({ message: "Copia restaurada. Tu progreso y tu planificación están listos." });
    } catch (error) {
      setPendingBackup(null);
      setNotice({ message: error instanceof Error ? error.message : "No se pudieron guardar los datos importados.", error: true });
    }
  };

  const setCourseStatus = (courseId: string, status: EstadoMateria) => {
    if ((progreso[courseId] ?? "pendiente") === status) return;
    setNotice({ message: `${materias.find((m) => m.id === courseId)?.nombre ?? "Materia"}: ${STATUS_LABEL[status]}.`, previous: { ...progreso }, courseId });
    actualizarEstadosMasivos([courseId], status);
  };
  const undo = () => {
    if (!notice?.previous) return;
    reemplazarProgreso(notice.previous);
    setNotice({ message: "Cambio deshecho. Recuperaste el estado anterior." });
  };
  const confirmAction = () => {
    const previous = { ...progreso };
    if (confirmation === "reset") resetearProgreso();
    else aprobarCursadas();
    setNotice({ message: confirmation === "reset" ? "Estados reiniciados." : "Las materias cursando ahora están regulares.", previous });
    setConfirmation(null);
  };
  const toggleTheme = () => {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    try { window.localStorage.setItem("malla-curricular:theme:v1", dark ? "dark" : "light"); } catch { /* The theme still works for this session. */ }
  };

  const navigation = (mobile = false) => (
    <nav aria-label={mobile ? "Navegación móvil" : "Secciones principales"} className={mobile ? "grid grid-cols-3 gap-1" : "space-y-2"}>
      {VIEWS.map((item) => {
        const Icon = item.icon;
        const active = view === item.id;
        return <button key={item.id} type="button" onClick={() => changeView(item.id)} aria-current={active ? "page" : undefined}
          className={`flex w-full items-center gap-3 rounded-xl transition ${mobile ? "min-h-12 justify-center px-2" : "min-h-16 px-3.5 text-left"} ${active ? "bg-blue-700 text-white shadow-sm shadow-blue-700/10" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"}`}>
          <Icon className="size-[18px] shrink-0" />
          <span><span className="block text-xs font-semibold sm:text-sm">{item.label}</span>{!mobile ? <span className={`mt-1 block text-[11px] ${active ? "text-blue-100" : "text-slate-400"}`}>{item.description}</span> : null}</span>
        </button>;
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-950">
      <a href="#main-content" className="skip-link">Saltar al contenido</a>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => changeView("avance")} className="flex min-w-0 items-center gap-3 rounded-xl text-left">
            <span className="brand-mark grid size-10 shrink-0 place-items-center rounded-[14px] text-white"><GraduationCap className="size-[22px]" /></span>
            <span className="min-w-0"><span className="block text-lg font-bold tracking-tight">Mi carrera<span className="text-blue-600">.</span></span><span className="block truncate text-[10px] font-medium tracking-wide text-slate-500 sm:text-[11px]">GESTIÓN DE NEGOCIOS · L20</span></span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`hidden items-center gap-1.5 text-xs sm:inline-flex ${storageError ? "text-amber-800" : "text-slate-500"}`} title="Tus datos se guardan en este navegador. Exportá una copia para llevarlos a otro dispositivo.">
              {storageError ? <AlertCircle className="size-3.5" /> : <span className="size-1.5 rounded-full bg-emerald-500" />}
              {storageError ? "Sin guardar" : storageSincronizado ? "Guardado en este dispositivo" : "Cargando progreso…"}
            </span>
            <button type="button" onClick={toggleTheme} aria-label="Cambiar entre modo claro y oscuro" title="Cambiar tema" className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-slate-400">
              <Moon className="size-4 dark:hidden" /><Sun className="hidden size-4 dark:block" />
            </button>
            <details ref={menuRef} className="group relative">
              <summary className="flex min-h-10 list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-slate-400"><span className="sm:hidden">Datos</span><span className="hidden sm:inline">Mis datos</span> <ChevronDown className="size-3.5 transition group-open:rotate-180" /></summary>
              <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <p className="px-3 py-2 text-xs leading-5 text-slate-500">Tu progreso vive en este navegador. Llevate una copia cuando quieras.</p>
                <button type="button" onClick={exportData} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-700 hover:bg-slate-100"><Download className="size-4" /> Descargar copia</button>
                <button type="button" onClick={() => { closeMenu(); importRef.current?.click(); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-700 hover:bg-slate-100"><Upload className="size-4" /> Restaurar copia</button>
                <div className="my-1 border-t border-slate-100" />
                <button type="button" onClick={() => { closeMenu(); setConfirmation("reset"); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-rose-700 hover:bg-rose-50"><RotateCcw className="size-4" /> Reiniciar estados</button>
              </div>
            </details>
            <input ref={importRef} type="file" accept="application/json,.json" aria-label="Seleccionar copia de seguridad" className="hidden" onChange={importData} />
          </div>
        </div>
        <div className="border-t border-slate-100 px-3 py-2 lg:hidden">{navigation(true)}</div>
      </header>

      <div className="mx-auto max-w-[1600px] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="sticky top-[76px] hidden h-[calc(100dvh-76px)] flex-col overflow-y-auto border-r border-slate-200 px-5 py-7 lg:flex">
          <p className="mb-4 px-3 text-[10px] font-bold tracking-[0.17em] text-slate-400">TU ESPACIO ACADÉMICO</p>
          {navigation()}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-600">Hacia tu título</span><GraduationCap className="size-4 text-blue-600" /></div>
            <p className="mt-4 text-3xl font-semibold tracking-tight">{progressPercent.toFixed(0)}<span className="ml-0.5 text-lg text-slate-400">%</span></p>
            <div role="progressbar" aria-label="Créditos completados para el título" aria-valuemin={0} aria-valuemax={plan.creditosTitulo} aria-valuenow={degreeCredits} className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="absolute inset-y-0 left-0 rounded-full bg-blue-200" style={{ width: `${projectedPercent}%` }} /><div className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-[width]" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500"><strong className="font-semibold text-slate-700">{degreeCredits}</strong> de {plan.creditosTitulo} créditos</p>
            <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-500">{projectedCredits > degreeCredits ? `${projectedCredits} créditos si aprobás lo que tenés en curso y regular.` : "Cada materia aprobada hace crecer tu recorrido."}</p>
          </div>
          <div className="mt-auto px-2 pt-8"><ShieldCheck className="mb-2 size-5 text-slate-400" /><p className="text-xs font-medium text-slate-600">Tu plan, siempre a mano</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Guardá una copia de tus materias, electivas y cuatrimestres.</p><button type="button" onClick={exportData} className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-blue-700"><ArrowDownToLine className="size-3.5" /> Descargar mi copia</button></div>
        </aside>

        <main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-6 pb-24 outline-none sm:px-6 sm:py-8 lg:px-8 lg:py-9">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">{VIEWS.find((item) => item.id === view)?.label} <span className="mx-1 text-slate-300">/</span> Plan {plan.plan}</p><h1 className="text-[27px] font-semibold leading-tight tracking-[-0.035em] sm:text-[34px]">{PAGE_COPY[view].title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{PAGE_COPY[view].subtitle}</p></div>
            {view === "avance" ? <button type="button" onClick={() => changeView("planificar")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-800"><CalendarRange className="size-4" /> Armar mi cuatrimestre <ArrowRight className="size-4" /></button> : null}
          </div>
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 lg:hidden"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-700">Hacia tu título</span><span className="text-slate-500">{degreeCredits} de {plan.creditosTitulo} cr · {progressPercent.toFixed(0)}%</span></div><div role="progressbar" aria-label="Créditos completados para el título" aria-valuemin={0} aria-valuemax={plan.creditosTitulo} aria-valuenow={degreeCredits} className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="absolute inset-y-0 left-0 rounded-full bg-blue-200" style={{ width: `${projectedPercent}%` }} /><div className="absolute inset-y-0 left-0 rounded-full bg-blue-600" style={{ width: `${progressPercent}%` }} /></div></div>
          {storageError ? <div role="alert" className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle className="size-5 shrink-0" /><p>{storageError}</p></div> : null}
          {hasValidationIssues ? <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">El plan tiene {validation.idsDuplicados.length} códigos duplicados y {validation.correlativasInexistentes.length} correlativas sin materia asociada.</div> : null}

          {view === "avance" ? <section aria-label="Resumen de tu carrera" className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "Créditos aprobados", value: `${creditosAprobados}`, suffix: "cr", detail: `${courseCount("aprobada")} ${courseCount("aprobada") === 1 ? "materia finalizada" : "materias finalizadas"}`, color: "bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
              { label: "En curso", value: `${creditosCursando}`, suffix: "cr", detail: `${courseCount("cursando")} ${courseCount("cursando") === 1 ? "materia cursando" : "materias cursando"}`, color: "bg-blue-50 text-blue-800", icon: BookOpenCheck },
              { label: "Finales pendientes", value: `${courseCount("regular")}`, suffix: "", detail: "materias con cursada aprobada", color: "bg-amber-50 text-amber-800", icon: Clock3 },
              { label: "Podés cursar", value: `${availableCount}`, suffix: "", detail: "materias con requisitos cumplidos", color: "bg-indigo-50 text-indigo-800", icon: Layers3 },
            ].map((item) => { const Icon = item.icon; return <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">{item.label}</p><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${item.color}`}><Icon className="size-4" /></span></div><p className="mt-3 text-3xl font-semibold tracking-tight">{item.value}<span className="ml-1 text-sm font-normal text-slate-400">{item.suffix}</span></p><p className="mt-1 text-[11px] leading-4 text-slate-500">{item.detail}</p></div>; })}
          </section> : null}

          {view === "avance" ? <DashboardView materias={materias} progreso={progreso} estadoVisualPorMateria={estadoVisualPorMateria} onOpenCourse={setSelectedCourseId} onPlan={() => changeView("planificar")} />
            : view === "minors" ? <MinorsView key={`minors-${dataRevision}`} materias={materias} progreso={progreso} onOpenCourse={setSelectedCourseId} />
            : <PlannerView key={`planner-${dataRevision}`} materias={materias} progreso={progreso} materiasHabilitadas={materiasHabilitadas} onOpenCourse={setSelectedCourseId} />}
          {courseCount("cursando") > 0 && view === "avance" ? <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4"><div><p className="text-sm font-semibold text-blue-800">¿Terminaste la cursada?</p><p className="mt-1 text-xs text-blue-700">Pasá tus {courseCount("cursando")} materias en curso a regulares.</p></div><button type="button" onClick={() => setConfirmation("regularize")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-xs font-semibold text-blue-700"><Check className="size-4" /> Cerrar cursada</button></div> : null}
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5 text-[11px] leading-5 text-slate-400"><span>Mi carrera · Gestión de Negocios · Plan L20</span><span>Verificá la oferta y los requisitos de inscripción en el SGA.</span></footer>
        </main>
      </div>

      {notice ? <div role={notice.error ? "alert" : "status"} className={`fixed bottom-5 left-4 right-4 z-[70] flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-xl sm:left-auto sm:max-w-lg ${notice.error ? "border-rose-200" : "border-slate-200"}`}><span className={notice.error ? "text-rose-700" : "text-emerald-700"}>{notice.error ? <AlertCircle className="size-5" /> : <CheckCircle2 className="size-5" />}</span><p className="flex-1 text-sm text-slate-700">{notice.message}</p>{notice.previous ? <button type="button" onClick={undo} className="min-h-10 rounded-lg px-2 text-xs font-semibold text-blue-700">Deshacer</button> : null}<button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)} className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="size-4" /></button></div> : null}
      <CourseDrawer materia={selectedCourse} materias={materias} progreso={progreso} habilitada={selectedCourse ? materiasHabilitadas[selectedCourse.id] ?? false : false} onClose={closeCourse} onSetEstado={setCourseStatus} onOpenCourse={setSelectedCourseId} onUndo={notice?.previous && notice.courseId === selectedCourseId ? undo : undefined} />
      <Modal open={confirmation !== null || pendingBackup !== null} onClose={() => { setConfirmation(null); setPendingBackup(null); }} labelledBy="confirm-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl p-6">
        <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">{pendingBackup ? <Upload className="size-5" /> : <Undo2 className="size-5" />}</span>
        <h2 id="confirm-title" className="text-xl font-semibold tracking-tight">{pendingBackup ? "Restaurar tu copia" : confirmation === "reset" ? "¿Reiniciar los estados?" : "¿Cerrar la cursada?"}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{pendingBackup ? `“${pendingBackup.name}” contiene ${pendingBackup.data.materiasConProgreso} ${pendingBackup.data.materiasConProgreso === 1 ? "materia" : "materias"} con progreso y ${pendingBackup.data.materiasPlanificadas} ${pendingBackup.data.materiasPlanificadas === 1 ? "materia planificada" : "materias planificadas"}. Reemplazará los apartados incluidos en la copia.` : confirmation === "reset" ? "Todas las materias volverán a pendientes. Tu minor y tus cuatrimestres se conservan. Podés deshacer el cambio desde el aviso." : `Las ${courseCount("cursando")} materias que estás cursando pasarán a regulares. Los finales quedarán pendientes.`}</p>
        {pendingBackup ? <button type="button" onClick={exportData} className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-blue-700"><Download className="size-4" /> Descargar una copia de mis datos actuales</button> : null}
        <div className="mt-6 flex justify-end gap-2"><button type="button" autoFocus onClick={() => { setConfirmation(null); setPendingBackup(null); }} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancelar</button><button type="button" onClick={pendingBackup ? confirmImport : confirmAction} className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-white ${confirmation === "reset" ? "bg-rose-700 hover:bg-rose-800" : "bg-blue-700 hover:bg-blue-800"}`}>{pendingBackup ? "Restaurar copia" : confirmation === "reset" ? "Reiniciar estados" : "Marcar regulares"}</button></div>
      </Modal>
    </div>
  );
}
