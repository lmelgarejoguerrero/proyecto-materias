"use client";

import { AlertTriangle, CalendarClock, ExternalLink, RefreshCw } from "lucide-react";

import { detectScheduleConflicts, formatMeeting } from "@/lib/scheduleUtils";
import type { PlannerScheduleEvent } from "@/types/schedule";

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
const DAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
};
const START_HOUR = 8;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

const EVENT_STYLES = [
  "border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100",
  "border-indigo-300 bg-indigo-50 text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-100",
  "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100",
  "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100",
] as const;

interface PlannerScheduleProps {
  events: PlannerScheduleEvent[];
  activeLabel: string;
  subjectsCount: number;
  selectedCount: number;
  referenceCount: number;
  loading: boolean;
  sourceError: string | null;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function eventStyle(courseId: string): string {
  const score = [...courseId].reduce((total, character) => total + character.charCodeAt(0), 0);
  return EVENT_STYLES[score % EVENT_STYLES.length];
}

export function PlannerSchedule({
  events,
  activeLabel,
  subjectsCount,
  selectedCount,
  referenceCount,
  loading,
  sourceError,
}: PlannerScheduleProps) {
  const conflicts = detectScheduleConflicts(events);
  const conflictedIds = new Set(conflicts.flatMap((conflict) => conflict.eventIds));
  const weekdayEvents = events.filter(
    (event) =>
      WEEKDAYS.includes(event.day as (typeof WEEKDAYS)[number]) && event.building !== "Online",
  );
  const complementaryEvents = events.filter(
    (event) =>
      !WEEKDAYS.includes(event.day as (typeof WEEKDAYS)[number]) || event.building === "Online",
  );
  const conflictLayout = new Map<string, { index: number; count: number }>();
  const adjacency = new Map<string, Set<string>>();
  for (const conflict of conflicts) {
    const [left, right] = conflict.eventIds;
    adjacency.set(left, new Set([...(adjacency.get(left) ?? []), right]));
    adjacency.set(right, new Set([...(adjacency.get(right) ?? []), left]));
  }
  const visited = new Set<string>();
  for (const eventId of adjacency.keys()) {
    if (visited.has(eventId)) continue;
    const pending = [eventId];
    const group: string[] = [];
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      group.push(current);
      for (const neighbor of adjacency.get(current) ?? []) pending.push(neighbor);
    }
    group.sort();
    group.forEach((id, index) => conflictLayout.set(id, { index, count: group.length }));
  }

  if (loading) {
    return (
      <div className="grid min-h-[30rem] place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
        <div>
          <RefreshCw className="mx-auto size-6 animate-spin text-blue-700" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Actualizando horarios…</p>
          <p className="mt-1 text-xs text-slate-500">La planificación sigue disponible aunque la fuente tarde.</p>
        </div>
      </div>
    );
  }

  if (sourceError) {
    return (
      <div className="grid min-h-[30rem] place-items-center rounded-2xl border border-amber-200 bg-amber-50 px-6 text-center">
        <div className="max-w-md">
          <AlertTriangle className="mx-auto size-6 text-amber-700" />
          <p className="mt-3 text-sm font-semibold text-amber-900">No pudimos actualizar los horarios</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">{sourceError}</p>
          <a
            href="https://ceitba.org.ar/scheduler/LN?plan=L20"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-900 px-4 text-xs font-bold text-white"
          >
            Abrir combinador CEITBA <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-2xl bg-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-slate-800">{activeLabel}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {selectedCount} de {subjectsCount} materias con comisión elegida
          </p>
        </div>
        {conflicts.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
            <AlertTriangle className="size-3.5" /> {conflicts.length} choque{conflicts.length === 1 ? "" : "s"}
          </span>
        ) : selectedCount > 0 ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            Sin superposiciones
          </span>
        ) : null}
      </div>

