export type EstadoMateria = "pendiente" | "cursando" | "regular" | "aprobada";

export type EstadoVisualMateria = EstadoMateria | "puedo_cursar" | "habilitable_preview";

export type TipoCorrelativa = "cursada" | "final";
export type EstadoOferta = "activa" | "inactiva";

export type MinorTag =
  | "finanzas-cripto"
  | "tecnologia-datos"
  | "innovacion-empresarial"
  | "gestion-comercial";

export type GrupoMateria =
  | "obligatoria"
  | "electiva-gestion"
  | "electiva-sistemas-tecnologia"
  | "electiva-proyecto-final"
  | "skills-complementarias";

export interface MateriaPlan {
  id: string;
  nombre: string;
  cuatrimestre: number;
  creditos: number;
  creditosRequeridos: number;
  correlativas: string[];
  tipoCorrelativa: TipoCorrelativa;
  grupo: GrupoMateria;
  minorTags?: MinorTag[];
  estadoOferta?: EstadoOferta;
}

export interface PlanDeEstudio {
  plan: string;
  creditosTitulo: number;
  materias: MateriaPlan[];
}

export type ProgresoMaterias = Record<string, EstadoMateria>;

export type MapaHabilitadas = Record<string, boolean>;

export type SlotElectiva8Cuat = "gestion" | "proyecto-final" | "sistemas-tecnologia";
