"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  Filter,
  Laptop,
  MousePointerClick,
  Search,
  Upload,
  X,
} from "lucide-react";

import { enriquecerMateriasConMinors } from "@/data/minorsMetadata";
import planRaw from "@/data/planDeEstudio.json";
import { LeyendaEstados } from "@/components/LeyendaEstados";
import { DetalleMateriaPanel } from "@/components/DetalleMateriaPanel";
import { MallaGrid } from "@/components/MallaGrid";
import { PlanificadorCuatris } from "@/components/PlanificadorCuatris";
import { SeccionMinors } from "@/components/SeccionMinors";
import { validarPlan } from "@/lib/planUtils";
import { useProgreso } from "@/hooks/useProgreso";
import type { EstadoMateria, PlanDeEstudio, SlotElectiva8Cuat } from "@/types/plan";

const plan = planRaw as PlanDeEstudio;
const ONBOARDING_STORAGE_KEY = "tablero-materias:onboarding-v1";
const UI_STORAGE_KEY = "tablero-materias:ui:v1";
const STORAGE_PLANNER_KEY = "tablero-materias:planificador:v1";
const STORAGE_PROGRESO_KEY = "malla-curricular:progreso:v1";
const STORAGE_MINORS_KEY = "malla-curricular:minors:v1";
const STORAGE_PLAN_MINORS_KEY = "malla-curricular:plan-minors:v1";

type VistaActiva = "malla" | "minors" | "planificador";
type FiltroEstadoTablero =
  | "todas"
  | "pendiente"
  | "cursando"
  | "regular"
  | "aprobada"
  | "puedo_cursar"
  | "habilitable_preview";
type FiltroGrupoTablero =
  | "todos"
  | "troncales"
  | "gestion"
  | "tecnologia"
  | "proyecto-final"
  | "skills";
type ModoVistaTablero = "anios" | "columnas";

interface PreferenciasTablero {
  vistaActiva: VistaActiva;
  busqueda: string;
  filtroEstado: FiltroEstadoTablero;
  filtroGrupo: FiltroGrupoTablero;
  modoVista: ModoVistaTablero;
  usarCardsCompactas: boolean;
}

function parsearPreferenciasTablero(raw: string | null): Partial<PreferenciasTablero> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Partial<PreferenciasTablero> = {};

    if (
      parsed.vistaActiva === "malla" ||
      parsed.vistaActiva === "minors" ||
      parsed.vistaActiva === "planificador"
    ) {
      next.vistaActiva = parsed.vistaActiva;
    }

    if (typeof parsed.busqueda === "string") {
      next.busqueda = parsed.busqueda;
    }

    if (
      parsed.filtroEstado === "todas" ||
      parsed.filtroEstado === "pendiente" ||
      parsed.filtroEstado === "cursando" ||
      parsed.filtroEstado === "regular" ||
      parsed.filtroEstado === "aprobada" ||
      parsed.filtroEstado === "puedo_cursar" ||
      parsed.filtroEstado === "habilitable_preview"
    ) {
      next.filtroEstado = parsed.filtroEstado;
    }

    if (
      parsed.filtroGrupo === "todos" ||
      parsed.filtroGrupo === "troncales" ||
      parsed.filtroGrupo === "gestion" ||
      parsed.filtroGrupo === "tecnologia" ||
      parsed.filtroGrupo === "proyecto-final" ||
      parsed.filtroGrupo === "skills"
    ) {
      next.filtroGrupo = parsed.filtroGrupo;
    }

    if (parsed.modoVista === "anios" || parsed.modoVista === "columnas") {
      next.modoVista = parsed.modoVista;
    }

    if (typeof parsed.usarCardsCompactas === "boolean") {
      next.usarCardsCompactas = parsed.usarCardsCompactas;
    }

    return next;
  } catch {
    return {};
  }
}

