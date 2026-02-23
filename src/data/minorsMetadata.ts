import type { EstadoOferta, MateriaPlan, MinorTag } from "@/types/plan";

export const MINOR_LABELS: Record<MinorTag, string> = {
  "finanzas-cripto": "Finanzas y Criptoeconomia",
  "tecnologia-datos": "Tecnologia y Datos",
  "innovacion-empresarial": "Innovacion Empresarial",
  "gestion-comercial": "Gestion Comercial",
};

export const MINOR_SIGLAS: Record<MinorTag, string> = {
  "finanzas-cripto": "FIN",
  "tecnologia-datos": "TEC",
  "innovacion-empresarial": "INN",
  "gestion-comercial": "COM",
};

export const MINOR_COLORES: Record<MinorTag, string> = {
  "finanzas-cripto": "#fbbf24",
  "tecnologia-datos": "#22d3ee",
  "innovacion-empresarial": "#c084fc",
  "gestion-comercial": "#fb7185",
};

const minorTagsPorMateria: Record<string, MinorTag[]> = {
  "81.14": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.26": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.46": ["finanzas-cripto", "tecnologia-datos"],
  "81.59": ["tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.67": ["tecnologia-datos"],
  "94.19": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.86": ["tecnologia-datos", "innovacion-empresarial"],
  "23.15": ["tecnologia-datos"],
  "71.22": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "71.45": ["tecnologia-datos"],
  "72.74": ["finanzas-cripto", "tecnologia-datos", "gestion-comercial"],
  "72.80": ["tecnologia-datos"],
  "73.84": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.19": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.23": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.28": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial"],
  "81.33": ["tecnologia-datos", "innovacion-empresarial"],
  "81.54": ["tecnologia-datos"],
  "81.84": ["finanzas-cripto", "tecnologia-datos", "gestion-comercial"],
  "81.85": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "82.07": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "82.08": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "82.21": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial"],
  "82.22": ["tecnologia-datos"],
  "81.76": ["finanzas-cripto", "tecnologia-datos"],
  "81.77": ["tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.91": ["tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "82.23": ["tecnologia-datos", "gestion-comercial"],
  "61.04": ["finanzas-cripto"],
  "61.05": ["finanzas-cripto"],
  "61.08": ["finanzas-cripto"],
  "61.14": ["finanzas-cripto"],
  "61.15": ["finanzas-cripto"],
  "61.30": ["finanzas-cripto"],
  "61.93": ["finanzas-cripto", "innovacion-empresarial", "gestion-comercial"],
  "81.04": ["finanzas-cripto", "gestion-comercial"],
  "81.16": ["finanzas-cripto", "gestion-comercial"],
  "10.09": ["innovacion-empresarial"],
  "11.84": ["innovacion-empresarial", "gestion-comercial"],
  "14.97": ["innovacion-empresarial"],
  "15.09": ["innovacion-empresarial"],
  "61.11": ["innovacion-empresarial"],
  "61.13": ["innovacion-empresarial"],
  "81.05": ["innovacion-empresarial"],
  "81.24": ["innovacion-empresarial", "gestion-comercial"],
  "81.49": ["innovacion-empresarial", "gestion-comercial"],
  "81.65": ["innovacion-empresarial"],
  "94.62": ["innovacion-empresarial", "gestion-comercial"],
  "10.07": ["gestion-comercial"],
  "15.06": ["gestion-comercial"],
  "81.18": ["gestion-comercial"],
  "81.71": ["gestion-comercial"],
  "94.42": ["gestion-comercial"],
  "61.07": ["finanzas-cripto"],
  "61.34": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial"],
  "81.17": ["finanzas-cripto"],
  "82.06": ["tecnologia-datos"],
  "94.15": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.58": ["tecnologia-datos", "innovacion-empresarial"],
  "81.82": ["finanzas-cripto", "tecnologia-datos"],
};

const materiasActivas = new Set([
  "81.14",
  "81.26",
  "81.46",
  "81.59",
  "81.67",
  "94.19",
  "81.86",
  "23.15",
  "71.22",
  "71.45",
  "72.74",
  "72.80",
  "73.84",
  "81.19",
  "81.23",
  "81.28",
  "81.33",
  "81.54",
  "81.84",
  "81.85",
  "82.07",
  "82.08",
  "82.21",
  "82.22",
  "81.76",
  "81.77",
  "81.91",
  "82.23",
]);

function getEstadoOferta(materia: MateriaPlan): EstadoOferta {
  if (materia.grupo === "electiva-gestion" || materia.grupo === "electiva-sistemas-tecnologia") {
    return materiasActivas.has(materia.id) ? "activa" : "inactiva";
  }
  return "activa";
}

export function enriquecerMateriasConMinors(materias: MateriaPlan[]): MateriaPlan[] {
  return materias.map((materia) => ({
    ...materia,
    minorTags: minorTagsPorMateria[materia.id] ?? [],
    estadoOferta: getEstadoOferta(materia),
  }));
}
