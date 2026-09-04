import type {
  EstadoMateria,
  EstadoVisualMateria,
  MateriaPlan,
  MapaHabilitadas,
  MinorTag,
  ProgresoMaterias,
  SlotElectiva8Cuat,
  TipoCorrelativa,
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
  const estado = Object.prototype.hasOwnProperty.call(progreso, materiaId)
    ? progreso[materiaId]
    : undefined;
  return esEstadoMateria(estado) ? estado : "pendiente";
}

export function esEstadoMateria(value: unknown): value is EstadoMateria {
  return value === "pendiente" || value === "cursando" || value === "regular" || value === "aprobada";
}

export function normalizarProgreso(
  value: unknown,
  idsValidos?: ReadonlySet<string>,
): ProgresoMaterias {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([id, estado]) =>
      id.length > 0 &&
      !["__proto__", "constructor", "prototype"].includes(id) &&
      (!idsValidos || idsValidos.has(id)) &&
      esEstadoMateria(estado) && estado !== "pendiente",
    ),
  );
}

export function parsearProgreso(raw: string | null): ProgresoMaterias {
  if (!raw) return {};
  try {
    return normalizarProgreso(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function cumpleCorrelativa(estado: EstadoMateria, tipo: TipoCorrelativa): boolean {
  return estado === "aprobada" || (tipo === "cursada" && estado === "regular");
}

export function cumpleRequisitos(
  materia: MateriaPlan,
  progreso: ProgresoMaterias,
  creditosAprobados: number,
): boolean {
  return creditosAprobados >= materia.creditosRequeridos && materia.correlativas.every(
    (id) => cumpleCorrelativa(getEstadoPersistido(progreso, id), materia.tipoCorrelativa),
  );
}

export function calcularDisponibilidad(materias: MateriaPlan[], progreso: ProgresoMaterias) {
  const creditosAprobados = sumarCreditosAprobados(materias, progreso);
  const proyeccion = Object.fromEntries(
    Object.entries(progreso).map(([id, estado]) => [id, estado === "cursando" ? "regular" : estado]),
  ) as ProgresoMaterias;
  const materiasHabilitadas: MapaHabilitadas = {};
  const materiasPreview: Record<string, boolean> = {};
  const estadoVisualPorMateria: Record<string, EstadoVisualMateria> = {};

  for (const materia of materias) {
    const estado = getEstadoPersistido(progreso, materia.id);
    const habilitada = estado !== "aprobada" && cumpleRequisitos(materia, progreso, creditosAprobados);
    materiasHabilitadas[materia.id] = habilitada;
    const preview = estado === "pendiente" && !habilitada && cumpleRequisitos(materia, proyeccion, creditosAprobados);
    if (preview) materiasPreview[materia.id] = true;
    estadoVisualPorMateria[materia.id] = estado !== "pendiente"
      ? estado
      : habilitada ? "puedo_cursar" : preview ? "habilitable_preview" : "pendiente";
  }

  return { creditosAprobados, materiasHabilitadas, materiasPreview, estadoVisualPorMateria };
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

/** Créditos que aportan al título; el excedente de una categoría no cubre otra. */
export function calcularCreditosTitulo(
  materias: MateriaPlan[],
  progreso: ProgresoMaterias,
): number {
  const obligatorias = materias.filter((materia) => materia.grupo === "obligatoria");
  const slots = calcularProgresoSlots8Cuat(materias, progreso);
  return sumarCreditosAprobados(obligatorias, progreso) + Object.values(slots).reduce(
    (total, slot) => total + Math.min(slot.aprobado, slot.objetivo),
    0,
  );
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
      materia.grupo === "electiva-gestion" || materia.grupo === "electiva-sistemas-tecnologia",
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
      .filter((materia) => materia.grupo === grupo)
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
