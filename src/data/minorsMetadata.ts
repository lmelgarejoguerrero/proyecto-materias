import type { EstadoOferta, MateriaPlan, MinorTag } from "@/types/plan";

export const MINOR_OPTIONS = [
  "finanzas-cripto",
  "tecnologia-datos",
  "innovacion-empresarial",
  "gestion-comercial",
] as const satisfies readonly MinorTag[];

export const MINOR_LABELS: Record<MinorTag, string> = {
  "finanzas-cripto": "Finanzas y Criptoeconomía",
  "tecnologia-datos": "Tecnología y Datos",
  "innovacion-empresarial": "Innovación Empresarial",
  "gestion-comercial": "Gestión Comercial",
};

export const MINOR_DESCRIPTIONS: Record<MinorTag, string> = {
  "finanzas-cripto": "Finanzas, mercados, estrategia financiera y tecnologías aplicadas.",
  "tecnologia-datos": "Datos, sistemas, inteligencia artificial y productos digitales.",
  "innovacion-empresarial": "Producto, emprendimiento, innovación y transformación organizacional.",
  "gestion-comercial": "Marketing, experiencia, ventas y desarrollo de negocios.",
};

export const MINOR_SIGLAS: Record<MinorTag, string> = {
  "finanzas-cripto": "FIN",
  "tecnologia-datos": "TEC",
  "innovacion-empresarial": "INN",
  "gestion-comercial": "COM",
};

export const MINOR_COLORES: Record<MinorTag, string> = {
  "finanzas-cripto": "#b7791f",
  "tecnologia-datos": "#1677a8",
  "innovacion-empresarial": "#7c5ac7",
  "gestion-comercial": "#c45472",
};

// Fuente: “2026.07 - LN Minors vigentes.xlsx”, hoja Materias Activas.
// Se mantienen también las asociaciones históricas de la hoja Inactivas para
// que el progreso de usuarios existentes no pierda contexto.
const minorTagsPorMateria: Record<string, MinorTag[]> = {
  "23.15": ["tecnologia-datos"],
  "10.07": ["gestion-comercial"],
  "10.09": ["innovacion-empresarial"],
  "11.84": ["innovacion-empresarial", "gestion-comercial"],
  "14.97": ["innovacion-empresarial"],
  "15.06": ["gestion-comercial"],
  "15.09": ["innovacion-empresarial"],
  "61.02": ["finanzas-cripto"],
  "61.04": ["finanzas-cripto"],
  "61.05": ["finanzas-cripto"],
  "61.08": ["finanzas-cripto"],
  "61.11": ["innovacion-empresarial"],
  "61.13": ["innovacion-empresarial"],
  "61.14": ["finanzas-cripto"],
  "61.15": ["finanzas-cripto"],
  "61.30": ["finanzas-cripto"],
  "61.93": ["finanzas-cripto", "innovacion-empresarial", "gestion-comercial"],
  "71.22": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "71.45": ["tecnologia-datos"],
  "72.74": ["finanzas-cripto", "tecnologia-datos", "gestion-comercial"],
  "72.80": ["tecnologia-datos"],
  "73.84": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.04": ["finanzas-cripto", "gestion-comercial"],
  "81.05": ["innovacion-empresarial"],
  "81.14": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.16": ["finanzas-cripto", "gestion-comercial"],
  "81.18": ["gestion-comercial"],
  "81.19": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.23": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.24": ["innovacion-empresarial", "gestion-comercial"],
  "81.26": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.28": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial"],
  "81.33": ["tecnologia-datos", "innovacion-empresarial"],
  "81.46": ["finanzas-cripto", "tecnologia-datos"],
  "81.49": ["innovacion-empresarial", "gestion-comercial"],
  "81.54": ["tecnologia-datos"],
  "81.59": ["tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.65": ["innovacion-empresarial"],
  "81.67": ["tecnologia-datos"],
  "81.71": ["gestion-comercial"],
  "81.76": ["finanzas-cripto", "tecnologia-datos"],
  "81.84": ["finanzas-cripto", "tecnologia-datos", "gestion-comercial"],
  "81.85": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "81.86": ["tecnologia-datos", "innovacion-empresarial"],
  "81.91": ["tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "82.07": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "82.08": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "82.21": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial"],
  "82.22": ["tecnologia-datos"],
  "82.23": ["tecnologia-datos", "gestion-comercial"],
  "82.24": ["innovacion-empresarial", "gestion-comercial"],
  "94.19": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "94.42": ["gestion-comercial"],
  "94.62": ["innovacion-empresarial", "gestion-comercial"],
  "94.77": ["innovacion-empresarial", "gestion-comercial"],
  "94.78": ["finanzas-cripto", "innovacion-empresarial"],

  // Asociaciones históricas conservadas desde la hoja Inactivas.
  "61.07": ["finanzas-cripto"],
  "61.34": ["finanzas-cripto", "innovacion-empresarial", "gestion-comercial"],
  "81.17": ["finanzas-cripto"],
  "81.58": ["tecnologia-datos", "innovacion-empresarial"],
  "81.82": ["innovacion-empresarial", "gestion-comercial"],
  "81.83": ["tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
  "82.06": ["tecnologia-datos"],
  "94.15": ["finanzas-cripto", "tecnologia-datos", "innovacion-empresarial", "gestion-comercial"],
};

export const MATERIAS_ACTIVAS_JULIO_2026 = new Set([
  "10.07", "10.09", "10.15", "10.23", "11.84", "14.24", "14.97", "15.06", "15.09",
  "17.22", "17.23", "61.02", "61.04", "61.05", "61.08", "61.11", "61.13", "61.14",
  "61.15", "61.30", "61.92", "61.93", "81.04", "81.05", "81.14", "81.16", "81.18",
  "81.24", "81.26", "81.46", "81.49", "81.51", "81.59", "81.65", "81.67", "81.71",
  "81.86", "82.24", "94.09", "94.11", "94.13", "94.19", "94.42", "94.62", "94.78",
  "23.15", "71.22", "71.45", "72.74", "72.80", "73.84", "81.19", "81.23", "81.28",
  "81.33", "81.54", "81.72", "81.73", "81.74", "81.75", "81.76", "81.84", "81.85",
  "81.91", "82.07", "82.08", "82.21", "82.22", "82.23", "94.77",
]);

function getEstadoOferta(materia: MateriaPlan): EstadoOferta {
  if (materia.grupo === "electiva-gestion" || materia.grupo === "electiva-sistemas-tecnologia") {
    return MATERIAS_ACTIVAS_JULIO_2026.has(materia.id) ? "activa" : "inactiva";
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
