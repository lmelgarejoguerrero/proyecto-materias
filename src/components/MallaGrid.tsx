"use client";

import { useMemo } from "react";
import { Target } from "lucide-react";

import { MateriaCard } from "@/components/MateriaCard";
import type {
  EstadoVisualMateria,
  GrupoMateria,
  MateriaPlan,
  MinorTag,
  SlotElectiva8Cuat,
} from "@/types/plan";

interface MallaGridProps {
  materias: MateriaPlan[];
  estadoVisualPorMateria: Record<string, EstadoVisualMateria>;
  onMateriaClick: (materiaId: string) => void;
  selectedMinors: MinorTag[];
  interseccionMateriaIds: Set<string>;
  progresoSlots8Cuat: Record<SlotElectiva8Cuat, { aprobado: number; objetivo: number }>;
  onSeleccionarSlot: (slot: SlotElectiva8Cuat) => void;
  slotActivo: SlotElectiva8Cuat | null;
}

const ORDEN_GRUPO: Record<GrupoMateria, number> = {
  obligatoria: 0,
  "electiva-gestion": 1,
  "electiva-sistemas-tecnologia": 2,
  "electiva-proyecto-final": 3,
  "skills-complementarias": 4,
};

function etiquetaCuatrimestre(cuatrimestre: number): string {
  const anio = Math.ceil(cuatrimestre / 2);
  const numeroCuat = cuatrimestre % 2 === 0 ? 2 : 1;
  return `Ano ${anio} - ${numeroCuat}° Cuatrimestre`;
}

