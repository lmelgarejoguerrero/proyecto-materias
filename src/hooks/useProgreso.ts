"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  calcularDisponibilidad,
  esEstadoMateria,
  getEstadoPersistido,
  nextEstadoMateria,
  normalizarProgreso,
} from "@/lib/planUtils";
import { progresoStore } from "@/lib/progressStore";
import type {
  EstadoMateria,
  EstadoVisualMateria,
  MateriaPlan,
  MapaHabilitadas,
  ProgresoMaterias,
} from "@/types/plan";

interface UseProgresoResult {
  progreso: ProgresoMaterias;
  estadoVisualPorMateria: Record<string, EstadoVisualMateria>;
  materiasHabilitadas: MapaHabilitadas;
  materiasPreview: Record<string, boolean>;
  creditosAprobados: number;
  creditosCursando: number;
  storageSincronizado: boolean;
  storageError: string | null;
  actualizarEstado: (materiaId: string) => void;
  actualizarEstadosMasivos: (materiaIds: string[], estado: EstadoMateria) => void;
  aprobarCursadas: () => void;
  resetearProgreso: () => void;
  reemplazarProgreso: (progreso: ProgresoMaterias) => void;
}

export function useProgreso(materias: MateriaPlan[]): UseProgresoResult {
  const snapshot = useSyncExternalStore(
    progresoStore.subscribe,
    progresoStore.getSnapshot,
    progresoStore.getServerSnapshot,
  );
  const idsValidos = useMemo(() => new Set(materias.map((materia) => materia.id)), [materias]);
  const progreso = useMemo(
    () => normalizarProgreso(snapshot.progreso, idsValidos),
    [snapshot.progreso, idsValidos],
  );
  const disponibilidad = useMemo(() => calcularDisponibilidad(materias, progreso), [materias, progreso]);
  const creditosCursando = useMemo(
    () => materias.reduce(
      (total, materia) => getEstadoPersistido(progreso, materia.id) === "cursando" ? total + materia.creditos : total,
      0,
    ),
    [materias, progreso],
  );

  const actualizarEstado = useCallback((materiaId: string) => {
    if (!idsValidos.has(materiaId)) return;
    progresoStore.update((actual) => ({
      ...actual,
      [materiaId]: nextEstadoMateria(getEstadoPersistido(actual, materiaId)),
    }));
  }, [idsValidos]);

  const actualizarEstadosMasivos = useCallback((materiaIds: string[], estado: EstadoMateria) => {
    const ids = materiaIds.filter((id) => idsValidos.has(id));
    if (ids.length === 0 || !esEstadoMateria(estado)) return;
    progresoStore.update((actual) => ({
      ...actual,
      ...Object.fromEntries(ids.map((id) => [id, estado])),
    }));
  }, [idsValidos]);

  const aprobarCursadas = useCallback(() => {
    progresoStore.update((actual) => Object.fromEntries(
      Object.entries(actual).map(([id, estado]) => [id, idsValidos.has(id) && estado === "cursando" ? "regular" : estado]),
    ));
  }, [idsValidos]);

  const resetearProgreso = useCallback(() => progresoStore.update(() => ({})), []);
  const reemplazarProgreso = useCallback((value: ProgresoMaterias) => {
    progresoStore.update(() => normalizarProgreso(value, idsValidos));
  }, [idsValidos]);

  return {
    progreso,
    ...disponibilidad,
    creditosCursando,
    storageSincronizado: snapshot.storageSincronizado,
    storageError: snapshot.storageError,
    actualizarEstado,
    actualizarEstadosMasivos,
    aprobarCursadas,
    resetearProgreso,
    reemplazarProgreso,
  };
}
