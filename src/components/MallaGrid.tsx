"use client";

import { useMemo } from "react";
import { Target } from "lucide-react";

import { MateriaCard } from "@/components/MateriaCard";
import type {
  EstadoVisualMateria,
  GrupoMateria,
  MateriaPlan,
  SlotElectiva8Cuat,
} from "@/types/plan";

interface MallaGridProps {
  materias: MateriaPlan[];
  estadoVisualPorMateria: Record<string, EstadoVisualMateria>;
  onMateriaClick: (materiaId: string) => void;
  onOpenDetail: (materiaId: string) => void;
  progresoSlots8Cuat: Record<SlotElectiva8Cuat, { aprobado: number; objetivo: number }>;
  onSeleccionarSlot: (slot: SlotElectiva8Cuat) => void;
  slotActivo: SlotElectiva8Cuat | null;
  seleccionMultipleActiva: boolean;
  materiasSeleccionadas: Set<string>;
  onToggleSeleccion: (materiaId: string) => void;
  modoVista: "anios" | "columnas";
  compacta: boolean;
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
  onOpenDetail,
  progresoSlots8Cuat,
  onSeleccionarSlot,
  slotActivo,
  seleccionMultipleActiva,
  materiasSeleccionadas,
  onToggleSeleccion,
  modoVista,
  compacta,
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

  const materiasPorAnio = useMemo(() => {
    const agrupadas = new Map<number, { primerCuatri: MateriaPlan[]; segundoCuatri: MateriaPlan[] }>();

    for (const materia of materiasTroncales) {
      const anio = Math.ceil(materia.cuatrimestre / 2);
      const grupoAnual = agrupadas.get(anio) ?? { primerCuatri: [], segundoCuatri: [] };

      if (materia.cuatrimestre % 2 === 1) {
        grupoAnual.primerCuatri = [...grupoAnual.primerCuatri, materia];
      } else {
        grupoAnual.segundoCuatri = [...grupoAnual.segundoCuatri, materia];
      }

      agrupadas.set(anio, grupoAnual);
    }

    return [...agrupadas.entries()].sort(([left], [right]) => left - right);
  }, [materiasTroncales]);

  const renderEmptyState = (mensaje: string) => (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-3 py-6 text-center text-xs text-slate-500">
      {mensaje}
    </div>
  );

  const renderMateria = (materia: MateriaPlan) => (
    <div key={materia.id}>
      <MateriaCard
        materia={materia}
        estadoVisual={estadoVisualPorMateria[materia.id] ?? "pendiente"}
        onClick={seleccionMultipleActiva ? onToggleSeleccion : onMateriaClick}
        onOpenDetail={onOpenDetail}
        compacta={compacta}
        className={
          seleccionMultipleActiva && materiasSeleccionadas.has(materia.id)
            ? "ring-2 ring-cyan-400"
            : undefined
        }
      />
    </div>
  );

