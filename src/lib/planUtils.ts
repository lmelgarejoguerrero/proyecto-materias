import type {
  EstadoMateria,
  MateriaPlan,
  MinorTag,
  ProgresoMaterias,
  SlotElectiva8Cuat,
} from "@/types/plan";

export interface InconsistenciaCorrelativa {
  materiaId: string;
  correlativaId: string;
}

export interface ReporteValidacionPlan {
  idsDuplicados: string[];
  correlativasInexistentes: InconsistenciaCorrelativa[];
}

export function validarPlan(materias: MateriaPlan[]): ReporteValidacionPlan {
  const contadorIds = new Map<string, number>();

  for (const materia of materias) {
    contadorIds.set(materia.id, (contadorIds.get(materia.id) ?? 0) + 1);
  }

  const idsDuplicados = [...contadorIds.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const idsValidos = new Set(materias.map((materia) => materia.id));
  const correlativasInexistentes: InconsistenciaCorrelativa[] = [];

  for (const materia of materias) {
    for (const correlativaId of materia.correlativas) {
      if (!idsValidos.has(correlativaId)) {
        correlativasInexistentes.push({ materiaId: materia.id, correlativaId });
      }
    }
  }

  return {
    idsDuplicados,
    correlativasInexistentes,
  };
}

export function nextEstadoMateria(estado: EstadoMateria): EstadoMateria {
  if (estado === "pendiente") return "cursando";
  if (estado === "cursando") return "regular";
  if (estado === "regular") return "aprobada";
  return "pendiente";
}

export function getEstadoPersistido(
  progreso: ProgresoMaterias,
  materiaId: string,
): EstadoMateria {
  return progreso[materiaId] ?? "pendiente";
}

export function sumarCreditosAprobados(
  materias: MateriaPlan[],
  progreso: ProgresoMaterias,
): number {
  return materias.reduce((total, materia) => {
    const estado = getEstadoPersistido(progreso, materia.id);
    return estado === "aprobada" ? total + materia.creditos : total;
  }, 0);
}

export function getInterseccionMaterias(
  materias: MateriaPlan[],
  selectedMinors: MinorTag[],
): string[] {
  if (selectedMinors.length === 0) return [];

  return materias
    .filter((materia) =>
      selectedMinors.every((minor) => (materia.minorTags ?? []).includes(minor)),
    )
    .map((materia) => materia.id);
}

export function getMateriasMinor(materias: MateriaPlan[], minor: MinorTag): MateriaPlan[] {
  return materias.filter((materia) => (materia.minorTags ?? []).includes(minor));
}

export interface ProgresoMinor {
  minorTag: MinorTag;
  minorAprobado: number;
  objetivoMinor: number;
  gestionAprobado: number;
  objetivoGestion: number;
  tecnologiaAprobado: number;
  objetivoTecnologia: number;
  libresAprobado: number;
  objetivoLibres: number;
}

export function calcularProgresoMinor(
  materias: MateriaPlan[],
  progreso: ProgresoMaterias,
  minor: MinorTag,
): ProgresoMinor {
  const electivasActivas = materias.filter(
    (materia) =>
      (materia.grupo === "electiva-gestion" || materia.grupo === "electiva-sistemas-tecnologia") &&
      materia.estadoOferta !== "inactiva",
  );

  const materiasDelMinor = electivasActivas.filter((materia) =>
    (materia.minorTags ?? []).includes(minor),
  );

  const minorAprobado = materiasDelMinor.reduce((acc, materia) => {
    return getEstadoPersistido(progreso, materia.id) === "aprobada" ? acc + materia.creditos : acc;
  }, 0);

  const gestionAprobado = materiasDelMinor
    .filter((materia) => materia.grupo === "electiva-gestion")
    .reduce((acc, materia) => {
      return getEstadoPersistido(progreso, materia.id) === "aprobada" ? acc + materia.creditos : acc;
    }, 0);

  const tecnologiaAprobado = materiasDelMinor
    .filter((materia) => materia.grupo === "electiva-sistemas-tecnologia")
    .reduce((acc, materia) => {
      return getEstadoPersistido(progreso, materia.id) === "aprobada" ? acc + materia.creditos : acc;
    }, 0);

  const libresAprobado = electivasActivas
    .filter((materia) => !(materia.minorTags ?? []).includes(minor))
    .reduce((acc, materia) => {
      return getEstadoPersistido(progreso, materia.id) === "aprobada" ? acc + materia.creditos : acc;
    }, 0);

  return {
    minorTag: minor,
    minorAprobado,
    objetivoMinor: 45,
    gestionAprobado,
    objetivoGestion: 27,
    tecnologiaAprobado,
    objetivoTecnologia: 30,
    libresAprobado,
    objetivoLibres: 12,
  };
}

export function calcularProgresoSlots8Cuat(
  materias: MateriaPlan[],
  progreso: ProgresoMaterias,
): Record<SlotElectiva8Cuat, { aprobado: number; objetivo: number }> {
  const sumByGrupo = (grupo: MateriaPlan["grupo"]) =>
    materias
      .filter((materia) => materia.grupo === grupo && materia.estadoOferta !== "inactiva")
      .reduce((acc, materia) => {
        return getEstadoPersistido(progreso, materia.id) === "aprobada"
          ? acc + materia.creditos
          : acc;
      }, 0);

  return {
    gestion: { aprobado: sumByGrupo("electiva-gestion"), objetivo: 27 },
    "proyecto-final": { aprobado: sumByGrupo("electiva-proyecto-final"), objetivo: 3 },
    "sistemas-tecnologia": {
      aprobado: sumByGrupo("electiva-sistemas-tecnologia"),
      objetivo: 30,
    },
  };
}