export function MallaGrid({
  materias,
  estadoVisualPorMateria,
  onMateriaClick,
  selectedMinors,
  interseccionMateriaIds,
  progresoSlots8Cuat,
  onSeleccionarSlot,
  slotActivo,
}: MallaGridProps) {
  const materiasOrdenadas = useMemo(() => {
    return [...materias].sort((a, b) => {
      if (a.cuatrimestre !== b.cuatrimestre) {
        return a.cuatrimestre - b.cuatrimestre;
      }

      if (a.grupo !== b.grupo) {
        return ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo];
      }

      return a.id.localeCompare(b.id);
    });
  }, [materias]);

  const materiasTroncales = useMemo(
    () => materiasOrdenadas.filter((materia) => materia.cuatrimestre <= 7),
    [materiasOrdenadas],
  );

  const poolGestion = useMemo(
    () => materiasOrdenadas.filter((materia) => materia.grupo === "electiva-gestion"),
    [materiasOrdenadas],
  );
  const poolTecnologia = useMemo(
    () =>
      materiasOrdenadas.filter((materia) => materia.grupo === "electiva-sistemas-tecnologia"),
    [materiasOrdenadas],
  );
  const poolProyectoFinalYOtros = useMemo(
    () =>
      materiasOrdenadas.filter(
        (materia) =>
          materia.grupo === "electiva-proyecto-final" || materia.grupo === "skills-complementarias",
      ),
    [materiasOrdenadas],
  );

  const materiasPorCuatrimestre = useMemo(() => {
    const agrupadas = new Map<number, MateriaPlan[]>();
    for (let i = 1; i <= 7; i += 1) {
      agrupadas.set(i, []);
    }

    for (const materia of materiasTroncales) {
      const existentes = agrupadas.get(materia.cuatrimestre) ?? [];
      agrupadas.set(materia.cuatrimestre, [...existentes, materia]);
    }

    return [...agrupadas.entries()];
  }, [materiasTroncales]);

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden pb-2">
      <div className="relative h-full min-w-max px-4 py-4">
        <div className="relative z-10 grid h-full grid-flow-col auto-cols-[19rem] gap-4">
          {materiasPorCuatrimestre.map(([cuatrimestre, materiasColumna]) => (
            <section
              key={cuatrimestre}
              className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-800/60 bg-slate-950/40 p-2"
            >
              <header className="sticky top-0 z-20 mb-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-2 backdrop-blur">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
                  {etiquetaCuatrimestre(cuatrimestre)}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {materiasColumna.length} materias
                </p>
              </header>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                {materiasColumna.map((materia) => (
                  <div key={materia.id}>
                    <MateriaCard
                      materia={materia}
                      estadoVisual={estadoVisualPorMateria[materia.id] ?? "pendiente"}
                      onClick={onMateriaClick}
                      className={
                        [
                          interseccionMateriaIds.has(materia.id)
                            ? "bg-gradient-to-r from-violet-950/30 to-cyan-950/30 ring-1 ring-violet-400/70"
                            : "",
                          selectedMinors.length > 0 &&
                          !interseccionMateriaIds.has(materia.id) &&
                          (materia.minorTags ?? []).some((minor) => selectedMinors.includes(minor))
                            ? "ring-1 ring-sky-400/50"
                            : "",
                        ].join(" ")
                      }
                      disabled={materia.estadoOferta === "inactiva"}
                      etiquetaExtra={materia.estadoOferta === "inactiva" ? "No disponible" : undefined}
                      selectedMinors={selectedMinors}
                      mostrarDetalleMinors
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="flex h-full min-h-0 flex-col rounded-2xl border border-slate-800/60 bg-slate-950/40 p-2">
            <header className="sticky top-0 z-20 mb-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-2 backdrop-blur">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
                {etiquetaCuatrimestre(8)}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">Contenedores de creditos</p>
            </header>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {(
                [
                  ["gestion", "Electivas Gestion (27 cr)"],
                  ["proyecto-final", "Electivas Proyecto Final (3 cr)"],
                  ["sistemas-tecnologia", "Electivas Sistemas y Tecnologia (30 cr)"],
                ] as [SlotElectiva8Cuat, string][]
              ).map(([slot, titulo]) => {
                const progreso = progresoSlots8Cuat[slot];
                const percent = Math.min(100, (progreso.aprobado / progreso.objetivo) * 100);
                const activo = slotActivo === slot;

                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onSeleccionarSlot(slot)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                      activo
                        ? "border-cyan-400 bg-cyan-950/25"
                        : "border-slate-700 bg-slate-900/70 hover:border-slate-500"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">{titulo}</p>
                      <Target className="h-4 w-4 text-slate-300" />
                    </div>
                    <p className="text-xs text-slate-400">
                      {progreso.aprobado}/{progreso.objetivo} creditos
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${percent}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className={`rounded-2xl border bg-slate-950/40 p-2 ${
              slotActivo === "gestion" ? "border-cyan-500/70" : "border-slate-800/60"
            } flex h-full min-h-0 flex-col`}
          >
            <header className="sticky top-0 z-20 mb-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-2 backdrop-blur">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
                Electivas de Gestion (Pool)
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {progresoSlots8Cuat.gestion.aprobado}/{progresoSlots8Cuat.gestion.objetivo} creditos
              </p>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {poolGestion.map((materia) => (
                <div key={materia.id}>
                  <MateriaCard
                    materia={materia}
                    estadoVisual={estadoVisualPorMateria[materia.id] ?? "pendiente"}
                    onClick={onMateriaClick}
                    className={
                      [
                        interseccionMateriaIds.has(materia.id)
                          ? "bg-gradient-to-r from-violet-950/30 to-cyan-950/30 ring-1 ring-violet-400/70"
                          : "",
                        selectedMinors.length > 0 &&
                        !interseccionMateriaIds.has(materia.id) &&
                        (materia.minorTags ?? []).some((minor) => selectedMinors.includes(minor))
                          ? "ring-1 ring-sky-400/50"
                          : "",
                      ].join(" ")
                    }
                    disabled={materia.estadoOferta === "inactiva"}
                    etiquetaExtra={materia.estadoOferta === "inactiva" ? "No disponible" : undefined}
                    selectedMinors={selectedMinors}
                    mostrarDetalleMinors
                  />
                </div>
              ))}
            </div>
          </section>

          <section
            className={`rounded-2xl border bg-slate-950/40 p-2 ${
              slotActivo === "sistemas-tecnologia" ? "border-cyan-500/70" : "border-slate-800/60"
            } flex h-full min-h-0 flex-col`}
          >
            <header className="sticky top-0 z-20 mb-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-2 backdrop-blur">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
                Electivas de Tecnologia (Pool)
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {progresoSlots8Cuat["sistemas-tecnologia"].aprobado}/
                {progresoSlots8Cuat["sistemas-tecnologia"].objetivo} creditos
              </p>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {poolTecnologia.map((materia) => (
                <div key={materia.id}>
                  <MateriaCard
                    materia={materia}
                    estadoVisual={estadoVisualPorMateria[materia.id] ?? "pendiente"}
                    onClick={onMateriaClick}
                    className={
                      [
                        interseccionMateriaIds.has(materia.id)
                          ? "bg-gradient-to-r from-violet-950/30 to-cyan-950/30 ring-1 ring-violet-400/70"
                          : "",
                        selectedMinors.length > 0 &&
                        !interseccionMateriaIds.has(materia.id) &&
                        (materia.minorTags ?? []).some((minor) => selectedMinors.includes(minor))
                          ? "ring-1 ring-sky-400/50"
                          : "",
                      ].join(" ")
                    }
                    disabled={materia.estadoOferta === "inactiva"}
                    etiquetaExtra={materia.estadoOferta === "inactiva" ? "No disponible" : undefined}
                    selectedMinors={selectedMinors}
                    mostrarDetalleMinors
                  />
                </div>
              ))}
            </div>
          </section>

          <section
            className={`rounded-2xl border bg-slate-950/40 p-2 ${
              slotActivo === "proyecto-final" ? "border-cyan-500/70" : "border-slate-800/60"
            } flex h-full min-h-0 flex-col`}
          >
            <header className="sticky top-0 z-20 mb-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-2 backdrop-blur">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
                Proyecto Final y Otros
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {progresoSlots8Cuat["proyecto-final"].aprobado}/{progresoSlots8Cuat["proyecto-final"].objetivo} creditos
              </p>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {poolProyectoFinalYOtros.map((materia) => (
                <div key={materia.id}>
                  <MateriaCard
                    materia={materia}
                    estadoVisual={estadoVisualPorMateria[materia.id] ?? "pendiente"}
                    onClick={onMateriaClick}
                    className={
                      [
                        interseccionMateriaIds.has(materia.id)
                          ? "bg-gradient-to-r from-violet-950/30 to-cyan-950/30 ring-1 ring-violet-400/70"
                          : "",
                        selectedMinors.length > 0 &&
                        !interseccionMateriaIds.has(materia.id) &&
                        (materia.minorTags ?? []).some((minor) => selectedMinors.includes(minor))
                          ? "ring-1 ring-sky-400/50"
                          : "",
                      ].join(" ")
                    }
                    disabled={materia.estadoOferta === "inactiva"}
                    etiquetaExtra={materia.estadoOferta === "inactiva" ? "No disponible" : undefined}
                    selectedMinors={selectedMinors}
                    mostrarDetalleMinors
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