  const renderPools = () => (
    <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col rounded-2xl border border-slate-800/60 bg-slate-950/40 p-2">
        <header className="mb-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-2 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
            Contenedores de créditos
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">Resumen del 8° cuatrimestre</p>
        </header>

        <div className="space-y-2.5">
          {(
            [
              ["gestion", "Electivas Gestión (27 cr)"],
              ["proyecto-final", "Electivas Proyecto Final (3 cr)"],
              ["sistemas-tecnologia", "Electivas Sistemas y Tecnología (30 cr)"],
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
                  {progreso.aprobado}/{progreso.objetivo} créditos
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
        } flex min-h-0 flex-col`}
      >
        <header className="mb-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-2 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
            Electivas de Gestión
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {progresoSlots8Cuat.gestion.aprobado}/{progresoSlots8Cuat.gestion.objetivo} créditos
          </p>
        </header>
        <div className="space-y-2 overflow-y-auto pr-1">
          {poolGestion.length > 0
            ? poolGestion.map((materia) => renderMateria(materia))
            : renderEmptyState("No hay electivas de gestión con los filtros actuales.")}
        </div>
      </section>

      <section
        className={`rounded-2xl border bg-slate-950/40 p-2 ${
          slotActivo === "sistemas-tecnologia" ? "border-cyan-500/70" : "border-slate-800/60"
        } flex min-h-0 flex-col`}
      >
        <header className="mb-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-2 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
            Electivas de Tecnología
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {progresoSlots8Cuat["sistemas-tecnologia"].aprobado}/
            {progresoSlots8Cuat["sistemas-tecnologia"].objetivo} créditos
          </p>
        </header>
        <div className="space-y-2 overflow-y-auto pr-1">
          {poolTecnologia.length > 0
            ? poolTecnologia.map((materia) => renderMateria(materia))
            : renderEmptyState("No hay electivas de tecnología con los filtros actuales.")}
        </div>
      </section>

      <section
        className={`rounded-2xl border bg-slate-950/40 p-2 ${
          slotActivo === "proyecto-final" ? "border-cyan-500/70" : "border-slate-800/60"
        } flex min-h-0 flex-col`}
      >
        <header className="mb-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3 py-2 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-100">
            Proyecto Final y Otros
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {progresoSlots8Cuat["proyecto-final"].aprobado}/
            {progresoSlots8Cuat["proyecto-final"].objetivo} créditos
          </p>
        </header>
        <div className="space-y-2 overflow-y-auto pr-1">
          {poolProyectoFinalYOtros.length > 0
            ? poolProyectoFinalYOtros.map((materia) => renderMateria(materia))
            : renderEmptyState("No hay materias en este pool con los filtros actuales.")}
        </div>
      </section>
    </div>
  );

  return (
    modoVista === "columnas" ? (
      <div className="h-full overflow-x-auto overflow-y-hidden pb-2">
        <div className="relative h-full min-w-max px-4 py-4">
          <div className="relative z-10 grid h-full grid-flow-col auto-cols-[17rem] gap-4">
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
                  {materiasColumna.length > 0
                    ? materiasColumna.map((materia) => renderMateria(materia))
                    : renderEmptyState("No hay materias que coincidan en este cuatrimestre.")}
                </div>
              </section>
            ))}

            <div className="min-w-[72rem]">{renderPools()}</div>
          </div>
        </div>
      </div>
    ) : (
      <div className="h-full overflow-y-auto pb-2">
        <div className="space-y-4 px-4 py-4">
          {materiasPorAnio.map(([anio, cuatris]) => (
            <section
              key={`anio-${anio}`}
              className="rounded-3xl border border-slate-800/70 bg-slate-950/40 p-4"
            >
              <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Año {anio}</h2>
                  <p className="text-sm text-slate-500">
                    {cuatris.primerCuatri.length + cuatris.segundoCuatri.length} materias visibles
                  </p>
                </div>
              </header>

              <div className="grid gap-4 xl:grid-cols-2">
                {([
                  [1, cuatris.primerCuatri],
                  [2, cuatris.segundoCuatri],
                ] as [1 | 2, MateriaPlan[]][]).map(([numeroCuatri, materiasDelCuatri]) => (
                  <article
                    key={`anio-${anio}-cuatri-${numeroCuatri}`}
                    className="rounded-2xl border border-slate-800 bg-slate-950/55 p-3"
                  >
                    <header className="mb-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                      <h3 className="text-sm font-semibold text-slate-100">
                        {numeroCuatri}° cuatrimestre
                      </h3>
                      <p className="text-xs text-slate-500">{materiasDelCuatri.length} materias</p>
                    </header>

                    <div className="space-y-2.5">
                      {materiasDelCuatri.length > 0
                        ? materiasDelCuatri.map((materia) => renderMateria(materia))
                        : renderEmptyState("No hay materias visibles en este cuatrimestre.")}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          {renderPools()}
        </div>
      </div>
    )
  );
}
