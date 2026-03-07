"use client";

import { motion } from "framer-motion";
import { CheckCircle2, CircleDashed, CircleDot, Info, PlayCircle } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { MINOR_COLORES, MINOR_SIGLAS } from "@/data/minorsMetadata";
import type { EstadoVisualMateria, MateriaPlan } from "@/types/plan";
import type { MinorTag } from "@/types/plan";

interface MateriaCardProps {
  materia: MateriaPlan;
  estadoVisual: EstadoVisualMateria;
  onClick: (materiaId: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onOpenDetail?: (materiaId: string) => void;
  className?: string;
  disabled?: boolean;
  etiquetaExtra?: string;
  selectedMinors?: MinorTag[];
  mostrarDetalleMinors?: boolean;
  style?: CSSProperties;
  compacta?: boolean;
}

const estilosEstado: Record<EstadoVisualMateria, string> = {
  pendiente:
    "border-slate-700/80 bg-slate-900/70 text-slate-100 hover:border-slate-500 hover:bg-slate-900",
  cursando:
    "border-sky-500 bg-sky-950/35 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.22)] hover:border-sky-400",
  regular:
    "border-amber-500 bg-amber-950/35 text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.25)] hover:border-amber-400",
  aprobada:
    "border-emerald-500 bg-emerald-950/35 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.2)] hover:border-emerald-400",
  puedo_cursar:
    "border-slate-200 bg-slate-900/85 text-slate-100 shadow-[0_0_16px_rgba(226,232,240,0.15)] hover:border-white",
  habilitable_preview:
    "border-sky-300 border-dashed bg-sky-950/20 text-sky-100 shadow-[0_0_14px_rgba(125,211,252,0.16)] hover:border-sky-200",
};

const etiquetasEstado: Record<EstadoVisualMateria, string> = {
  pendiente: "Pendiente",
  cursando: "Cursando",
  regular: "Regular",
  aprobada: "Aprobada",
  puedo_cursar: "Puedo cursar",
  habilitable_preview: "Habilitable",
};

const iconoEstado: Record<EstadoVisualMateria, ReactNode> = {
  pendiente: <CircleDashed className="h-4 w-4" />,
  cursando: <PlayCircle className="h-4 w-4" />,
  regular: <CircleDot className="h-4 w-4" />,
  aprobada: <CheckCircle2 className="h-4 w-4" />,
  puedo_cursar: <PlayCircle className="h-4 w-4" />,
  habilitable_preview: <CircleDashed className="h-4 w-4" />,
};

export function MateriaCard({
  materia,
  estadoVisual,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onOpenDetail,
  className,
  disabled = false,
  etiquetaExtra,
  selectedMinors = [],
  mostrarDetalleMinors = false,
  style,
  compacta = false,
}: MateriaCardProps) {
  const minorTags = materia.minorTags ?? [];
  const minorTagsActivos =
    selectedMinors.length > 0
      ? minorTags.filter((tag) => selectedMinors.includes(tag))
      : minorTags;

  const gradienteMinors =
    minorTagsActivos.length >= 2
      ? {
          backgroundImage: `linear-gradient(120deg, ${minorTagsActivos
            .map((tag) => `${MINOR_COLORES[tag]}22`)
            .join(", ")})`,
        }
      : undefined;

  const colorMinorUnico =
    minorTagsActivos.length === 1 ? MINOR_COLORES[minorTagsActivos[0]] : undefined;

  return (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => {
        if (!disabled) onClick(materia.id);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={disabled}
      className={`w-full rounded-xl border text-left transition-colors ${compacta ? "p-2" : "p-2.5"} ${estilosEstado[estadoVisual]} ${disabled ? "cursor-not-allowed opacity-60 saturate-50" : "cursor-pointer hover:shadow-[0_8px_24px_rgba(15,23,42,0.35)]"} ${className ?? ""}`}
      style={{
        ...gradienteMinors,
        ...(colorMinorUnico ? { borderColor: `${colorMinorUnico}` } : {}),
        ...style,
      }}
      aria-label={`${materia.id} ${materia.nombre}`}
    >
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <span className={`font-mono tracking-wide text-slate-300 ${compacta ? "text-[10px]" : "text-[11px]"}`}>
          {materia.id}
        </span>
        <div className="flex items-center gap-1">
          {onOpenDetail ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetail(materia.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenDetail(materia.id);
                }
              }}
              className="inline-flex cursor-pointer items-center rounded-full border border-slate-600/80 p-1 text-slate-300 transition-colors hover:border-slate-400 hover:bg-slate-900 hover:text-slate-100"
              aria-label={`Ver detalle de ${materia.nombre}`}
            >
              <Info className="h-3 w-3" />
            </span>
          ) : null}
          {etiquetaExtra ? (
            <span className="rounded-full border border-slate-500/70 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-slate-300">
              {etiquetaExtra}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider">
            {iconoEstado[estadoVisual]}
            {etiquetasEstado[estadoVisual]}
          </span>
        </div>
      </div>

      <p className={`${compacta ? "text-[12px]" : "text-[13px]"} font-semibold leading-tight`}>
        {materia.nombre}
      </p>

      <div className={`flex items-center justify-between text-slate-300 ${compacta ? "mt-1.5 text-[9px]" : "mt-2 text-[10px]"}`}>
        <span>{materia.creditos} cr</span>
        <span>Req: {materia.creditosRequeridos}</span>
      </div>

      {mostrarDetalleMinors && minorTags.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {minorTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-slate-600 px-1.5 py-0.5 text-[9px] text-slate-200"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: MINOR_COLORES[tag] }}
              />
              {MINOR_SIGLAS[tag]}
            </span>
          ))}
        </div>
      ) : null}
    </motion.button>
  );
}
