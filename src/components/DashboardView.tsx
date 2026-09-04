"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Filter,
  GraduationCap,
  LayoutGrid,
  List,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import type {
  EstadoMateria,
  EstadoVisualMateria,
  GrupoMateria,
  MateriaPlan,
  ProgresoMaterias,
} from "@/types/plan";

interface DashboardViewProps {
  materias: MateriaPlan[];
  progreso: ProgresoMaterias;
  estadoVisualPorMateria: Record<string, EstadoVisualMateria>;
  onOpenCourse: (materiaId: string) => void;
  onPlan?: () => void;
}

type Scope = "plan" | "electivas" | "complementarias" | "todas";
type FilterState = "todas" | EstadoMateria | "cursables";
type ElectiveGroup = "todas" | "gestion" | "tecnologia";
type ViewMode = "tarjetas" | "lista";

const STATE_STYLES: Record<EstadoVisualMateria, string> = {
  pendiente: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  cursando: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  regular: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  aprobada: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  puedo_cursar: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  habilitable_preview: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
};

const STATE_LABELS: Record<EstadoVisualMateria, string> = {
  pendiente: "Pendiente",
  cursando: "Cursando",
  regular: "Regular",
  aprobada: "Aprobada",
  puedo_cursar: "Podés cursar",
  habilitable_preview: "Al terminar cursadas",
};

const GROUP_LABELS: Record<GrupoMateria, string> = {
  obligatoria: "Plan base",
  "electiva-gestion": "Electivas de gestión",
  "electiva-sistemas-tecnologia": "Electivas de tecnología",
  "electiva-proyecto-final": "Proyecto final",
  "skills-complementarias": "Skills complementarias",
};

const CATALOG_GROUPS: GrupoMateria[] = [
  "electiva-gestion",
  "electiva-sistemas-tecnologia",
  "electiva-proyecto-final",
  "skills-complementarias",
];

const SCOPES: { id: Scope; label: string }[] = [
  { id: "plan", label: "Plan base" },
  { id: "electivas", label: "Electivas" },
  { id: "complementarias", label: "Proyecto y skills" },
  { id: "todas", label: "Todas" },
];

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400";

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function isElective(materia: MateriaPlan) {
  return materia.grupo === "electiva-gestion" || materia.grupo === "electiva-sistemas-tecnologia";
}

function belongsToScope(materia: MateriaPlan, scope: Scope) {
  if (scope === "todas") return true;
  if (scope === "plan") return materia.grupo === "obligatoria";
  if (scope === "electivas") return isElective(materia);
  return materia.grupo === "electiva-proyecto-final" || materia.grupo === "skills-complementarias";
}

