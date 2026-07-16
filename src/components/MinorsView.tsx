"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Info, Layers3, Search } from "lucide-react";

import {
  MINOR_COLORES,
  MINOR_DESCRIPTIONS,
  MINOR_LABELS,
  MINOR_OPTIONS,
  MINOR_SIGLAS,
} from "@/data/minorsMetadata";
import type { MateriaPlan, MinorTag, ProgresoMaterias } from "@/types/plan";

const STORAGE_MINORS = "malla-curricular:minors:v1";
const STORAGE_PLAN_MINORS = "malla-curricular:plan-minors:v1";

interface MinorsViewProps {
  materias: MateriaPlan[];
  progreso: ProgresoMaterias;
  onOpenCourse: (materiaId: string) => void;
}

type CatalogMode = "minor" | "libres";

function readMinor(): MinorTag | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_MINORS) ?? "[]") as unknown[];
    const found = value.find(
      (item): item is MinorTag =>
        typeof item === "string" && MINOR_OPTIONS.includes(item as MinorTag),
    );
    return found ?? null;
  } catch {
    return null;
  }
}

function readPlanIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_PLAN_MINORS) ?? "[]") as unknown[];
    return new Set(value.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function ProgressItem({
  label,
  value,
  approved,
  target,
  color,
}: {
  label: string;
  value: number;
  approved: number;
  target: number;
  color: string;
}) {
  const percent = Math.min(100, (value / target) * 100);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{approved} aprobados · {value} en tu plan</p>
        </div>
        <p className="text-lg font-semibold text-slate-950">{value}/{target}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function MinorsView({ materias, progreso, onOpenCourse }: MinorsViewProps) {
  const [selectedMinor, setSelectedMinor] = useState<MinorTag | null>(null);
  const [planIds, setPlanIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<CatalogMode>("minor");
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSelectedMinor(readMinor());
      setPlanIds(readPlanIds());
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_MINORS, JSON.stringify(selectedMinor ? [selectedMinor] : []));
  }, [hydrated, selectedMinor]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_PLAN_MINORS, JSON.stringify([...planIds]));
  }, [hydrated, planIds]);

  const electivas = useMemo(
    () =>
      materias.filter(
        (materia) =>
          materia.grupo === "electiva-gestion" || materia.grupo === "electiva-sistemas-tecnologia",
      ),
    [materias],
  );

  const forcedIds = useMemo(
    () =>
      new Set(
        electivas
          .filter((materia) => (progreso[materia.id] ?? "pendiente") !== "pendiente")
          .map((materia) => materia.id),
      ),
    [electivas, progreso],
  );

  const effectiveIds = useMemo(() => new Set([...planIds, ...forcedIds]), [forcedIds, planIds]);

  const summary = useMemo(() => {
    if (!selectedMinor) return null;
    const planned = electivas.filter((materia) => effectiveIds.has(materia.id));
    const approved = planned.filter((materia) => progreso[materia.id] === "aprobada");
    const matchesMinor = (materia: MateriaPlan) => (materia.minorTags ?? []).includes(selectedMinor);
    const isManagement = (materia: MateriaPlan) => materia.grupo === "electiva-gestion";
    const isTechnology = (materia: MateriaPlan) => materia.grupo === "electiva-sistemas-tecnologia";
    const sum = (items: MateriaPlan[]) => items.reduce((total, materia) => total + materia.creditos, 0);

    return {
      total: sum(planned),
      minor: sum(planned.filter(matchesMinor)),
      minorApproved: sum(approved.filter(matchesMinor)),
      libres: sum(planned.filter((materia) => !matchesMinor(materia))),
      libresApproved: sum(approved.filter((materia) => !matchesMinor(materia))),
      management: sum(planned.filter(isManagement)),
      managementApproved: sum(approved.filter(isManagement)),
      technology: sum(planned.filter(isTechnology)),
      technologyApproved: sum(approved.filter(isTechnology)),
    };
  }, [effectiveIds, electivas, progreso, selectedMinor]);

  const catalog = useMemo(() => {
    if (!selectedMinor) return [];
    const term = search.trim().toLocaleLowerCase("es");
    return electivas
      .filter((materia) => {
        const belongs = (materia.minorTags ?? []).includes(selectedMinor);
        if (mode === "minor" ? !belongs : belongs) return false;
        if (onlyActive && materia.estadoOferta === "inactiva") return false;
        return (
          !term ||
          materia.id.toLocaleLowerCase("es").includes(term) ||
          materia.nombre.toLocaleLowerCase("es").includes(term)
        );
      })
      .sort((a, b) => {
        const aActive = a.estadoOferta !== "inactiva" ? 0 : 1;
        const bActive = b.estadoOferta !== "inactiva" ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        if (a.grupo !== b.grupo) return a.grupo.localeCompare(b.grupo);
        return a.id.localeCompare(b.id);
      });
  }, [electivas, mode, onlyActive, search, selectedMinor]);

  const toggleCourse = (id: string) => {
    if (forcedIds.has(id)) return;
    setPlanIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-blue-100">
              <Layers3 className="size-3.5" /> Estructura vigente · julio 2026
            </span>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Elegí una línea y armá tus electivas sin hacer cuentas a mano.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              El minor requiere 45 créditos de su línea y 12 electivas libres. En el total deben quedar 27 créditos de Gestión y 30 de Tecnología.
            </p>
          </div>
          {summary ? (
            <div className="rounded-2xl bg-white px-5 py-4 text-slate-950">
              <p className="text-3xl font-semibold">{summary.total}/57</p>
              <p className="text-xs font-medium text-slate-500">créditos electivos en tu plan</p>
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Paso 1</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">Elegí tu minor</h3>
          </div>
          {selectedMinor ? (
            <button
              type="button"
              onClick={() => setSelectedMinor(null)}
              className="min-h-10 rounded-full border border-slate-300 px-4 text-xs font-bold text-slate-600 hover:border-slate-500"
            >
              Cambiar elección
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MINOR_OPTIONS.map((minor) => {
            const selected = selectedMinor === minor;
            return (
              <button
                key={minor}
                type="button"
                onClick={() => {
                  setSelectedMinor(minor);
                  setMode("minor");
                }}
                aria-pressed={selected}
                className={`min-h-40 rounded-[1.5rem] border bg-white p-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  selected
                    ? "border-slate-950 ring-2 ring-slate-950 ring-offset-2"
                    : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-lg"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="grid size-10 place-items-center rounded-xl text-xs font-black text-white"
                    style={{ backgroundColor: MINOR_COLORES[minor] }}
                  >
                    {MINOR_SIGLAS[minor]}
                  </span>
                  {selected ? <Check className="size-5 text-slate-950" /> : <ArrowRight className="size-4 text-slate-300" />}
                </div>
                <p className="mt-4 text-base font-semibold text-slate-950">{MINOR_LABELS[minor]}</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{MINOR_DESCRIPTIONS[minor]}</p>
              </button>
            );
          })}
        </div>
      </section>

      {selectedMinor && summary ? (
        <>
          <section>
            <div className="mb-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Paso 2</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">Completá la estructura</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ProgressItem
                label={`Minor · ${MINOR_LABELS[selectedMinor]}`}
                value={summary.minor}
                approved={summary.minorApproved}
                target={45}
                color={MINOR_COLORES[selectedMinor]}
              />
              <ProgressItem label="Electivas libres" value={summary.libres} approved={summary.libresApproved} target={12} color="#64748b" />
              <ProgressItem label="Gestión" value={summary.management} approved={summary.managementApproved} target={27} color="#0f766e" />
              <ProgressItem label="Tecnología" value={summary.technology} approved={summary.technologyApproved} target={30} color="#2563eb" />
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Paso 3</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Elegí materias</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Las materias cursando, regulares o aprobadas se incluyen automáticamente.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMode("minor")}
                    className={`min-h-10 rounded-lg px-3 text-xs font-bold ${mode === "minor" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}
                  >
                    Para el minor
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("libres")}
                    className={`min-h-10 rounded-lg px-3 text-xs font-bold ${mode === "libres" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}
                  >
                    Para las 12 libres
                  </button>
                </div>
                <label className="relative sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar materia"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-y border-slate-100 py-3">
              <p className="text-sm text-slate-600"><strong className="text-slate-950">{catalog.length}</strong> materias disponibles</p>
              <label className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(event) => setOnlyActive(event.target.checked)}
                  className="size-4 accent-blue-600"
                />
                Sólo oferta vigente
              </label>
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {catalog.map((materia) => {
                const checked = effectiveIds.has(materia.id);
                const forced = forcedIds.has(materia.id);
                const status = progreso[materia.id] ?? "pendiente";
                return (
                  <div
                    key={materia.id}
                    className={`flex min-h-24 items-start gap-3 rounded-2xl border p-3 transition ${
                      checked ? "border-blue-300 bg-blue-50/60" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <label className="grid size-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={forced}
                        onChange={() => toggleCourse(materia.id)}
                        aria-label={`${checked ? "Quitar" : "Agregar"} ${materia.nombre} del plan de minor`}
                        className="size-4 accent-blue-600"
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-slate-500">{materia.id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${materia.estadoOferta === "inactiva" ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>
                          {materia.estadoOferta === "inactiva" ? "Inactiva" : "Vigente"}
                        </span>
                        {forced ? <span className="text-[10px] font-semibold text-blue-700">Incluida por estado · {status}</span> : null}
                      </div>
                      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{materia.nombre}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {materia.creditos} cr · {materia.grupo === "electiva-gestion" ? "Gestión" : "Tecnología"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenCourse(materia.id)}
                      className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      aria-label={`Ver detalle de ${materia.nombre}`}
                    >
                      <Info className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
          <p className="text-base font-semibold text-slate-900">Elegí una línea para ver materias y requisitos.</p>
          <p className="mt-1 text-sm text-slate-500">Podés cambiarla más adelante sin perder estados ni planificación.</p>
        </div>
      )}
    </div>
  );
}
