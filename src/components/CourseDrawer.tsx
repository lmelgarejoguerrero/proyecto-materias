"use client";

import { useEffect } from "react";
import { Check, Circle, Clock3, LockKeyhole, Play, X } from "lucide-react";

import { MINOR_COLORES, MINOR_LABELS } from "@/data/minorsMetadata";
import type { EstadoMateria, MateriaPlan, ProgresoMaterias } from "@/types/plan";

interface CourseDrawerProps {
  materia: MateriaPlan | null;
  materias: MateriaPlan[];
  progreso: ProgresoMaterias;
  habilitada: boolean;
  onClose: () => void;
  onSetEstado: (materiaId: string, estado: EstadoMateria) => void;
}

const ESTADOS: Array<{
  value: EstadoMateria;
  label: string;
  hint: string;
  icon: typeof Circle;
  className: string;
}> = [
  {
    value: "pendiente",
    label: "Pendiente",
    hint: "Todavía no la empezaste",
    icon: Circle,
    className: "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
  },
  {
    value: "cursando",
    label: "Cursando",
    hint: "La estás cursando ahora",
    icon: Play,
    className: "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400",
  },
  {
    value: "regular",
    label: "Regular",
    hint: "Cursada aprobada; falta el final",
    icon: Clock3,
    className: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400",
  },
  {
    value: "aprobada",
    label: "Aprobada",
    hint: "Materia finalizada",
    icon: Check,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400",
  },
];

export function CourseDrawer({
  materia,
  materias,
  progreso,
  habilitada,
  onClose,
  onSetEstado,
}: CourseDrawerProps) {
  useEffect(() => {
    if (!materia) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [materia, onClose]);

  if (!materia) return null;

  const estado = progreso[materia.id] ?? "pendiente";
  const mapa = new Map(materias.map((item) => [item.id, item]));
  const correlativas = materia.correlativas.map((id) => ({
    id,
    materia: mapa.get(id),
    estado: progreso[id] ?? "pendiente",
  }));

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-end bg-slate-950/30 backdrop-blur-[2px] md:items-stretch">
      <button
        type="button"
        aria-label="Cerrar detalle de materia"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-drawer-title"
        className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] border border-slate-200 bg-[#fbfbfd] shadow-2xl md:max-h-none md:max-w-[28rem] md:rounded-none md:rounded-l-[2rem]"
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-[#fbfbfd]/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="font-mono text-xs font-semibold tracking-wide text-blue-700">{materia.id}</p>
            <p className="mt-0.5 text-xs text-slate-500">{materia.creditos} créditos</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-7 p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  materia.estadoOferta === "inactiva"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {materia.estadoOferta === "inactiva" ? "Oferta inactiva" : "Oferta vigente"}
              </span>
              {habilitada && estado === "pendiente" ? (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                  La podés cursar
                </span>
              ) : null}
            </div>
            <h2 id="course-drawer-title" className="mt-3 text-2xl font-semibold leading-tight text-slate-950">
              {materia.nombre}
            </h2>
          </div>

          <section>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Tu estado</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-1">
              {ESTADOS.map((item) => {
                const Icon = item.icon;
                const activo = estado === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onSetEstado(materia.id, item.value)}
                    aria-pressed={activo}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${item.className} ${
                      activo ? "ring-2 ring-slate-950/80 ring-offset-2" : ""
                    }`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/80">
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{item.label}</span>
                      <span className="mt-0.5 block text-xs opacity-75">{item.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Requisitos</p>
                <p className="mt-1 text-sm text-slate-700">
                  {materia.creditosRequeridos > 0
                    ? `${materia.creditosRequeridos} créditos aprobados`
                    : "Sin mínimo de créditos"}
                </p>
              </div>
              <LockKeyhole className="size-5 text-slate-400" />
            </div>

            {correlativas.length > 0 ? (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                {correlativas.map((item) => {
                  const cumplida = item.estado === "regular" || item.estado === "aprobada";
                  return (
                    <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <span className="font-mono text-xs text-slate-500">{item.id}</span>
                        <p className="mt-0.5 text-slate-800">{item.materia?.nombre ?? "Materia correlativa"}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold ${cumplida ? "text-emerald-700" : "text-slate-500"}`}>
                        {cumplida ? "Cumplida" : "Pendiente"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No tiene correlativas específicas.</p>
            )}
          </section>

          {(materia.minorTags?.length ?? 0) > 0 ? (
            <section>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Aporta a</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {materia.minorTags?.map((minor) => (
                  <span
                    key={minor}
                    className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: `${MINOR_COLORES[minor]}66`, color: MINOR_COLORES[minor] }}
                  >
                    {MINOR_LABELS[minor]}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
