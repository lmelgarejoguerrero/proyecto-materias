"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[80dvh] place-items-center px-5">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <TriangleAlert className="mx-auto size-9 text-amber-600" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">No pudimos cargar esta vista</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Tus datos guardados siguen en este navegador. Intentá cargar la vista de nuevo para continuar.</p>
        <button type="button" onClick={reset} className="mx-auto mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"><RefreshCw className="size-4" /> Volver a intentar</button>
      </div>
    </main>
  );
}
