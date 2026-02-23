import { GraduationCap, RefreshCcw } from "lucide-react";

import { MINOR_LABELS } from "@/data/minorsMetadata";
import type { MinorTag } from "@/types/plan";

interface LeyendaEstadosProps {
  creditosAprobados: number;
  creditosTitulo: number;
  onReset: () => void;
  onAprobarCursadas: () => void;
  selectedMinors: MinorTag[];
  onToggleMinor: (minor: MinorTag) => void;
  progresosMinors: Array<{
    minorTag: MinorTag;
    minorAprobado: number;
    objetivoMinor: number;
    gestionAprobado: number;
    objetivoGestion: number;
    tecnologiaAprobado: number;
    objetivoTecnologia: number;
    libresAprobado: number;
    objetivoLibres: number;
  }>;
}

const items = [
  { id: "pendiente", label: "Pendiente", className: "border-slate-600 bg-slate-900/80" },
  { id: "cursando", label: "Cursando", className: "border-sky-500 bg-sky-950/40" },
  { id: "regular", label: "Regular", className: "border-amber-500 bg-amber-950/40" },
  { id: "aprobada", label: "Aprobada", className: "border-emerald-500 bg-emerald-950/40" },
  { id: "puedo-cursar", label: "Puedo cursar", className: "border-slate-200 bg-slate-900/80" },
  {
    id: "habilitable-preview",
    label: "Habilitable (si aprobas cursada)",
    className: "border-sky-300 border-dashed bg-sky-950/20",
  },
];

export function LeyendaEstados({
  creditosAprobados,
  creditosTitulo,
  onReset,
  onAprobarCursadas,
  selectedMinors,
  onToggleMinor,
  progresosMinors,
}: LeyendaEstadosProps) {
  const minors: MinorTag[] = [
    "finanzas-cripto",
    "tecnologia-datos",
    "innovacion-empresarial",
    "gestion-comercial",
  ];

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 md:text-2xl">
            Tablero de Organizacion de Materias - Gestion de Negocios (L20)
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Click: Pendiente {"->"} Cursando {"->"} Regular {"->"} Aprobada {"->"} Pendiente
          </p>
        </div>

        <div className="w-full max-w-xl">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
            <span>Progreso total</span>
            <span>
              {creditosAprobados}/{creditosTitulo} cr
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-400"
              style={{ width: `${Math.min(100, (creditosAprobados / creditosTitulo) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-full border px-3 py-1 text-slate-200 ${item.className}`}
            >
              {item.label}
            </div>
          ))}

          <div className="ml-0 inline-flex items-center gap-2 rounded-full border border-indigo-500/60 bg-indigo-950/30 px-3 py-1 text-indigo-100 md:ml-2">
            <GraduationCap className="h-4 w-4" />
            {creditosAprobados} / {creditosTitulo} creditos aprobados
          </div>

          <button
            type="button"
            onClick={onAprobarCursadas}
            className="inline-flex items-center gap-2 rounded-full border border-sky-500/70 px-3 py-1 text-sky-200 transition-colors hover:border-sky-300"
          >
            Aprobe cursadas
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-3 py-1 text-slate-200 transition-colors hover:border-slate-300"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Reiniciar progreso
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {minors.map((minor) => {
            const checked = selectedMinors.includes(minor);
            return (
              <label
                key={minor}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
                  checked
                    ? "border-sky-400 bg-sky-900/25 text-sky-100"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-sky-400"
                  checked={checked}
                  onChange={() => onToggleMinor(minor)}
                />
                {MINOR_LABELS[minor]}
              </label>
            );
          })}
        </div>

        {progresosMinors.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {progresosMinors.map((progresoMinor) => {
              const pctMinor = Math.min(
                100,
                (progresoMinor.minorAprobado / progresoMinor.objetivoMinor) * 100,
              );

              return (
                <div
                  key={progresoMinor.minorTag}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2"
                >
                  <p className="text-xs font-medium text-slate-200">
                    {MINOR_LABELS[progresoMinor.minorTag]}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Minor {progresoMinor.minorAprobado}/{progresoMinor.objetivoMinor} cr
                  </p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-sky-400" style={{ width: `${pctMinor}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    G: {progresoMinor.gestionAprobado}/{progresoMinor.objetivoGestion} · T:{" "}
                    {progresoMinor.tecnologiaAprobado}/{progresoMinor.objetivoTecnologia} · Libres:{" "}
                    {progresoMinor.libresAprobado}/{progresoMinor.objetivoLibres}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </header>
  );
}