export function MallaApp() {
  const materias = useMemo(() => enriquecerMateriasConMinors(plan.materias), []);
  const validacion = useMemo(() => validarPlan(materias), [materias]);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [slotActivo, setSlotActivo] = useState<SlotElectiva8Cuat>("gestion");
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>("malla");
  const [headerCompacto, setHeaderCompacto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoTablero>("todas");
  const [filtroGrupo, setFiltroGrupo] = useState<FiltroGrupoTablero>("todos");
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [modoVista, setModoVista] = useState<ModoVistaTablero>("anios");
  const [usarCardsCompactas, setUsarCardsCompactas] = useState(true);
  const [uiSincronizada, setUiSincronizada] = useState(false);

  const {
    progreso,
    estadoVisualPorMateria,
    materiasHabilitadas,
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
  const [materiaDetalleId, setMateriaDetalleId] = useState<string | null>(null);

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
    const plannerRaw = window.localStorage.getItem(STORAGE_PLANNER_KEY);
    const uiRaw = window.localStorage.getItem(UI_STORAGE_KEY);
    const onboardingRaw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);

    const payload = {
      version: 2,
      generadoEn: new Date().toISOString(),
      plan: {
        codigo: plan.plan,
        creditosTitulo: plan.creditosTitulo,
        cantidadMaterias: materias.length,
      },
      appState: {
        progreso: progresoRaw ? JSON.parse(progresoRaw) : {},
        minors: minorsRaw ? JSON.parse(minorsRaw) : [],
        materiasPlanMinors: planMinorsRaw ? JSON.parse(planMinorsRaw) : [],
        planner: plannerRaw ? JSON.parse(plannerRaw) : { version: 2, planificador: {} },
        uiPreferences: uiRaw ? JSON.parse(uiRaw) : {},
        onboardingVisto: onboardingRaw === "1",
      },
      storageDump: {
        [STORAGE_PROGRESO_KEY]: progresoRaw ? JSON.parse(progresoRaw) : {},
        [STORAGE_MINORS_KEY]: minorsRaw ? JSON.parse(minorsRaw) : [],
        [STORAGE_PLAN_MINORS_KEY]: planMinorsRaw ? JSON.parse(planMinorsRaw) : [],
        [STORAGE_PLANNER_KEY]: plannerRaw ? JSON.parse(plannerRaw) : { version: 2, planificador: {} },
        [UI_STORAGE_KEY]: uiRaw ? JSON.parse(uiRaw) : {},
        [ONBOARDING_STORAGE_KEY]: onboardingRaw === "1",
      },
      snapshot: {
        vistaActiva,
        hashActual: window.location.hash || "#tablero",
        creditosAprobados,
        creditosCursando,
        creditosProyectados,
        proyeccionGraduacion,
      },
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
          planner?: unknown;
          uiPreferences?: unknown;
          onboardingVisto?: unknown;
          appState?: {
            progreso?: unknown;
            minors?: unknown;
            materiasPlanMinors?: unknown;
            planner?: unknown;
            uiPreferences?: unknown;
            onboardingVisto?: unknown;
          };
          storageDump?: Record<string, unknown>;
        };

        const progresoImportado = parsed.appState?.progreso ?? parsed.progreso;
        const minorsImportados = parsed.appState?.minors ?? parsed.minors;
        const planMinorsImportados = parsed.appState?.materiasPlanMinors ?? parsed.materiasPlanMinors;
        const plannerImportado =
          parsed.appState?.planner ?? parsed.planner ?? parsed.storageDump?.[STORAGE_PLANNER_KEY];
        const uiImportada =
          parsed.appState?.uiPreferences ?? parsed.uiPreferences ?? parsed.storageDump?.[UI_STORAGE_KEY];
        const onboardingImportado =
          parsed.appState?.onboardingVisto ??
          parsed.onboardingVisto ??
          parsed.storageDump?.[ONBOARDING_STORAGE_KEY];

        if (progresoImportado && typeof progresoImportado === "object") {
          window.localStorage.setItem(STORAGE_PROGRESO_KEY, JSON.stringify(progresoImportado));
        }
        if (minorsImportados && Array.isArray(minorsImportados)) {
          window.localStorage.setItem(STORAGE_MINORS_KEY, JSON.stringify(minorsImportados));
        }
        if (planMinorsImportados && Array.isArray(planMinorsImportados)) {
          window.localStorage.setItem(
            STORAGE_PLAN_MINORS_KEY,
            JSON.stringify(planMinorsImportados),
          );
        }
        if (plannerImportado && typeof plannerImportado === "object") {
          window.localStorage.setItem(STORAGE_PLANNER_KEY, JSON.stringify(plannerImportado));
        }
        if (uiImportada && typeof uiImportada === "object") {
          window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(uiImportada));
        }
        if (typeof onboardingImportado === "boolean") {
          window.localStorage.setItem(ONBOARDING_STORAGE_KEY, onboardingImportado ? "1" : "0");
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

  const creditosProyectados = (() => {
    let total = creditosAprobados;

    for (const materia of materias) {
      const estado = progreso[materia.id] ?? "pendiente";
      if (estado === "cursando" || estado === "regular") {
        total += materia.creditos;
      }
    }

    return Math.min(total, plan.creditosTitulo);
  })();

  const proyeccionGraduacion = (() => {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const creditosRestantes = Math.max(0, plan.creditosTitulo - creditosProyectados);
    const creditosPorCuatrimestre = 24;

    const formatear = (mes: "julio" | "diciembre", anio: number) => `${mes} de ${anio}`;

    if (creditosRestantes === 0) {
      return mesActual >= 8 ? formatear("diciembre", anioActual) : formatear("julio", anioActual);
    }

    let etapa: 0 | 1 | 2;
    let anio = anioActual;

    if (mesActual <= 2) etapa = 0;
    else if (mesActual <= 7) etapa = 1;
    else etapa = 2;

    const cuatrimestresNecesarios = Math.ceil(creditosRestantes / creditosPorCuatrimestre);

    for (let index = 0; index < cuatrimestresNecesarios; index += 1) {
      if (etapa === 0) {
        etapa = 1;
      } else if (etapa === 1) {
        etapa = 2;
      } else {
        anio += 1;
        etapa = 1;
      }
    }

    return formatear(etapa === 2 ? "diciembre" : "julio", anio);
  })();

  const materiasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return materias.filter((materia) => {
      const coincideBusqueda =
        termino.length === 0 ||
        materia.id.toLowerCase().includes(termino) ||
        materia.nombre.toLowerCase().includes(termino);

      const estadoVisual = estadoVisualPorMateria[materia.id] ?? "pendiente";
      const coincideEstado = filtroEstado === "todas" || estadoVisual === filtroEstado;

      const coincideGrupo = (() => {
        if (filtroGrupo === "todos") return true;
        if (filtroGrupo === "troncales") return materia.cuatrimestre <= 7;
        if (filtroGrupo === "gestion") return materia.grupo === "electiva-gestion";
        if (filtroGrupo === "tecnologia") return materia.grupo === "electiva-sistemas-tecnologia";
        if (filtroGrupo === "proyecto-final") return materia.grupo === "electiva-proyecto-final";
        return materia.grupo === "skills-complementarias";
      })();

      return coincideBusqueda && coincideEstado && coincideGrupo;
    });
  }, [busqueda, estadoVisualPorMateria, filtroEstado, filtroGrupo, materias]);

  const resumenFiltros = useMemo(() => {
    return {
      visibles: materiasFiltradas.length,
      total: materias.length,
      aprobadas: materiasFiltradas.filter(
        (materia) => (progreso[materia.id] ?? "pendiente") === "aprobada",
      ).length,
      cursables: materiasFiltradas.filter(
        (materia) => (estadoVisualPorMateria[materia.id] ?? "pendiente") === "puedo_cursar",
      ).length,
      seleccionadas: materiasFiltradas.filter((materia) => materiasSeleccionadas.has(materia.id)).length,
    };
  }, [estadoVisualPorMateria, materias, materiasFiltradas, materiasSeleccionadas, progreso]);

  const filtrosActivos =
    busqueda.trim().length > 0 || filtroEstado !== "todas" || filtroGrupo !== "todos";

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("todas");
    setFiltroGrupo("todos");
  };

  const handleSeleccionarSlot = (slot: SlotElectiva8Cuat) => {
    setSlotActivo(slot);
  };

  const handleCardClick = (materiaId: string) => {
    actualizarEstado(materiaId);
  };

  const materiaDetalle = useMemo(
    () => materias.find((materia) => materia.id === materiaDetalleId) ?? null,
    [materiaDetalleId, materias],
  );

  const handleOpenDetalle = (materiaId: string) => {
    setMateriaDetalleId(materiaId);
  };

  const handleCloseDetalle = () => {
    setMateriaDetalleId(null);
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
    const frameId = window.requestAnimationFrame(() => {
      const preferencias = parsearPreferenciasTablero(window.localStorage.getItem(UI_STORAGE_KEY));

      setBusqueda(preferencias.busqueda ?? "");
      setFiltroEstado(preferencias.filtroEstado ?? "todas");
      setFiltroGrupo(preferencias.filtroGrupo ?? "todos");
      setModoVista(preferencias.modoVista ?? "anios");
      setUsarCardsCompactas(preferencias.usarCardsCompactas ?? true);

      if (!window.location.hash && preferencias.vistaActiva) {
        setVistaActiva(preferencias.vistaActiva);
      }

      setUiSincronizada(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const actualizarAltura = () => {
      setTopBarHeight(topBarRef.current?.getBoundingClientRect().height ?? 0);
    };

    actualizarAltura();

    const observer = new ResizeObserver(() => actualizarAltura());
    if (topBarRef.current) {
      observer.observe(topBarRef.current);
    }

    window.addEventListener("resize", actualizarAltura);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", actualizarAltura);
    };
  }, []);

  useEffect(() => {
    const actualizarCompacto = () => {
      setHeaderCompacto(window.scrollY > 72);
    };

    actualizarCompacto();
    window.addEventListener("scroll", actualizarCompacto, { passive: true });

    return () => window.removeEventListener("scroll", actualizarCompacto);
  }, []);

  useEffect(() => {
    const actualizarVista = () => {
      const hash = window.location.hash.slice(1);
      const preferencias = parsearPreferenciasTablero(window.localStorage.getItem(UI_STORAGE_KEY));

      if (hash === "minors") {
        setVistaActiva("minors");
      } else if (hash === "planificador") {
        setVistaActiva("planificador");
      } else {
        setVistaActiva(preferencias.vistaActiva ?? "malla");
      }
    };

    actualizarVista();
    window.addEventListener("hashchange", actualizarVista);

    return () => window.removeEventListener("hashchange", actualizarVista);
  }, []);

  const cambiarVista = (vista: VistaActiva) => {
    window.location.hash =
      vista === "minors" ? "minors" : vista === "planificador" ? "planificador" : "";
    setVistaActiva(vista);
  };

  useEffect(() => {
    if (!uiSincronizada) return;

    const preferencias: PreferenciasTablero = {
      vistaActiva,
      busqueda,
      filtroEstado,
      filtroGrupo,
      modoVista,
      usarCardsCompactas,
    };

    window.localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(preferencias));
  }, [busqueda, filtroEstado, filtroGrupo, modoVista, uiSincronizada, usarCardsCompactas, vistaActiva]);

  useEffect(() => {
    const targetEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (vistaActiva !== "malla") return;

      const focusBuscar = () => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      };

      const comandoBuscar = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      const slashBuscar = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey;

      if (comandoBuscar) {
        event.preventDefault();
        focusBuscar();
        return;
      }

      if (slashBuscar && !targetEditable(event.target)) {
        event.preventDefault();
        focusBuscar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [vistaActiva]);

  const handleCerrarOnboarding = () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    setMostrarOnboarding(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div ref={topBarRef} className="fixed inset-x-0 top-0 z-50 bg-slate-950/96 backdrop-blur">
        <LeyendaEstados
          creditosAprobados={creditosAprobados}
          creditosCursando={creditosCursando}
          creditosProyectados={creditosProyectados}
          creditosTitulo={plan.creditosTitulo}
          proyeccionGraduacion={proyeccionGraduacion}
          compacta={headerCompacto}
          vistaActiva={vistaActiva}
          onAprobarCursadas={aprobarCursadas}
          onReset={() => {
            if (window.confirm("Se va a borrar todo el progreso guardado. ¿Continuar?")) {
              resetearProgreso();
            }
          }}
        />

        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 border-b border-slate-800/80 px-4 py-3">
          <nav className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => cambiarVista("malla")}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                vistaActiva === "malla"
                  ? "bg-cyan-500/20 text-cyan-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              Tablero
            </button>
            <button
              type="button"
              onClick={() => cambiarVista("minors")}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                vistaActiva === "minors"
                  ? "bg-violet-500/20 text-violet-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              Minors
            </button>
            <button
              type="button"
              onClick={() => cambiarVista("planificador")}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                vistaActiva === "planificador"
                  ? "bg-emerald-500/20 text-emerald-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              Planificador
            </button>
          </nav>
        </div>
      </div>

      <div style={{ paddingTop: topBarHeight > 0 ? topBarHeight + 12 : undefined }}>
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

      {vistaActiva === "malla" ? (
        <>
          <section
            className="sticky z-40 mx-auto flex w-full max-w-[1800px] flex-col gap-3 bg-slate-950/95 px-4 py-2 text-xs text-slate-300 backdrop-blur"
            style={{ top: topBarHeight > 0 ? topBarHeight : 0 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSeleccionMultiple}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-[11px] transition-colors ${
                    seleccionMultipleActiva
                      ? "border-cyan-400 bg-cyan-900/40 text-cyan-100"
                      : "border-slate-600 text-slate-200 hover:border-slate-300 hover:bg-slate-900"
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
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-sky-500/70 px-2 py-0.5 text-[11px] text-sky-100 transition-colors hover:border-sky-300 hover:bg-sky-950/30"
                    >
                      Cursando
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarcarSeleccionadas("regular")}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-500/70 px-2 py-0.5 text-[11px] text-amber-100 transition-colors hover:border-amber-300 hover:bg-amber-950/30"
                    >
                      Regular
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarcarSeleccionadas("aprobada")}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-emerald-500/70 px-2 py-0.5 text-[11px] text-emerald-100 transition-colors hover:border-emerald-300 hover:bg-emerald-950/30"
                    >
                      Aprobada
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMarcarSeleccionadas("pendiente")}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-500/70 px-2 py-0.5 text-[11px] text-slate-100 transition-colors hover:border-slate-300 hover:bg-slate-900"
                    >
                      Volver a pendiente
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Activá la selección múltiple para marcar varias materias rápido.
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-100 transition-colors hover:border-slate-300 hover:bg-slate-900"
                >
                  <Download className="h-3 w-3" />
                  Exportar JSON
                </button>
                <button
                  type="button"
                  onClick={handleClickImport}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-600 px-3 py-1 text-[11px] text-slate-100 transition-colors hover:border-slate-300 hover:bg-slate-900"
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
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3 shadow-[0_10px_24px_rgba(2,6,23,0.35)]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                  <label className="relative block flex-1 min-w-[16rem]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={busqueda}
                      onChange={(event) => setBusqueda(event.target.value)}
                      placeholder="Buscar por código o nombre"
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950/70 pl-9 pr-9 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400"
                    />
                    {busqueda ? (
                      <button
                        type="button"
                        onClick={() => setBusqueda("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-500 transition-colors hover:text-slate-200"
                        aria-label="Limpiar búsqueda"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950/70 p-1">
                      <button
                        type="button"
                        onClick={() => setModoVista("anios")}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                          modoVista === "anios"
                            ? "bg-cyan-500/20 text-cyan-100"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        Por años
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoVista("columnas")}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                          modoVista === "columnas"
                            ? "bg-cyan-500/20 text-cyan-100"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        Columnas
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setUsarCardsCompactas((actual) => !actual)}
                      className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[11px] transition-colors ${
                        usarCardsCompactas
                          ? "border-cyan-500/50 bg-cyan-950/20 text-cyan-100"
                          : "border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-900"
                      }`}
                    >
                      {usarCardsCompactas ? "Cards compactas" : "Cards cómodas"}
                    </button>

                    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2">
                      <Filter className="h-4 w-4 text-slate-500" />
                      <select
                        value={filtroEstado}
                        onChange={(event) => setFiltroEstado(event.target.value as FiltroEstadoTablero)}
                        className="cursor-pointer bg-transparent text-[12px] text-slate-200 outline-none"
                      >
                        <option value="todas">Todos los estados</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="puedo_cursar">Puedo cursar</option>
                        <option value="habilitable_preview">Habilitable</option>
                        <option value="cursando">Cursando</option>
                        <option value="regular">Regular</option>
                        <option value="aprobada">Aprobada</option>
                      </select>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2">
                      <select
                        value={filtroGrupo}
                        onChange={(event) => setFiltroGrupo(event.target.value as FiltroGrupoTablero)}
                        className="cursor-pointer bg-transparent text-[12px] text-slate-200 outline-none"
                      >
                        <option value="todos">Todo el plan</option>
                        <option value="troncales">Solo troncales</option>
                        <option value="gestion">Electivas de gestión</option>
                        <option value="tecnologia">Electivas de tecnología</option>
                        <option value="proyecto-final">Proyecto final</option>
                        <option value="skills">Skills complementarias</option>
                      </select>
                    </div>

                    {filtrosActivos ? (
                      <button
                        type="button"
                        onClick={limpiarFiltros}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-600 px-3 py-2 text-[11px] text-slate-200 transition-colors hover:border-slate-400 hover:bg-slate-900"
                      >
                        <X className="h-3.5 w-3.5" />
                        Limpiar filtros
                      </button>
                    ) : null}

                    <span className="hidden rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400 lg:inline-flex">
                      `/` o `Ctrl/Cmd + K` para buscar
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-slate-300">
                    {resumenFiltros.visibles} / {resumenFiltros.total} visibles
                  </span>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-950/20 px-3 py-1 text-emerald-200">
                    {resumenFiltros.aprobadas} aprobadas
                  </span>
                  <span className="rounded-full border border-slate-200/30 bg-slate-900 px-3 py-1 text-slate-200">
                    {resumenFiltros.cursables} cursables
                  </span>
                  {seleccionMultipleActiva ? (
                    <span className="rounded-full border border-cyan-500/40 bg-cyan-950/20 px-3 py-1 text-cyan-200">
                      {resumenFiltros.seleccionadas} visibles seleccionadas
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <div className="px-4 pb-8">
            <MallaGrid
              materias={materiasFiltradas}
              estadoVisualPorMateria={estadoVisualPorMateria}
              onMateriaClick={handleCardClick}
              onOpenDetail={handleOpenDetalle}
              progresoSlots8Cuat={progresoSlots8Cuat}
              onSeleccionarSlot={handleSeleccionarSlot}
              slotActivo={slotActivo}
              seleccionMultipleActiva={seleccionMultipleActiva}
              materiasSeleccionadas={materiasSeleccionadas}
              onToggleSeleccion={handleToggleSeleccionMateria}
              modoVista={modoVista}
              compacta={usarCardsCompactas}
            />
          </div>
        </>
      ) : vistaActiva === "planificador" ? (
        <div className="px-4 pb-8 pt-2">
          <PlanificadorCuatris
            materias={materias}
            progreso={progreso}
            materiasHabilitadas={materiasHabilitadas}
          />
        </div>
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
                  <br />
                  <span className="text-slate-200">Planificador</span>: armá cuatrimestres futuros sin mezclarlo con el tablero.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-6 py-4">
              <p className="text-xs text-slate-500">Este mensaje aparece solo la primera vez.</p>
              <button
                type="button"
                onClick={handleCerrarOnboarding}
                className="cursor-pointer rounded-lg border border-cyan-400 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300 hover:bg-cyan-500/30"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DetalleMateriaPanel
        materia={materiaDetalle}
        materias={materias}
        progreso={progreso}
        estadoVisualPorMateria={estadoVisualPorMateria}
        materiasHabilitadas={materiasHabilitadas}
        onClose={handleCloseDetalle}
        onCambiarEstado={(materiaId) => {
          actualizarEstado(materiaId);
        }}
      />
      </div>
    </div>
  );
}
