"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, CalendarDays, CheckCircle2, ExternalLink, List, RefreshCw } from "lucide-react";

import {
  detectScheduleConflicts,
  formatMeeting,
  isAsynchronousMeeting,
  isValidScheduleMeeting,
  layoutScheduleEvents,
  timeToMinutes,
} from "@/lib/scheduleUtils";
import type { PlannerScheduleEvent } from "@/types/schedule";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_LABELS: Record<string, string> = {
  MONDAY: "Lunes", TUESDAY: "Martes", WEDNESDAY: "Miércoles", THURSDAY: "Jueves",
  FRIDAY: "Viernes", SATURDAY: "Sábado", SUNDAY: "Domingo",
};
const EVENT_STYLES = [
  "border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100",
  "border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-100",
  "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
  "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
];

interface PlannerScheduleProps {
  events: PlannerScheduleEvent[];
  activeLabel: string;
  subjectsCount: number;
  selectedCount: number;
  referenceCount: number;
  loading: boolean;
  sourceError: string | null;
  onRetry?: () => void;
  onSelectCourses?: () => void;
}

function eventStyle(courseId: string): string {
  const score = [...courseId].reduce((total, character) => total + character.charCodeAt(0), 0);
  return EVENT_STYLES[score % EVENT_STYLES.length];
}

