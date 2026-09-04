"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, CheckCircle2, Info, Layers3, Search, X } from "lucide-react";

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
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400";

interface MinorsViewProps {
  materias: MateriaPlan[];
  progreso: ProgresoMaterias;
  onOpenCourse: (materiaId: string) => void;
}

type CatalogMode = "minor" | "libres";

function readStoredArray(key: string): unknown[] {
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("La selección guardada no es una lista.");
  return value;
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
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
  const difference = target - value;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="min-h-10 text-sm font-semibold leading-5 text-slate-800">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-950">
        {value}<span className="ml-1 text-sm font-normal text-slate-500">/ {target} cr</span>
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(value, target)}
        aria-valuetext={`${value} créditos planificados de ${target}; ${approved} aprobados`}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
      >
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1 text-[11px]">
        <span className="text-slate-500">{approved} aprobados</span>
        <span className={`font-semibold ${difference < 0 ? "text-amber-700 dark:text-amber-300" : difference === 0 ? "text-emerald-700" : "text-slate-600"}`}>
          {difference > 0 ? `Faltan ${difference} cr` : difference < 0 ? `${-difference} cr de más` : "Objetivo cubierto"}
        </span>
      </div>
    </div>
  );
}

function ElectiveRow({
  materia,
  checked,
  forced,
  status,
  selectedMinor,
  onToggle,
  onOpen,
}: {
  materia: MateriaPlan;
  checked: boolean;
  forced: boolean;
  status: string;
  selectedMinor: MinorTag | null;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const belongs = selectedMinor ? (materia.minorTags ?? []).includes(selectedMinor) : false;
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 transition ${checked ? "border-blue-200 bg-blue-50 dark:bg-blue-950/40" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <label className="flex size-10 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={forced}
          onChange={() => onToggle(materia.id)}
          aria-label={forced ? `${materia.nombre}, incluida por tu progreso: ${status}` : `${checked ? "Quitar" : "Agregar"} ${materia.nombre} ${checked ? "del" : "al"} plan de minor`}
          className={`size-4 accent-blue-600 disabled:opacity-60 ${FOCUS}`}
        />
      </label>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] font-medium text-slate-500">{materia.id}</span>
          {materia.estadoOferta === "inactiva" ? (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Oferta inactiva</span>
          ) : null}
          {forced ? <span className="text-[10px] font-medium text-blue-700">Incluida por progreso · {status}</span> : null}
        </div>
        <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900">{materia.nombre}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {materia.creditos} cr · {materia.grupo === "electiva-gestion" ? "Gestión" : "Tecnología"}
          {selectedMinor ? ` · ${belongs ? "Del minor" : "Libre"}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onOpen(materia.id)}
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-blue-700 ${FOCUS}`}
        aria-label={`Ver detalle de ${materia.nombre}`}
      >
        <Info aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function MinorsView({ materias, progreso, onOpenCourse }: MinorsViewProps) {
  const [selectedMinor, setSelectedMinor] = useState<MinorTag | null>(null);
  const [planIds, setPlanIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const storageReadBlocked = useRef(false);
  const [mode, setMode] = useState<CatalogMode>("minor");
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let failed = false;
      try {
        const values = readStoredArray(STORAGE_MINORS);
        const found = values.find((item): item is MinorTag => typeof item === "string" && MINOR_OPTIONS.includes(item as MinorTag));
        setSelectedMinor(found ?? null);
      } catch {
        failed = true;
      }
      try {
        const values = readStoredArray(STORAGE_PLAN_MINORS);
        setPlanIds(new Set(values.filter((item): item is string => typeof item === "string")));
      } catch {
        failed = true;
      }
      if (failed) {
        storageReadBlocked.current = true;
        setReadFailed(true);
        setStorageError("No pudimos recuperar toda tu selección guardada. Podés seguir trabajando en esta vista; los datos anteriores se conservan.");
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const saveSelection = (minor: MinorTag | null, ids: Set<string>, replaceUnread = false) => {
    if (!hydrated || (storageReadBlocked.current && !replaceUnread)) return;
    try {
      window.localStorage.setItem(STORAGE_MINORS, JSON.stringify(minor ? [minor] : []));
      window.localStorage.setItem(STORAGE_PLAN_MINORS, JSON.stringify([...ids]));
      storageReadBlocked.current = false;
      setReadFailed(false);
      setStorageError(null);
    } catch {
      setStorageError("No pudimos guardar tu selección en este navegador. Los cambios siguen disponibles en esta vista; reintentá el guardado antes de salir de ella.");
    }
  };

  const electivas = useMemo(() => materias.filter((materia) => materia.grupo === "electiva-gestion" || materia.grupo === "electiva-sistemas-tecnologia"), [materias]);
  const forcedIds = useMemo(() => new Set(electivas.filter((materia) => (progreso[materia.id] ?? "pendiente") !== "pendiente").map((materia) => materia.id)), [electivas, progreso]);
  const effectiveIds = useMemo(() => new Set([...planIds, ...forcedIds]), [forcedIds, planIds]);
  const plannedCourses = useMemo(() => electivas.filter((materia) => effectiveIds.has(materia.id)), [effectiveIds, electivas]);
  const unavailableIds = useMemo(() => {
    const known = new Set(electivas.map((materia) => materia.id));
    return [...planIds].filter((id) => !known.has(id));
  }, [electivas, planIds]);

  const summary = useMemo(() => {
    if (!selectedMinor) return null;
    const approved = plannedCourses.filter((materia) => progreso[materia.id] === "aprobada");
    const matchesMinor = (materia: MateriaPlan) => (materia.minorTags ?? []).includes(selectedMinor);
    const isManagement = (materia: MateriaPlan) => materia.grupo === "electiva-gestion";
    const isTechnology = (materia: MateriaPlan) => materia.grupo === "electiva-sistemas-tecnologia";
    const sum = (items: MateriaPlan[]) => items.reduce((total, materia) => total + materia.creditos, 0);
    return {
      total: sum(plannedCourses),
      minor: sum(plannedCourses.filter(matchesMinor)),
      minorApproved: sum(approved.filter(matchesMinor)),
      libres: sum(plannedCourses.filter((materia) => !matchesMinor(materia))),
      libresApproved: sum(approved.filter((materia) => !matchesMinor(materia))),
      management: sum(plannedCourses.filter(isManagement)),
      managementApproved: sum(approved.filter(isManagement)),
      technology: sum(plannedCourses.filter(isTechnology)),
      technologyApproved: sum(approved.filter(isTechnology)),
    };
  }, [plannedCourses, progreso, selectedMinor]);

  const balances = summary ? [
    { label: "del minor", value: summary.minor, target: 45 },
    { label: "libres", value: summary.libres, target: 12 },
    { label: "de Gestión", value: summary.management, target: 27 },
    { label: "de Tecnología", value: summary.technology, target: 30 },
  ] : [];
  const missing = balances.filter((item) => item.value < item.target);
  const excess = balances.filter((item) => item.value > item.target);
  const distributionComplete = balances.length > 0 && missing.length === 0 && excess.length === 0 && unavailableIds.length === 0;

  const catalog = useMemo(() => {
    if (!selectedMinor) return [];
    const terms = normalizeSearch(search).trim().split(/\s+/).filter(Boolean);
    return electivas.filter((materia) => {
      const belongs = (materia.minorTags ?? []).includes(selectedMinor);
      if (mode === "minor" ? !belongs : belongs) return false;
      if (onlyActive && materia.estadoOferta === "inactiva") return false;
      const searchable = normalizeSearch(`${materia.id} ${materia.nombre}`);
      return terms.every((term) => searchable.includes(term));
    }).sort((a, b) => {
      const activeFirst = Number(a.estadoOferta === "inactiva") - Number(b.estadoOferta === "inactiva");
      return activeFirst || a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre, "es");
    });
  }, [electivas, mode, onlyActive, search, selectedMinor]);

  const chooseMinor = (minor: MinorTag | null) => {
    setSelectedMinor(minor);
    setMode("minor");
    setSearch("");
    saveSelection(minor, planIds);
  };

  const toggleCourse = (id: string) => {
    if (!hydrated || forcedIds.has(id)) return;
    const next = new Set(planIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPlanIds(next);
    saveSelection(selectedMinor, next);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700"><Layers3 aria-hidden="true" className="size-4" /> Tu especialización</span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Dale una dirección a tus electivas.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Armá una selección con 45 créditos de tu minor y 12 libres. Esos mismos 57 créditos se distribuyen en 27 de Gestión y 30 de Tecnología.</p>
          </div>
          {summary ? (
            <div className="shrink-0 rounded-2xl bg-blue-50 px-5 py-4">
              <p className="text-3xl font-semibold tabular-nums text-blue-700">{summary.total}<span className="text-lg font-normal text-slate-500"> / 57</span></p>
              <p className="mt-1 text-xs text-slate-600">créditos en tu selección</p>
            </div>
          ) : null}
        </div>
      </section>

      {storageError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-800" />
          <div className="flex-1 text-sm leading-6 text-amber-900">
            <p>{storageError}</p>
            {readFailed ? <p className="mt-1 text-xs">“Guardar esta selección” reemplaza los datos guardados por los que ves ahora.</p> : null}
          </div>
          <button type="button" onClick={() => saveSelection(selectedMinor, planIds, true)} className={`min-h-10 shrink-0 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-900 ${FOCUS}`}>{readFailed ? "Guardar esta selección" : "Reintentar guardado"}</button>
        </div>
      ) : null}

      <section aria-labelledby="minor-choice">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h3 id="minor-choice" className="text-xl font-semibold tracking-tight text-slate-950">Elegí tu minor</h3><p className="mt-1 text-sm text-slate-500">Podés comparar líneas sin perder tu selección de materias.</p></div>
          {selectedMinor ? <button type="button" onClick={() => chooseMinor(null)} className={`min-h-9 rounded-lg px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-950 ${FOCUS}`}>Quitar elección de minor</button> : null}
        </div>
        <div role="group" aria-label="Líneas de minor" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MINOR_OPTIONS.map((minor) => {
            const selected = selectedMinor === minor;
            return (
              <button key={minor} type="button" disabled={!hydrated} onClick={() => chooseMinor(minor)} aria-pressed={selected} className={`min-h-40 rounded-2xl border bg-white p-4 text-left transition disabled:opacity-60 ${FOCUS} ${selected ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 hover:border-blue-300 hover:shadow-sm"}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ backgroundColor: MINOR_COLORES[minor] }}>{MINOR_SIGLAS[minor]}</span>
                  {selected ? <Check aria-hidden="true" className="size-5 text-blue-700" /> : <ArrowRight aria-hidden="true" className="size-4 text-slate-400" />}
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-950">{MINOR_LABELS[minor]}</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{MINOR_DESCRIPTIONS[minor]}</p>
              </button>
            );
          })}
        </div>
        {selectedMinor && effectiveIds.size > 0 ? <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500"><Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Al cambiar de minor conservamos tus materias. Se recalcula cuáles pertenecen a esa línea y cuáles cuentan como libres.</p> : null}
      </section>

      {selectedMinor && summary ? (
        <section aria-labelledby="minor-structure">
          <div className="mb-4"><h3 id="minor-structure" className="text-xl font-semibold tracking-tight text-slate-950">El balance de tu plan</h3><p className="mt-1 text-sm text-slate-500">Créditos planificados y aprobados, separados para que sepas qué te falta.</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ProgressItem label={`Minor · ${MINOR_LABELS[selectedMinor]}`} value={summary.minor} approved={summary.minorApproved} target={45} color={MINOR_COLORES[selectedMinor]} />
            <ProgressItem label="Electivas libres" value={summary.libres} approved={summary.libresApproved} target={12} color="#64748b" />
            <ProgressItem label="Gestión" value={summary.management} approved={summary.managementApproved} target={27} color="#0f766e" />
            <ProgressItem label="Tecnología" value={summary.technology} approved={summary.technologyApproved} target={30} color="#2563eb" />
          </div>
          <div role="status" aria-live="polite" className={`mt-3 flex items-start gap-3 rounded-xl p-4 text-sm leading-6 ${distributionComplete ? "bg-emerald-50 text-emerald-800" : excess.length > 0 ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
            {distributionComplete ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
            <div>
              {distributionComplete ? <p className="font-medium">Tu selección cubre los cuatro objetivos. Ahora podés seguir las aprobaciones de cada materia.</p> : null}
              {missing.length > 0 ? <p>Faltan {missing.map((item) => `${item.target - item.value} cr ${item.label}`).join(" · ")}.</p> : null}
              {excess.length > 0 ? <p className={missing.length > 0 ? "mt-1" : ""}>Por encima del objetivo: {excess.map((item) => `${item.value - item.target} cr ${item.label}`).join(" · ")}. Revisá la distribución de tu selección.</p> : null}
              {unavailableIds.length > 0 ? <p className="mt-1">Hay códigos guardados fuera del catálogo actual; sus créditos no están incluidos en el cálculo.</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {effectiveIds.size > 0 ? (
        <section aria-labelledby="minor-selection" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h3 id="minor-selection" className="text-lg font-semibold text-slate-950">Tu selección <span className="ml-2 text-sm font-normal tabular-nums text-slate-500">{effectiveIds.size}</span></h3><p className="mt-1 text-xs leading-5 text-slate-500">Siempre visible, incluso si una materia no aparece en los filtros del catálogo.</p></div>
            <span className="max-w-sm text-xs leading-5 text-slate-500">Las materias con progreso se incluyen automáticamente. Para quitarlas, actualizá su estado en el detalle.</span>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {plannedCourses.map((materia) => <ElectiveRow key={materia.id} materia={materia} checked forced={forcedIds.has(materia.id)} status={progreso[materia.id] ?? "pendiente"} selectedMinor={selectedMinor} onToggle={toggleCourse} onOpen={onOpenCourse} />)}
            {unavailableIds.map((id) => (
              <div key={id} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-800" />
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">Código {id}</p><p className="mt-1 text-xs leading-5 text-slate-600">No está en el catálogo actual. Conservamos tu elección, pero no podemos calcular sus créditos.</p></div>
                <button type="button" onClick={() => toggleCourse(id)} aria-label={`Quitar código ${id} de la selección`} className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-white ${FOCUS}`}><X aria-hidden="true" className="size-4" /></button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {selectedMinor ? (
        <section aria-labelledby="minor-catalog" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h3 id="minor-catalog" className="text-xl font-semibold tracking-tight text-slate-950">Explorá electivas</h3><p className="mt-1 text-sm text-slate-500">Sumá opciones y revisá sus requisitos antes de planificar.</p></div>
            <label className="relative lg:w-72"><span className="sr-only">Buscar electiva por nombre o código</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o código…" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div role="group" aria-label="Tipo de electivas" className="inline-flex rounded-xl bg-slate-100 p-1">
              {(["minor", "libres"] as const).map((item) => <button key={item} type="button" onClick={() => setMode(item)} aria-pressed={mode === item} className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition ${FOCUS} ${mode === item ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{item === "minor" ? "Para el minor" : "Electivas libres"}</button>)}
            </div>
            <label className="inline-flex min-h-10 items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} className={`size-4 accent-blue-600 ${FOCUS}`} />Ocultar oferta inactiva</label>
          </div>
          <div className="my-3 flex flex-wrap items-center justify-between gap-2">
            <p role="status" aria-live="polite" className="text-xs text-slate-500"><span className="font-semibold text-slate-800">{catalog.length}</span> {catalog.length === 1 ? "materia encontrada" : "materias encontradas"}</p>
            {search.trim() || onlyActive ? <button type="button" onClick={() => { setSearch(""); setOnlyActive(false); }} className={`inline-flex min-h-8 items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-950 ${FOCUS}`}><X aria-hidden="true" className="size-3.5" /> Limpiar filtros</button> : null}
          </div>
          {catalog.length > 0 ? (
            <div className="grid gap-2 lg:grid-cols-2">
              {catalog.map((materia) => <ElectiveRow key={materia.id} materia={materia} checked={effectiveIds.has(materia.id)} forced={forcedIds.has(materia.id)} status={progreso[materia.id] ?? "pendiente"} selectedMinor={selectedMinor} onToggle={toggleCourse} onOpen={onOpenCourse} />)}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 px-4 py-10 text-center">
              <Search aria-hidden="true" className="mx-auto size-6 text-slate-400" /><h4 className="mt-3 text-sm font-semibold text-slate-900">No encontramos electivas con esos filtros</h4><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{search.trim() ? `Probá otro nombre o código para “${search.trim()}”. También podés cambiar entre materias del minor y libres.` : "Probá incluir la oferta inactiva o cambiar entre materias del minor y libres."}</p><button type="button" onClick={() => { setSearch(""); setOnlyActive(false); }} className={`mt-4 min-h-10 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-700 ${FOCUS}`}>Limpiar filtros</button>
            </div>
          )}
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><Layers3 aria-hidden="true" className="mx-auto size-7 text-blue-600" /><p className="mt-4 text-base font-semibold text-slate-900">{hydrated ? "Elegí una línea para explorar tus opciones." : "Recuperando tu selección…"}</p><p className="mt-2 text-sm text-slate-500">Tus materias y su progreso se conservan al cambiar de minor.</p></div>
      )}
    </div>
  );
}