      {referenceCount > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {referenceCount} {referenceCount === 1 ? "materia usa" : "materias usan"} horarios del otro
            cuatrimestre del mismo año como referencia. Confirmalos cuando se publique la oferta exacta.
          </span>
        </div>
      ) : null}

      {subjectsCount === 0 ? (
        <div className="grid min-h-[28rem] place-items-center rounded-2xl border border-dashed border-slate-300 px-6 text-center">
          <div>
            <CalendarClock className="mx-auto size-7 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">Primero agregá materias a este cuatrimestre</p>
            <p className="mt-1 text-xs text-slate-500">Después vas a poder elegir comisiones y detectar cruces.</p>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="grid min-h-[28rem] place-items-center rounded-2xl border border-dashed border-slate-300 px-6 text-center">
          <div>
            <CalendarClock className="mx-auto size-7 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">Elegí una comisión en la pestaña Materias</p>
            <p className="mt-1 text-xs text-slate-500">El calendario se arma solo con los días, aulas y sedes publicados.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="max-h-[34rem] overflow-auto rounded-2xl border border-slate-200 bg-white">
            <div className="min-w-[760px]">
              <div className="sticky top-0 z-20 grid grid-cols-[3.5rem_repeat(5,minmax(8rem,1fr))] border-b border-slate-200 bg-white">
                <div className="border-r border-slate-200" />
                {WEEKDAYS.map((day) => (
                  <div key={day} className="border-r border-slate-200 px-2 py-2 text-center text-xs font-bold text-slate-700 last:border-r-0">
                    {DAY_LABELS[day]}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[3.5rem_repeat(5,minmax(8rem,1fr))]">
                <div className="relative h-[616px] border-r border-slate-200 bg-slate-50">
                  {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
                    <span
                      key={index}
                      className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-slate-400"
                      style={{ top: `${(index / (END_HOUR - START_HOUR)) * 100}%` }}
                    >
                      {(START_HOUR + index).toString().padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="relative h-[616px] border-r border-slate-200 last:border-r-0"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(to bottom, transparent 0, transparent 43px, rgb(226 232 240 / 0.85) 43px, rgb(226 232 240 / 0.85) 44px)",
                    }}
                  >
                    {weekdayEvents
                      .filter((event) => event.day === day)
                      .map((event) => {
                        const start = Math.max(START_HOUR * 60, timeToMinutes(event.time_from));
                        const end = Math.min(END_HOUR * 60, timeToMinutes(event.time_to));
                        const top = ((start - START_HOUR * 60) / TOTAL_MINUTES) * 100;
                        const height = Math.max(3, ((end - start) / TOTAL_MINUTES) * 100);
                        const conflict = conflictedIds.has(event.id);
                        const layout = conflictLayout.get(event.id);
                        const left = layout ? (layout.index / layout.count) * 100 : 0;
                        const width = layout ? 100 / layout.count : 100;
                        return (
                          <div
                            key={event.id}
                            className={`absolute overflow-hidden rounded-lg border p-1.5 text-[10px] leading-tight shadow-sm ${
                              conflict
                                ? "z-10 border-rose-500 bg-rose-50 text-rose-950 dark:bg-rose-950 dark:text-rose-100"
                                : eventStyle(event.courseId)
                            }`}
                            style={{
                              top: `${top}%`,
                              height: `${height}%`,
                              left: `calc(${left}% + 0.25rem)`,
                              width: `calc(${width}% - 0.5rem)`,
                            }}
                            title={`${event.courseName} · ${formatMeeting(event)}`}
                          >
                            <p className="font-mono font-bold">{event.courseId}</p>
                            <p className="mt-0.5 line-clamp-2 font-semibold">{event.courseName}</p>
                            <p className="mt-1 opacity-75">
                              {event.time_from.slice(0, 5)}–{event.time_to.slice(0, 5)} · {event.commissionName}
                            </p>
                            <p className="truncate opacity-75">{event.classroom || event.building}</p>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {complementaryEvents.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Virtuales y fin de semana</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {complementaryEvents.map((event) => (
                  <span key={event.id} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm">
                    <strong>{event.courseId}</strong> · {formatMeeting(event)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <p className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] leading-4 text-slate-500">
        <span>El snapshot del SGA tiene prioridad; CEITBA se usa como respaldo. Verificá siempre antes de matricularte.</span>
        <a
          href="https://ceitba.org.ar/scheduler/LN?plan=L20"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline"
        >
          Fuente original <ExternalLink className="size-3" />
        </a>
      </p>
    </div>
  );
}
