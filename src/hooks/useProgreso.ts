"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getEstadoPersistido,
  nextEstadoMateria,
  sumarCreditosAprobados,
} from "@/lib/planUtils";
import type {
  EstadoMateria,
  EstadoVisualMateria,
  MateriaPlan,
  MapaHabilitadas,
  ProgresoMaterias,
} from "@/types/plan";

const STORAGE_KEY = "malla-curricular:progreso:v1";

interface UseProgresoResult {
  progreso: ProgresoMaterias;
  estadoVisualPorMateria: Record<string, EstadoVisualMateria>;
  materiasHabilitadas: MapaHabilitadas;
  materiasPreview: Record<string, boolean>;
  creditosAprobados: number;
  actualizarEstado: (materiaId: string) => void;
  aprobarCursadas: () => void;
  resetearProgreso: () => void;
}

const ESTADOS_VALIDOS: EstadoMateria[] = ["pendiente", "cursando", "regular", "aprobada"];

function parsearProgreso(raw: string | null): ProgresoMaterias {
  if (!raw) return {};

  try {
    const parseado = JSON.parse(raw) as Record<string, unknown>;
    const progreso: ProgresoMaterias = {};

    for (const [id, estado] of Object.entries(parseado)) {
      if (typeof estado === "string" && ESTADOS_VALIDOS.includes(estado as EstadoMateria)) {
        if (estado !== "pendiente") {
          progreso[id] = estado as EstadoMateria;
        }
      }
    }

    return progreso;
  } catch {
    return {};
  }
}

export function useProgreso(materias: MateriaPlan[]): UseProgresoResult {
  const [progreso, setProgreso] = useState<ProgresoMaterias>({});
  const [storageSincronizado, setStorageSincronizado] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const guardado = window.localStorage.getItem(STORAGE_KEY);
      setProgreso(parsearProgreso(guardado));
      setStorageSincronizado(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!storageSincronizado) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progreso));
  }, [progreso, storageSincronizado]);

  const creditosAprobados = useMemo(
    () => sumarCreditosAprobados(materias, progreso),
    [materias, progreso],
  );

  const materiasHabilitadas = useMemo(() => {
    const habilitadas: MapaHabilitadas = {};

    for (const materia of materias) {
      const estadoActual = getEstadoPersistido(progreso, materia.id);
      const correlativasCumplidas = materia.correlativas.every((correlativaId) => {
        const estadoCorrelativa = getEstadoPersistido(progreso, correlativaId);
        return estadoCorrelativa === "regular" || estadoCorrelativa === "aprobada";
      });

      const creditosCumplidos = creditosAprobados >= materia.creditosRequeridos;
      const habilitada = correlativasCumplidas && creditosCumplidos;

      habilitadas[materia.id] = estadoActual !== "aprobada" && habilitada;
    }

    return habilitadas;
  }, [materias, progreso, creditosAprobados]);

  const materiasPreview = useMemo(() => {
    const preview: Record<string, boolean> = {};
    const desbloqueaDirecto = new Map<string, string[]>();

    for (const materia of materias) {
      for (const correlativaId of materia.correlativas) {
        const hijos = desbloqueaDirecto.get(correlativaId) ?? [];
        desbloqueaDirecto.set(correlativaId, [...hijos, materia.id]);
      }
    }

    for (const materia of materias) {
      const estado = getEstadoPersistido(progreso, materia.id);
      if (estado !== "cursando") continue;

      const hijosDirectos = desbloqueaDirecto.get(materia.id) ?? [];
      for (const hijoId of hijosDirectos) {
        const estadoHijo = getEstadoPersistido(progreso, hijoId);
        if (estadoHijo === "pendiente" && !materiasHabilitadas[hijoId]) {
          preview[hijoId] = true;
        }
      }
    }

    return preview;
  }, [materias, progreso, materiasHabilitadas]);

  const estadoVisualPorMateria = useMemo(() => {
    const estadoVisual: Record<string, EstadoVisualMateria> = {};

    for (const materia of materias) {
      const estadoPersistido = getEstadoPersistido(progreso, materia.id);

      if (estadoPersistido !== "pendiente") {
        estadoVisual[materia.id] = estadoPersistido;
      } else {
        if (materiasHabilitadas[materia.id]) {
          estadoVisual[materia.id] = "puedo_cursar";
        } else if (materiasPreview[materia.id]) {
          estadoVisual[materia.id] = "habilitable_preview";
        } else {
          estadoVisual[materia.id] = "pendiente";
        }
      }
    }

    return estadoVisual;
  }, [materias, progreso, materiasHabilitadas, materiasPreview]);

  const actualizarEstado = useCallback((materiaId: string) => {
    setProgreso((actual) => {
      const estadoActual = getEstadoPersistido(actual, materiaId);
      const siguiente = nextEstadoMateria(estadoActual);

      if (siguiente === "pendiente") {
        const copia = { ...actual };
        delete copia[materiaId];
        return copia;
      }

      return {
        ...actual,
        [materiaId]: siguiente,
      };
    });
  }, []);

  const resetearProgreso = useCallback(() => {
    setProgreso({});
  }, []);

  const aprobarCursadas = useCallback(() => {
    setProgreso((actual) => {
      const siguiente: ProgresoMaterias = { ...actual };

      for (const [id, estado] of Object.entries(actual)) {
        if (estado === "cursando") {
          siguiente[id] = "regular";
        }
      }

      return siguiente;
    });
  }, []);

  return {
    progreso,
    estadoVisualPorMateria,
    materiasHabilitadas,
    materiasPreview,
    creditosAprobados,
    actualizarEstado,
    aprobarCursadas,
    resetearProgreso,
  };
}