function CourseCard({
  materia,
  estado,
  onOpen,
  compact = false,
}: {
  materia: MateriaPlan;
  estado: EstadoVisualMateria;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={`course-${materia.id}`}
      onClick={() => onOpen(materia.id)}
      className={`dashboard-course-card group w-full rounded-2xl border border-slate-200 bg-white text-left transition hover:border-blue-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 ${FOCUS} ${
        compact ? "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" : "flex min-h-36 flex-col justify-between p-4"
      }`}
    >
      <div className={`flex min-w-0 items-start gap-3 ${compact ? "flex-1 basis-48" : "w-full justify-between"}`}>
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[11px] font-medium tracking-wide text-slate-500">{materia.id}</span>
          <p className={`${compact ? "mt-0.5" : "mt-2"} text-sm font-semibold leading-relaxed text-slate-950`}>{materia.nombre}</p>
        </div>
        {!compact ? <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" /> : null}
      </div>
      <div className={`flex items-center justify-between gap-3 ${compact ? "ml-auto" : "mt-4 w-full"}`}>
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${STATE_STYLES[estado]}`}>
          {estado === "aprobada" ? <CheckCircle2 aria-hidden="true" className="size-3" /> : null}
          {STATE_LABELS[estado]}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-500">
          {materia.creditos > 0 ? `${materia.creditos} cr` : "Sin créditos"}
        </span>
      </div>
      {materia.estadoOferta === "inactiva" ? <span className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">Oferta inactiva</span> : null}
      {compact ? <ChevronRight aria-hidden="true" className="hidden size-4 shrink-0 text-slate-400 sm:block" /> : null}
    </button>
  );
}

export function DashboardView({
  materias,
  progreso,
  estadoVisualPorMateria,
  onOpenCourse,
  onPlan,
}: DashboardViewProps) {
  const [scope, setScope] = useState<Scope>("plan");
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<FilterState>("todas");
  const [electiveGroup, setElectiveGroup] = useState<ElectiveGroup>("todas");
  const [onlyActive, setOnlyActive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("tarjetas");

  const summary = useMemo(() => {
    const base = materias.filter((materia) => materia.grupo === "obligatoria");
    const available = materias.filter((materia) => estadoVisualPorMateria[materia.id] === "puedo_cursar" && materia.estadoOferta !== "inactiva");
    const following = new Map<string, number>();
    for (const materia of materias) {
      if ((progreso[materia.id] ?? "pendiente") !== "pendiente" || materia.estadoOferta === "inactiva") continue;
      for (const id of materia.correlativas) following.set(id, (following.get(id) ?? 0) + 1);
    }
    const recommended = [...available].sort((a, b) => {
      const basePriority = Number(b.grupo === "obligatoria") - Number(a.grupo === "obligatoria");
      return basePriority || (following.get(b.id) ?? 0) - (following.get(a.id) ?? 0) || a.cuatrimestre - b.cuatrimestre || a.nombre.localeCompare(b.nombre, "es");
    }).slice(0, 3);
    const byYear = new Map<number, { approved: number; total: number; credits: number; approvedCredits: number }>();
    for (const materia of base) {
      const year = Math.ceil(materia.cuatrimestre / 2);
      const entry = byYear.get(year) ?? { approved: 0, total: 0, credits: 0, approvedCredits: 0 };
      entry.total += 1;
      entry.credits += materia.creditos;
      if (progreso[materia.id] === "aprobada") {
        entry.approved += 1;
        entry.approvedCredits += materia.creditos;
      }
      byYear.set(year, entry);
    }
    return {
      base,
      available,
      recommended,
      following,
      byYear,
      approvedBase: base.filter((materia) => progreso[materia.id] === "aprobada").length,
      studying: materias.filter((materia) => progreso[materia.id] === "cursando"),
      regular: materias.filter((materia) => progreso[materia.id] === "regular"),
    };
  }, [materias, progreso, estadoVisualPorMateria]);

  const filtered = useMemo(() => {
    const terms = normalizeSearch(search).trim().split(/\s+/).filter(Boolean);
    return materias.filter((materia) => {
      if (!belongsToScope(materia, scope)) return false;
      if (terms.length > 0 && !terms.every((term) => normalizeSearch(`${materia.id} ${materia.nombre} ${GROUP_LABELS[materia.grupo]}`).includes(term))) return false;
      const visual = estadoVisualPorMateria[materia.id] ?? "pendiente";
      const persisted = progreso[materia.id] ?? "pendiente";
      if (filterState !== "todas" && (filterState === "cursables" ? visual !== "puedo_cursar" || materia.estadoOferta === "inactiva" : persisted !== filterState)) return false;
      if (scope === "electivas" && electiveGroup !== "todas") {
        const group = electiveGroup === "gestion" ? "electiva-gestion" : "electiva-sistemas-tecnologia";
        if (materia.grupo !== group) return false;
      }
      return !onlyActive || materia.estadoOferta !== "inactiva";
    });
  }, [materias, scope, search, estadoVisualPorMateria, progreso, filterState, electiveGroup, onlyActive]);

  const years = useMemo(() => {
    const grouped = new Map<number, Map<number, MateriaPlan[]>>();
    for (const materia of filtered) {
      if (materia.grupo !== "obligatoria") continue;
      const year = Math.ceil(materia.cuatrimestre / 2);
      const terms = grouped.get(year) ?? new Map<number, MateriaPlan[]>();
      const courses = terms.get(materia.cuatrimestre) ?? [];
      courses.push(materia);
      terms.set(materia.cuatrimestre, courses);
      grouped.set(year, terms);
    }
    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [filtered]);

  const hasFilters = search.trim().length > 0 || filterState !== "todas" || (scope === "electivas" && electiveGroup !== "todas") || onlyActive;
  const courseLayout = viewMode === "lista" ? "grid gap-2" : "grid gap-3 sm:grid-cols-2";
  const clearFilters = () => {
    setSearch("");
    setFilterState("todas");
    setElectiveGroup("todas");
    setOnlyActive(false);
  };
  const showState = (state: FilterState) => {
    clearFilters();
    setScope("todas");
    setFilterState(state);
    document.getElementById("course-catalog")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <div className="space-y-8">
      <section aria-label="Resumen y próximos pasos" className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="p-5 sm:p-7">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            <Sparkles aria-hidden="true" className="size-4" /> Tu próximo paso
          </span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.7rem]">
            {summary.available.length > 0 ? "Seguí construyendo tu camino" : summary.approvedBase === summary.base.length ? "Completaste las materias base" : "Cada materia te acerca"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {summary.available.length > 0
              ? "Estas materias cumplen los requisitos para cursar. Priorizamos las del plan base que son correlativas de otras pendientes."
              : summary.studying.length > 0
                ? "Ya tenés materias en marcha. Al actualizar tu progreso, vas a ver qué nuevas opciones se habilitan."
                : "Revisá tus materias regulares y los requisitos pendientes para encontrar tu próximo paso."}
          </p>
          {summary.recommended.length > 0 ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {summary.recommended.map((materia) => {
                const following = summary.following.get(materia.id) ?? 0;
                return (
                  <button key={materia.id} type="button" onClick={() => onOpenCourse(materia.id)} className={`group flex flex-col rounded-xl bg-slate-50 p-3.5 text-left transition hover:bg-blue-50 ${FOCUS}`}>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-slate-500">{materia.id}</span>
                      <ArrowRight aria-hidden="true" className="size-3.5 text-blue-600 transition group-hover:translate-x-0.5" />
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-snug text-slate-900">{materia.nombre}</p>
                    <p className="mt-auto pt-3 text-[11px] leading-4 text-slate-500">
                      {following > 0 ? `Correlativa de ${following} ${following === 1 ? "materia pendiente" : "materias pendientes"}` : `${materia.creditos} créditos`}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <BookOpen aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-blue-600" />
              <p>No hay nuevas materias habilitadas con tu progreso actual. Abrí una materia pendiente para consultar qué te falta.</p>
            </div>
          )}
        </div>
        <aside className="flex flex-col justify-between border-t border-slate-200 bg-[#eef6ff] p-5 sm:p-7 lg:border-l lg:border-t-0">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><GraduationCap aria-hidden="true" className="size-5 text-blue-700" /> Así venís hoy</div>
            <div className="mt-5 space-y-1">
              {[
                { state: "cursando" as const, count: summary.studying.length, label: "En curso", icon: CalendarDays },
                { state: "regular" as const, count: summary.regular.length, label: "Regulares", icon: CheckCircle2 },
                { state: "cursables" as const, count: summary.available.length, label: "Podés cursar", icon: CircleDashed },
              ].map(({ state, count, label, icon: Icon }) => (
                <button key={state} type="button" onClick={() => showState(state)} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-1 text-left text-sm transition hover:bg-blue-100 ${FOCUS}`}>
                  <Icon aria-hidden="true" className="size-4 text-blue-700" />
                  <span className="flex-1 text-slate-700">{label}</span>
                  <span className="font-semibold tabular-nums text-slate-950">{count}</span>
                  <ChevronRight aria-hidden="true" className="size-3.5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
          {onPlan ? (
            <button type="button" onClick={onPlan} className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 ${FOCUS}`}>
              Armar mi cuatrimestre <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </aside>
      </section>

      <section id="course-catalog" aria-label="Explorar materias" className="scroll-mt-28 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Tu plan, materia por materia</h2>
            <p className="mt-1 text-sm text-slate-500">Consultá los requisitos y mantené tu progreso al día.</p>
          </div>
          <div role="group" aria-label="Vista de materias" className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            {([{ id: "tarjetas", label: "Vista de tarjetas", icon: LayoutGrid }, { id: "lista", label: "Vista de lista", icon: List }] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" aria-label={label} title={label} aria-pressed={viewMode === id} onClick={() => setViewMode(id)} className={`flex size-9 items-center justify-center rounded-md transition ${FOCUS} ${viewMode === id ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:bg-slate-50"}`}>
                <Icon aria-hidden="true" className="size-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <div role="group" aria-label="Contenido del tablero" className="flex flex-wrap gap-1 border-b border-slate-100 pb-3">
            {SCOPES.map(({ id, label }) => (
              <button key={id} type="button" onClick={() => setScope(id)} aria-pressed={scope === id} className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition sm:px-4 ${FOCUS} ${scope === id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"}`}>
                {label}<span className="ml-2 text-[11px] font-medium tabular-nums opacity-75">{materias.filter((materia) => belongsToScope(materia, id)).length}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Buscar materia por nombre o código</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o código…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            </label>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
              <Filter aria-hidden="true" className="size-4 text-slate-500" />
              <span className="sr-only">Filtrar por estado</span>
              <select value={filterState} onChange={(event) => setFilterState(event.target.value as FilterState)} className="h-full min-w-40 flex-1 bg-transparent text-sm text-slate-700 outline-none">
                <option value="todas">Todos los estados</option>
                <option value="cursables">Podés cursar</option>
                <option value="cursando">Cursando</option>
                <option value="regular">Regular</option>
                <option value="aprobada">Aprobada</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </label>
          </div>
          {scope === "electivas" || scope === "todas" ? (
            <div className="flex flex-wrap items-center gap-2">
              {scope === "electivas" ? (
                <div role="group" aria-label="Área de las electivas" className="flex gap-1.5">
                  {(["todas", "gestion", "tecnologia"] as const).map((group) => (
                    <button key={group} type="button" onClick={() => setElectiveGroup(group)} aria-pressed={electiveGroup === group} className={`min-h-9 rounded-full border px-3 text-xs font-medium transition ${FOCUS} ${electiveGroup === group ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>
                      {group === "todas" ? "Todas las áreas" : group === "gestion" ? "Gestión" : "Tecnología"}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="inline-flex min-h-10 items-center gap-2 text-xs text-slate-600 sm:ml-auto">
                <input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} className={`size-4 rounded accent-blue-600 ${FOCUS}`} />
                Ocultar oferta inactiva
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <p role="status" aria-live="polite" className="text-xs text-slate-500"><span className="font-semibold tabular-nums text-slate-800">{filtered.length}</span> {filtered.length === 1 ? "materia" : "materias"}{hasFilters ? " con estos filtros" : ` en ${SCOPES.find((item) => item.id === scope)?.label.toLocaleLowerCase("es")}`}</p>
          <div className="flex flex-wrap items-center gap-3">
            {search.trim() && scope !== "todas" ? <button type="button" onClick={() => setScope("todas")} className={`min-h-8 text-xs font-semibold text-blue-700 ${FOCUS}`}>Buscar en todo el plan <ArrowRight aria-hidden="true" className="ml-1 inline size-3" /></button> : null}
            {hasFilters ? <button type="button" onClick={clearFilters} className={`inline-flex min-h-8 items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-950 ${FOCUS}`}><X aria-hidden="true" className="size-3.5" /> Limpiar filtros</button> : null}
          </div>
        </div>
      </section>

      <div className="space-y-9">
        {years.map(([year, terms]) => {
          const stats = summary.byYear.get(year)!;
          const percentage = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
          return (
            <section key={year} aria-labelledby={`year-${year}`} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-blue-700">{String(year).padStart(2, "0")}</span>
                  <div><h3 id={`year-${year}`} className="text-base font-semibold text-slate-950">Año {year}</h3><p className="mt-0.5 text-xs text-slate-500">{stats.approvedCredits} de {stats.credits} créditos aprobados</p></div>
                </div>
                <div className="w-40 shrink-0">
                  <p className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500"><span>{stats.approved}/{stats.total} aprobadas</span><span className="font-semibold tabular-nums text-slate-700">{percentage}%</span></p>
                  <div role="progressbar" aria-label={`Materias aprobadas del año ${year}`} aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.approved} className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${percentage === 100 ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: `${percentage}%` }} /></div>
                </div>
              </div>
              <div className="grid gap-6 xl:grid-cols-2">
                {[...terms.entries()].sort(([a], [b]) => a - b).map(([term, courses]) => (
                  <article key={term} aria-labelledby={`term-${term}`}>
                    <div className="mb-3 flex items-center justify-between"><h4 id={`term-${term}`} className="text-xs font-semibold text-slate-600">{term % 2 === 1 ? "1.er" : "2.º"} cuatrimestre</h4><span className="text-[11px] text-slate-500">{courses.length} {courses.length === 1 ? "materia" : "materias"}</span></div>
                    <div className={courseLayout}>{courses.map((materia) => <CourseCard key={materia.id} materia={materia} estado={estadoVisualPorMateria[materia.id] ?? "pendiente"} onOpen={onOpenCourse} compact={viewMode === "lista"} />)}</div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
        {CATALOG_GROUPS.map((group) => {
          const courses = filtered.filter((materia) => materia.grupo === group);
          if (courses.length === 0) return null;
          return (
            <section key={group} aria-labelledby={`group-${group}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3"><h3 id={`group-${group}`} className="text-base font-semibold text-slate-950">{GROUP_LABELS[group]}</h3><span className="text-xs text-slate-500">{courses.length} {courses.length === 1 ? "materia" : "materias"}</span></div>
              {group === "electiva-proyecto-final" ? <p className="mb-4 text-sm text-slate-600">Explorá las alternativas de trabajo final y los requisitos de cada una.</p> : null}
              <div className={viewMode === "lista" ? "grid gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>{courses.map((materia) => <CourseCard key={materia.id} materia={materia} estado={estadoVisualPorMateria[materia.id] ?? "pendiente"} onOpen={onOpenCourse} compact={viewMode === "lista"} />)}</div>
            </section>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <Search aria-hidden="true" className="mx-auto size-7 text-slate-400" />
          <h3 className="mt-4 text-base font-semibold text-slate-900">No encontramos materias</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{search.trim() ? `No hay resultados para “${search.trim()}” con esta selección. Probá otro nombre, el código o buscá en todo el plan.` : "Ninguna materia coincide con los filtros elegidos. Podés cambiar el estado o volver a ver todas."}</p>
          <button type="button" onClick={() => { clearFilters(); setScope("todas"); }} className={`mt-5 min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 ${FOCUS}`}>Ver todas las materias</button>
        </div>
      ) : null}
    </div>
  );
}
