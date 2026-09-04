# Mi carrera · Plan L20

Tablero personal para organizar la Licenciatura en Gestión de Negocios: materias, correlativas, minors y horarios. Construido con Next.js 16, React 19, TypeScript y Tailwind CSS 4.

## Qué permite hacer

- **Mi avance:** consultar las 150 materias del catálogo, buscar con o sin tildes, filtrar por estado y alternar tarjetas/lista. El detalle permite cambiar estados, deshacer y navegar por las correlativas.
- **Mis electivas:** comparar cuatro minors, conservar la selección al cambiar de línea y ver créditos aprobados, planificados, faltantes y excedentes. La selección sigue visible aunque una materia esté inactiva.
- **Planificador:** organizar cuatrimestres actuales, futuros e históricos; proyectar requisitos; elegir comisiones; detectar cruces y consultar la semana o una agenda apta para teléfonos.
- **Mis datos:** descargar y restaurar copias JSON. La importación valida todos los apartados antes de escribir y ofrece un resumen para confirmar.
- Tema claro/oscuro, navegación por teclado y diálogos con foco contenido y cierre con Escape.

## Desarrollo local

Requiere Node.js 20.9 o superior y npm.

```sh
npm ci
npm run dev
```

Abrí http://localhost:3000. El catálogo y el seguimiento de progreso no necesitan credenciales. Los horarios consultan CEITBA y cuentan con una copia SGA incluida en `src/data/sgaHorarios.json`.

```sh
npm run check       # ESLint, TypeScript y pruebas de regresión
npm run build       # Compilación de producción
npm start           # Ejecutar la compilación
```

`next/font` descarga Geist durante la compilación, por lo que el build requiere acceso a Google Fonts.

## Progreso y reglas

Los estados son `pendiente`, `cursando`, `regular` y `aprobada`. Una correlativa de tipo `cursada` admite regular o aprobada; una de tipo `final` requiere aprobada. Los mínimos de créditos consideran materias aprobadas.

El porcentaje del título respeta la distribución del plan: 132 créditos obligatorios, 27 de Gestión, 30 de Tecnología y 3 de proyecto final. Los créditos excedentes en una categoría no compensan otra. Alcanzar el total de créditos no valida automáticamente requisitos de cero créditos ni la graduación.

El estado de próxima habilitación supone regularizar las materias en curso. La proyección del planificador supone aprobar las materias previstas en cuatrimestres anteriores, siempre que sus propios requisitos se cumplan. Las materias del mismo cuatrimestre no se habilitan entre sí.

El minor combina 45 créditos de la línea y 12 libres. Dentro de esos mismos 57 créditos se requieren 27 de Gestión y 30 de Tecnología; no son cuatro totales que se suman.

## Guardado y copias

Los datos se guardan en `localStorage` de este navegador y este origen. No hay cuenta ni sincronización automática entre dispositivos. El progreso de materias se actualiza entre pestañas del mismo origen.

Desde **Mis datos → Descargar copia** se exportan estados, minor, electivas y planificación con comisiones. Para llevarlos a otro dispositivo, usá **Restaurar copia**. Se admiten los formatos históricos `storage`, `storageDump` y `appState`, con versiones 1 a 3 y un máximo de 1 MB.

Si el navegador bloquea el guardado, la interfaz lo informa. El progreso de materias puede exportarse desde memoria aunque el almacenamiento no esté disponible; esa copia parcial se identifica en el aviso. La elección de minor y la planificación sin guardar deben conservarse antes de salir de sus vistas.

## Horarios del SGA

Para actualizar la copia incluida:

```sh
npm run import:sga -- /ruta/al/archivo-exportado.json
```

La extensión que obtiene los horarios está documentada en [extension/sga-horarios/README.md](extension/sga-horarios/README.md).

La publicación remota de horarios es opcional. Requiere configurar en el servidor `SGA_IMPORT_TOKEN` y las credenciales de Vercel Blob (`BLOB_READ_WRITE_TOKEN` o la configuración OIDC del proyecto). Nunca deben exponerse con prefijo `NEXT_PUBLIC_` ni incluirse en el repositorio. La extensión publica en `POST /api/horarios/sga` usando autorización Bearer.

Los horarios sincrónicos virtuales participan en la detección de cruces. Las actividades explícitamente asincrónicas se muestran por separado. La oferta de otro período se etiqueta como referencia; confirmá disponibilidad y cupos en el SGA antes de inscribirte.

## Estructura

- `src/components/`: tablero, minors, planificador y detalle de materia.
- `src/hooks/useProgreso.ts`: integración del progreso con React.
- `src/lib/`: reglas académicas, persistencia, backups y transformación de horarios.
- `src/data/`: plan, metadatos de minors y snapshot SGA.
- `src/app/api/horarios/`: consulta y actualización de horarios.
- `tests/`: pruebas de reglas, persistencia, restauración y planificación.
- `extension/sga-horarios/`: extensión y pruebas de su parser.

Las pruebas transpilan los módulos TypeScript en memoria utilizando la dependencia existente; no requieren navegador, base de datos ni credenciales.
