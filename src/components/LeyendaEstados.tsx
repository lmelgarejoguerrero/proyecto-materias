import { BookOpen, GraduationCap, RefreshCcw } from "lucide-react";

interface LeyendaEstadosProps {
  creditosAprobados: number;
  creditosCursando: number;
  creditosProyectados: number;
  creditosTitulo: number;
  onReset: () => void;
  onAprobarCursadas: () => void;
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
  creditosCursando,
  creditosProyectados,
  creditosTitulo,
  onReset,
  onAprobarCursadas,
}: LeyendaEstadosProps) {
  const porcentajeCompletado = Math.min(100, (creditosAprobados / creditosTitulo) * 100);
  const porcentajeProyectado = Math.min(100, (creditosProyectados / creditosTitulo) * 100);

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
              {creditosAprobados}/{creditosTitulo} cr ({porcentajeCompletado.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-400"
              style={{ width: `${porcentajeCompletado}%` }}
            />
          </div>
          <div className="mt-2 mb-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Progreso proyectado (sumando cursando + regular)</span>
            <span>
              {creditosProyectados}/{creditosTitulo} cr ({porcentajeProyectado.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full"
              style={{
                width: `${porcentajeProyectado}%`,
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(56,189,248,0.9) 0px, rgba(56,189,248,0.9) 8px, rgba(14,116,144,0.95) 8px, rgba(14,116,144,0.95) 16px)",
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Te faltan {Math.max(0, creditosTitulo - creditosProyectados)} cr para llegar al total del
            plan ({creditosTitulo} cr).
          </p>
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

          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/60 bg-sky-950/30 px-3 py-1 text-sky-100">
            <BookOpen className="h-4 w-4" />
            {creditosCursando} {creditosCursando === 1 ? "credito" : "creditos"} cursando
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

          <a
            href="#minors"
            className="inline-flex items-center gap-2 rounded-full border border-violet-500/70 px-3 py-1 text-violet-200 transition-colors hover:border-violet-300 hover:bg-violet-950/30"
          >
            Planificar Minors
          </a>
        </div>
      </div>
    </header>
  );
}