export function PlannerSchedule({
  events, activeLabel, subjectsCount, selectedCount, referenceCount, loading, sourceError,
  onRetry, onSelectCourses,
}: PlannerScheduleProps) {
  const [view, setView] = useState<"semana" | "agenda">("semana");
  const validEvents = events.filter(isValidScheduleMeeting);
  const scheduled = validEvents.filter((event) => !isAsynchronousMeeting(event));
  const asynchronous = validEvents.filter(isAsynchronousMeeting);
  const conflicts = detectScheduleConflicts(validEvents);
  const conflictedIds = new Set(conflicts.flatMap((conflict) => conflict.eventIds));
  const layout = layoutScheduleEvents(scheduled);
  const visibleDays = DAYS.filter((day, index) => index < 5 || scheduled.some((event) => event.day === day));
  const firstHour = Math.min(8, ...scheduled.map((event) => Math.floor(timeToMinutes(event.time_from) / 60)));
  const lastHour = Math.max(22, ...scheduled.map((event) => Math.ceil(timeToMinutes(event.time_to) / 60)));
  const minutes = (lastHour - firstHour) * 60;
  const hours = scheduled.reduce((total, event) => total + timeToMinutes(event.time_to) - timeToMinutes(event.time_from), 0) / 60;
  const gridColumns = `3.5rem repeat(${visibleDays.length}, minmax(8rem, 1fr))`;
  const eventById = new Map(events.map((event) => [event.id, event]));

  if (loading && subjectsCount > 0 && events.length === 0) {
    return (
      <div role="status" className="grid min-h-[24rem] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
        <div>
          <RefreshCw className="mx-auto size-6 animate-spin text-blue-700" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Actualizando horarios…</p>
          <p className="mt-1 text-xs text-slate-500">Podés seguir organizando tus materias mientras tanto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800">{activeLabel}</p>
          <p className="mt-1 text-xs text-slate-500">
            {selectedCount} de {subjectsCount} materias con comisión · {hours.toLocaleString("es-AR", { maximumFractionDigits: 1 })} h semanales con horario fijo
          </p>
        </div>
        {conflicts.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
            <AlertTriangle className="size-3.5" /> {conflicts.length} cruce{conflicts.length === 1 ? "" : "s"}
          </span>
        ) : selectedCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Sin cruces detectados
          </span>
        ) : null}
      </div>

      {sourceError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <p><strong>No pudimos actualizar los horarios.</strong> {sourceError}</p>
          {onRetry ? <button type="button" onClick={onRetry} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 font-bold disabled:opacity-50"><RefreshCw className="size-3.5" /> Reintentar</button> : null}
        </div>
      ) : null}

      {referenceCount > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{referenceCount} {referenceCount === 1 ? "materia usa" : "materias usan"} horarios del otro cuatrimestre del mismo año. Son una referencia; confirmalos cuando se publique la oferta de este período.</span>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3" aria-live="polite">
          <p className="text-xs font-bold text-rose-800">Revisá estas comisiones</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-rose-700">
            {conflicts.map((conflict) => (
              <li key={conflict.eventIds.join(":")}>
                <strong>{DAY_LABELS[conflict.day]} {conflict.from}–{conflict.to}:</strong>{" "}
                {conflict.eventIds.map((id) => eventById.get(id)?.courseName).join(" y ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="grid min-h-[24rem] place-items-center rounded-2xl border border-dashed border-slate-300 px-6 text-center">
          <div className="max-w-sm">
            <CalendarClock className="mx-auto size-8 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">{subjectsCount === 0 ? "Tu semana empieza con una materia" : "Elegí una comisión para ver tu semana"}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{subjectsCount === 0 ? "Agregá las materias que querés cursar en este cuatrimestre y después elegí sus comisiones." : "En Materias vas a encontrar los días, horarios y cupos publicados para cada comisión."}</p>
            {onSelectCourses ? <button type="button" onClick={onSelectCourses} className="mt-4 min-h-10 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800">Ir a materias</button> : null}
          </div>
        </div>
      ) : (
        <>
          {scheduled.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Incluye las clases virtuales con horario fijo.</p>
                <div className="flex rounded-xl bg-slate-100 p-1" aria-label="Formato del horario">
                  <button type="button" onClick={() => setView("semana")} aria-pressed={view === "semana"} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${view === "semana" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><CalendarDays className="size-3.5" /> Semana</button>
                  <button type="button" onClick={() => setView("agenda")} aria-pressed={view === "agenda"} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold ${view === "agenda" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}><List className="size-3.5" /> Agenda</button>
                </div>
              </div>

              {view === "semana" ? (
                <div>
                  <p className="mb-2 text-[11px] text-slate-500 sm:hidden">Deslizá para ver la semana o usá Agenda.</p>
                  <div tabIndex={0} role="region" aria-label={`Calendario semanal: ${activeLabel}`} className="max-h-[36rem] overflow-auto rounded-2xl border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-blue-600">
                    <div style={{ minWidth: `${56 + visibleDays.length * 136}px` }}>
                      <div className="sticky top-0 z-20 grid border-b border-slate-200 bg-white" style={{ gridTemplateColumns: gridColumns }}>
                        <div className="border-r border-slate-200" />
                        {visibleDays.map((day) => <div key={day} className="border-r border-slate-200 px-2 py-3 text-center text-xs font-bold text-slate-700 last:border-r-0">{DAY_LABELS[day]}</div>)}
                      </div>
                      <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
                        <div className="relative border-r border-slate-200 bg-slate-50" style={{ height: (lastHour - firstHour) * 48 }}>
                          {Array.from({ length: lastHour - firstHour }, (_, index) => <span key={index} className="absolute right-2 font-mono text-[10px] text-slate-400" style={{ top: index * 48 + 3 }}>{(firstHour + index).toString().padStart(2, "0")}:00</span>)}
                        </div>
                        {visibleDays.map((day) => (
                          <div key={day} className="relative border-r border-slate-200 last:border-r-0" style={{ height: (lastHour - firstHour) * 48, backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 47px, rgb(226 232 240 / 0.85) 47px, rgb(226 232 240 / 0.85) 48px)" }}>
                            {scheduled.filter((event) => event.day === day).map((event) => {
                              const start = timeToMinutes(event.time_from);
                              const end = timeToMinutes(event.time_to);
                              const position = layout.get(event.id) ?? { index: 0, count: 1 };
                              return (
                                <div key={event.id} tabIndex={0} className={`absolute overflow-hidden rounded-lg border p-1.5 text-[10px] leading-tight shadow-sm focus:z-30 focus:overflow-visible focus:outline-2 focus:outline-blue-600 ${conflictedIds.has(event.id) ? "border-rose-400 bg-rose-50 text-rose-950" : eventStyle(event.courseId)}`} style={{ top: `${((start - firstHour * 60) / minutes) * 100}%`, height: `${((end - start) / minutes) * 100}%`, left: `calc(${position.index * 100 / position.count}% + 3px)`, width: `calc(${100 / position.count}% - 6px)` }} title={`${event.courseName} · Comisión ${event.commissionName} · ${formatMeeting(event)}`} aria-label={`${event.courseName}, comisión ${event.commissionName}, ${formatMeeting(event)}${conflictedIds.has(event.id) ? ", con superposición" : ""}`}>
                                  <p className="font-mono font-bold">{event.courseId}</p>
                                  <p className="mt-0.5 line-clamp-2 font-semibold">{event.courseName}</p>
                                  <p className="mt-1">{event.time_from.slice(0, 5)}–{event.time_to.slice(0, 5)}</p>
                                  <p className="mt-0.5 truncate opacity-75">Com. {event.commissionName} · {event.classroom || event.building}</p>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {DAYS.filter((day) => scheduled.some((event) => event.day === day)).map((day) => (
                    <section key={day}>
                      <h4 className="mb-2 text-xs font-bold text-slate-500">{DAY_LABELS[day]}</h4>
                      <div className="space-y-2">
                        {scheduled.filter((event) => event.day === day).sort((left, right) => timeToMinutes(left.time_from) - timeToMinutes(right.time_from)).map((event) => (
                          <article key={event.id} className={`flex gap-3 rounded-xl border p-3 ${conflictedIds.has(event.id) ? "border-rose-300 bg-rose-50 text-rose-900" : eventStyle(event.courseId)}`}>
                            <p className="shrink-0 font-mono text-xs font-semibold">{event.time_from.slice(0, 5)}<span className="mt-1 block font-normal opacity-60">{event.time_to.slice(0, 5)}</span></p>
                            <div><h5 className="text-sm font-semibold">{event.courseName}</h5><p className="mt-1 text-xs opacity-75">{event.courseId} · Comisión {event.commissionName} · {event.classroom || event.building || "Aula por confirmar"}</p>{conflictedIds.has(event.id) ? <p className="mt-1 text-xs font-bold">Cruce de horario</p> : null}</div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {asynchronous.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-700">Actividades asincrónicas</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Sin asistencia en un horario fijo. No se cuentan como cruces.</p>
              <ul className="mt-3 space-y-2">{asynchronous.map((event) => <li key={event.id} className="rounded-lg bg-white px-3 py-2 text-xs text-slate-700"><strong>{event.courseName}</strong> · Comisión {event.commissionName}</li>)}</ul>
            </div>
          ) : null}
        </>
      )}

      <p className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] leading-5 text-slate-500">
        <span>Oferta del SGA con respaldo de CEITBA. Confirmá horarios y cupos antes de inscribirte.</span>
        <a href="https://ceitba.org.ar/scheduler/LN?plan=L20" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline">Consultar CEITBA <ExternalLink className="size-3" /></a>
      </p>
    </div>
  );
}
