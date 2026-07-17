"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, ChevronRight, Filter, Search, Sparkles } from "lucide-react";

import type {
  EstadoMateria,
  EstadoVisualMateria,
  MateriaPlan,
  ProgresoMaterias,
} from "@/types/plan";

interface DashboardViewProps {
  materias: MateriaPlan[];
  progreso: ProgresoMaterias;
  estadoVisualPorMateria: Record<string, EstadoVisualMateria>;
  onOpenCourse: (materiaId: string) => void;
}

type Scope = "plan" | "electivas";
type FilterState = "todas" | EstadoMateria | "cursables";
type ElectiveGroup = "todas" | "gestion" | "tecnologia";

const STATE_STYLES: Record<EstadoVisualMateria, string> = {
  pendiente:
    "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:ring-1 dark:ring-slate-600",
  cursando:
    "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:ring-1 dark:ring-blue-700",
  regular:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:ring-1 dark:ring-amber-700",
  aprobada:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-1 dark:ring-emerald-700",
  puedo_cursar:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 dark:ring-1 dark:ring-indigo-700",
  habilitable_preview:
    "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200 dark:ring-1 dark:ring-sky-700",
};

const STATE_LABELS: Record<EstadoVisualMateria, string> = {
  pendiente: "Pendiente",
  cursando: "Cursando",
  regular: "Regular",
  aprobada: "Aprobada",
  puedo_cursar: "Podés cursar",
  habilitable_preview: "Próximamente",
};

function CourseCard({
  materia,
  estado,
  onOpen,
}: {
  materia: MateriaPlan;
  estado: EstadoVisualMateria;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`course-${materia.id}`}
      onClick={() => onOpen(materia.id)}
      className="dashboard-course-card group flex min-h-28 w-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-300">
            {materia.id}
          </span>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-950">{materia.nombre}</p>
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-100" />
      </div>
      <div className="mt-3 flex w-full items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATE_STYLES[estado]}`}>
          {STATE_LABELS[estado]}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-300">{materia.creditos} cr</span>
      </div>
    </button>
  );
}

