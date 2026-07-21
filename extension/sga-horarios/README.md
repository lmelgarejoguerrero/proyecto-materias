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
4. Una única vez, pulsar **Vincular archivo de la app** y elegir `src/data/sgaHorarios.json`.
5. Los recorridos siguientes actualizan ese archivo automáticamente. **Descargar copia JSON** queda como respaldo opcional.

La versión 1.1.0 inyecta automáticamente el lector si la pestaña del SGA ya estaba abierta y puede escribir el snapshot directamente en la app, sin terminal ni `npm`.
