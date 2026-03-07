"use client";

import { useEffect, useMemo } from "react";
import { BookOpen, CircleAlert, ExternalLink, Lock, Sparkles, X } from "lucide-react";

import { MINOR_COLORES, MINOR_LABELS, MINOR_SIGLAS } from "@/data/minorsMetadata";
import type { EstadoMateria, EstadoVisualMateria, MateriaPlan } from "@/types/plan";

interface DetalleMateriaPanelProps {
  materia: MateriaPlan | null;
  materias: MateriaPlan[];
  progreso: Record<string, EstadoMateria>;
  estadoVisualPorMateria: Record<string, EstadoVisualMateria>;
  materiasHabilitadas: Record<string, boolean>;
  onClose: () => void;
  onCambiarEstado: (materiaId: string) => void;
}

const ETIQUETA_ESTADO: Record<EstadoVisualMateria, string> = {
  pendiente: "Pendiente",
  cursando: "Cursando",
  regular: "Regular",
  aprobada: "Aprobada",
  puedo_cursar: "Puedo cursar",
  habilitable_preview: "Habilitable si cerrás una cursada",
};

export function DetalleMateriaPanel({
  materia,
  materias,
  progreso,
  estadoVisualPorMateria,
  materiasHabilitadas,
  onClose,
  onCambiarEstado,
}: DetalleMateriaPanelProps) {
  useEffect(() => {
    if (!materia) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [materia, onClose]);

  const correlativas = useMemo(() => {
    if (!materia) return [];

    return materia.correlativas
      .map((correlativaId) => materias.find((item) => item.id === correlativaId))
      .filter((item): item is MateriaPlan => Boolean(item))
      .map((correlativa) => ({
        materia: correlativa,
        estado: progreso[correlativa.id] ?? "pendiente",
      }));
  }, [materia, materias, progreso]);

  const desbloquea = useMemo(() => {
    if (!materia) return [];

    return materias
      .filter((item) => item.correlativas.includes(materia.id))
      .map((item) => ({
        materia: item,
        estadoVisual: estadoVisualPorMateria[item.id] ?? "pendiente",
        habilitada: materiasHabilitadas[item.id] ?? false,
      }))
      .sort((left, right) => left.materia.cuatrimestre - right.materia.cuatrimestre);
  }, [estadoVisualPorMateria, materia, materias, materiasHabilitadas]);

  if (!materia) return null;

  const estadoActual = estadoVisualPorMateria[materia.id] ?? "pendiente";
  const minorTags = materia.minorTags ?? [];
  const correlativasPendientes = correlativas.filter(
    ({ estado }) => estado !== "regular" && estado !== "aprobada",
  ).length;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/72 p-4 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950/98 shadow-[0_24px_90px_rgba(2,6,23,0.82)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 md:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-cyan-300">{materia.id}</span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                {ETIQUETA_ESTADO[estadoActual]}
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                {materia.creditos} cr
              </span>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
                {materia.cuatrimestre}° cuatri sugerido
              </span>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-100 md:text-2xl">{materia.nombre}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {materiasHabilitadas[materia.id]
                ? "Ya la podés cursar con tu estado actual."
                : correlativasPendientes > 0
                  ? `Todavía depende de ${correlativasPendientes} correlativa${correlativasPendientes === 1 ? "" : "s"}.`
                  : `Necesita llegar a ${materia.creditosRequeridos} créditos aprobados.`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-slate-700 p-2 text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-900 hover:text-slate-100"
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:px-6">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-semibold text-slate-100">Correlativas y requisitos</h3>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Créditos aprobados requeridos</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">{materia.creditosRequeridos}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Oferta</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">
                    {materia.estadoOferta === "inactiva" ? "No activa" : "Activa"}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {correlativas.length > 0 ? (
                  correlativas.map(({ materia: correlativa, estado }) => (
                    <div
                      key={`corr-${correlativa.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-slate-400">{correlativa.id}</p>
                        <p className="truncate text-sm text-slate-100">{correlativa.nombre}</p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          estado === "aprobada"
                            ? "border-emerald-500/40 bg-emerald-950/25 text-emerald-200"
                            : estado === "regular"
                              ? "border-amber-500/40 bg-amber-950/25 text-amber-200"
                              : "border-slate-700 text-slate-400"
                        }`}
                      >
                        {estado}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">
                    No tiene correlativas directas.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-violet-300" />
                <h3 className="text-sm font-semibold text-slate-100">Qué desbloquea</h3>
              </div>

              <div className="mt-4 space-y-2">
                {desbloquea.length > 0 ? (
                  desbloquea.map(({ materia: desbloqueada, estadoVisual, habilitada }) => (
                    <div
                      key={`unlock-${desbloqueada.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-slate-400">{desbloqueada.id}</p>
                        <p className="truncate text-sm text-slate-100">{desbloqueada.nombre}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
                          {ETIQUETA_ESTADO[estadoVisual]}
                        </span>
                        {habilitada ? (
                          <span className="rounded-full border border-emerald-500/40 bg-emerald-950/25 px-2 py-0.5 text-emerald-200">
                            Ya habilitada
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">
                    No desbloquea materias directas en el plan.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-semibold text-slate-100">Acciones rápidas</h3>
              </div>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => onCambiarEstado(materia.id)}
                  className="w-full cursor-pointer rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-3 text-left text-sm font-medium text-cyan-100 transition-colors hover:border-cyan-300 hover:bg-cyan-500/20"
                >
                  Cambiar al siguiente estado
                </button>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  Click en la card sigue cambiando el estado rápido. Este panel es para decidir con más contexto.
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <div className="flex items-center gap-2">
                <CircleAlert className="h-4 w-4 text-amber-300" />
                <h3 className="text-sm font-semibold text-slate-100">Contexto extra</h3>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Grupo</p>
                  <p className="mt-1 text-slate-100">{materia.grupo}</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Minors</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {minorTags.length > 0 ? (
                      minorTags.map((tag) => (
                        <span
                          key={`${materia.id}-${tag}`}
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
                          style={{
                            borderColor: `${MINOR_COLORES[tag]}55`,
                            color: MINOR_COLORES[tag],
                            backgroundColor: `${MINOR_COLORES[tag]}14`,
                          }}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: MINOR_COLORES[tag] }}
                          />
                          {MINOR_SIGLAS[tag]} · {MINOR_LABELS[tag]}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No suma a un minor específico.</span>
                    )}
                  </div>
                </div>

                {!materiasHabilitadas[materia.id] ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 px-3 py-3 text-amber-100">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Lock className="h-4 w-4" />
                      Todavía no está habilitada
                    </div>
                    <p className="mt-1 text-xs text-amber-100/80">
                      Revisá las correlativas pendientes o los créditos aprobados requeridos para destrabarla.
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}