export function DashboardView({
  materias,
  progreso,
  estadoVisualPorMateria,
  onOpenCourse,
}: DashboardViewProps) {
  const [scope, setScope] = useState<Scope>("plan");
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<FilterState>("todas");
  const [electiveGroup, setElectiveGroup] = useState<ElectiveGroup>("todas");
  const [onlyActive, setOnlyActive] = useState(true);

  const troncales = useMemo(() => materias.filter((materia) => materia.cuatrimestre <= 7), [materias]);
  const electivas = useMemo(
    () =>
      materias.filter(
        (materia) =>
          materia.grupo === "electiva-gestion" || materia.grupo === "electiva-sistemas-tecnologia",
      ),
    [materias],
  );

  const cursables = useMemo(
    () =>
      troncales.filter((materia) => estadoVisualPorMateria[materia.id] === "puedo_cursar").slice(0, 4),
    [estadoVisualPorMateria, troncales],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    const source = scope === "plan" ? troncales : electivas;

    return source.filter((materia) => {
      const visual = estadoVisualPorMateria[materia.id] ?? "pendiente";
      const persisted = progreso[materia.id] ?? "pendiente";
      const matchesSearch =
        !term ||
        materia.id.toLocaleLowerCase("es").includes(term) ||
        materia.nombre.toLocaleLowerCase("es").includes(term);
      const matchesState =
        filterState === "todas" ||
        (filterState === "cursables" ? visual === "puedo_cursar" : persisted === filterState);
      const matchesGroup =
        scope === "plan" ||
        electiveGroup === "todas" ||
        (electiveGroup === "gestion" && materia.grupo === "electiva-gestion") ||
        (electiveGroup === "tecnologia" && materia.grupo === "electiva-sistemas-tecnologia");
      const matchesOffer = scope === "plan" || !onlyActive || materia.estadoOferta !== "inactiva";
      return matchesSearch && matchesState && matchesGroup && matchesOffer;
    });
  }, [electiveGroup, electivas, estadoVisualPorMateria, filterState, onlyActive, progreso, scope, search, troncales]);

  const years = useMemo(() => {
    const grouped = new Map<number, { first: MateriaPlan[]; second: MateriaPlan[] }>();
    for (const materia of filtered) {
      if (materia.cuatrimestre > 7) continue;
      const year = Math.ceil(materia.cuatrimestre / 2);
      const item = grouped.get(year) ?? { first: [], second: [] };
      if (materia.cuatrimestre % 2 === 1) item.first.push(materia);
      else item.second.push(materia);
      grouped.set(year, item);
    }
    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [filtered]);

  const approvedCore = troncales.filter((materia) => progreso[materia.id] === "aprobada").length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                <Sparkles className="size-3.5" /> Próximo paso
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {cursables.length > 0 ? "Materias que ya podés cursar" : "Tu plan está al día"}
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">
                Abrí una materia para ver requisitos y elegir su estado. Ya no hace falta recorrer estados con clics sucesivos.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-slate-950 px-5 py-4 text-white">
              <p className="text-2xl font-semibold">{approvedCore}/{troncales.length}</p>
              <p className="mt-0.5 text-xs text-slate-300">materias base aprobadas</p>
            </div>
          </div>
          {cursables.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cursables.map((materia) => (
                <button
                  key={`next-${materia.id}`}
                  type="button"
                  onClick={() => onOpenCourse(materia.id)}
                  className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <span className="font-mono text-[10px] font-semibold text-indigo-600">{materia.id}</span>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{materia.nombre}</p>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-[#eef6ff] p-5 sm:p-6">
          <BookOpen className="size-5 text-blue-700" />
          <h3 className="mt-4 text-lg font-semibold text-slate-950">Una vista por tarea</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            El plan base queda separado del catálogo de electivas. Podés buscar, filtrar y volver sin perder el progreso.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-full rounded-2xl bg-slate-100 p-1 sm:w-auto" aria-label="Contenido del tablero">
            <button
              type="button"
              onClick={() => setScope("plan")}
              aria-pressed={scope === "plan"}
              className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold transition sm:flex-none ${
                scope === "plan" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Plan base
            </button>
            <button
              type="button"
              onClick={() => setScope("electivas")}
              aria-pressed={scope === "electivas"}
              className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold transition sm:flex-none ${
                scope === "electivas" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Explorar electivas
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar materia o código"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
              <Filter className="size-4 text-slate-400" />
              <select
                value={filterState}
                onChange={(event) => setFilterState(event.target.value as FilterState)}
                aria-label="Filtrar por estado"
                className="min-w-36 bg-transparent text-sm font-medium text-slate-700 outline-none"
              >
                <option value="todas">Todos los estados</option>
                <option value="cursables">Podés cursar</option>
                <option value="cursando">Cursando</option>
                <option value="regular">Regular</option>
                <option value="aprobada">Aprobada</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </label>
          </div>
        </div>

        {scope === "electivas" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {(["todas", "gestion", "tecnologia"] as ElectiveGroup[]).map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setElectiveGroup(group)}
                aria-pressed={electiveGroup === group}
                className={`min-h-10 rounded-full border px-4 text-xs font-bold transition ${
                  electiveGroup === group
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {group === "todas" ? "Todas" : group === "gestion" ? "Gestión" : "Tecnología"}
              </button>
            ))}
            <label className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(event) => setOnlyActive(event.target.checked)}
                className="size-4 accent-blue-600"
              />
              Sólo oferta vigente
            </label>
          </div>
        ) : null}
      </section>

      {scope === "plan" ? (
        <div className="space-y-5">
          {years.map(([year, terms]) => (
            <section
              key={year}
              className="dashboard-year rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Año {year}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Plan recomendado</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {terms.first.length + terms.second.length} materias
                </span>
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                {[
                  ["1° cuatrimestre", terms.first],
                  ["2° cuatrimestre", terms.second],
                ].map(([label, term]) => {
                  const termMaterias = term as MateriaPlan[];
                  return (
                    <article
                      key={label as string}
                      className="dashboard-term rounded-2xl border border-transparent bg-slate-50 p-3 sm:p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-800">{label as string}</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-300">
                          {termMaterias.length} materias
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {termMaterias.map((materia) => (
                          <CourseCard
                            key={materia.id}
                            materia={materia}
                            estado={estadoVisualPorMateria[materia.id] ?? "pendiente"}
                            onOpen={onOpenCourse}
                          />
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-950">{filtered.length}</span> electivas encontradas
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Check className="size-3.5" /> Actualizado julio 2026
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((materia) => (
              <CourseCard
                key={materia.id}
                materia={materia}
                estado={estadoVisualPorMateria[materia.id] ?? "pendiente"}
                onOpen={onOpenCourse}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
          <p className="text-sm font-semibold text-slate-800">No encontramos materias con esos filtros.</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilterState("todas");
              setElectiveGroup("todas");
            }}
            className="mt-3 min-h-10 rounded-full border border-slate-300 px-4 text-xs font-bold text-slate-700 hover:border-slate-500"
          >
            Limpiar filtros
          </button>
        </div>
      ) : null}
    </div>
  );
}
