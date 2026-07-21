# ITBA SGA · Exportador de horarios

Extensión local Manifest V3 para Brave y Chrome. Recorre secuencialmente las materias que aparecen en **Materias de grado disponibles**, abre cada detalle, extrae comisiones, horarios, aulas y cupos, vuelve mediante **Cancelar** y genera un JSON local.

## Seguridad

- Sólo se ejecuta en `https://sga.itba.edu.ar/app2/*`.
- No lee ni almacena usuario, contraseña, cookies, URLs de sesión ni docentes.
- No selecciona radios y nunca pulsa **Confirmar**.
- Ejecuta un único recorrido visible y secuencial.

## Uso

1. Abrir la pantalla de matriculación del SGA.
2. Abrir la extensión y pulsar **Actualizar desde el SGA**.
3. Mantener abierta la pestaña mientras recorre las materias.
4. Una única vez, pegar la clave privada de publicación y guardarla en la extensión.
5. Al terminar, la extensión publica el snapshot en el almacenamiento persistente de la web y abre el planificador.
6. **Descargar copia JSON** queda como respaldo opcional.

La versión 1.2.0 inyecta automáticamente el lector si la pestaña del SGA ya estaba abierta y publica el snapshot en Vercel Blob, sin selector de archivos, `localStorage`, terminal, `npm`, commit ni push.
