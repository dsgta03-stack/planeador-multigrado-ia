# Multiplan — Planeador Multigrado IA

Aplicación para construir planeaciones de primaria alineadas con la Nueva Escuela Mexicana, usando PDA oficiales y proyectos de los Libros de Texto Gratuitos (LTG) verificados en Supabase.

## Estado actual

- Interfaz: **V0.8.7** en Railway.
- Planeaciones de **un grado**: **V6.4-DIDACTIC-EXECUTION-BETA.2**.
- Primer respaldo: **V6.3-PROJECT-ACTION-CONTINUITY-BETA.4**.
- Segundo respaldo: **V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA**.
- Planeaciones de **2 o más grados**: **PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE**.
- Autenticación: Supabase Auth.
- Corpus curricular: **1,333 PDA oficiales**.
- Proyectos LTG: **427/427**.
- Actividades LTG verificadas y enriquecidas: **2,364/2,364**.
- Vínculos proyecto ↔ PDA: **1,418**.

## V6.4 Didactic Execution

V6.4 conserva Project Core y los cinco controles de V6.3, pero corrige una debilidad importante: una actividad ya no puede limitarse a expresiones como “guiar la lectura”, “acompañar la elaboración”, “coordinar el registro” o “hacer un cartel”.

Cada momento debe explicar de forma ejecutable:

- qué hará el docente;
- qué harán los alumnos;
- qué acción de aprendizaje del PDA se desarrolla;
- de 3 a 6 pasos de procedimiento;
- minutos por paso;
- consigna o pregunta docente casi literal;
- resultado esperado;
- qué comprobar antes de avanzar;
- apoyo si algún alumno no puede continuar;
- transición hacia el siguiente avance;
- evidencia y contribución al producto.

La suma de los pasos debe coincidir con los minutos del momento. Los bloques de 60 minutos o más son auditados para evitar procedimientos excesivamente resumidos.

La interfaz V0.8.7 muestra un nuevo bloque **“Desarrollo didáctico paso a paso · V6.4”**. La vista resumida anterior queda disponible como respaldo visual.

## Flujo pedagógico

`problema/reto/necesidad/interés → PDA → comparación de proyectos LTG → LTG base / LTG adaptado / proyecto propio → acciones de aprendizaje → actividades ejecutables → productos parciales → sesiones dependientes → producto final`

Los nombres oficiales de momentos o actividades LTG se conservan en la trazabilidad (`ltg_use` y referencias LTG), pero una capa determinística evita utilizarlos como estructura narrativa de la planeación.

## Validaciones V6.4

V6.4 mantiene los cinco controles de V6.3:

1. actividad específica;
2. alineación PDA → acción de aprendizaje;
3. evidencia observable;
4. progresión del producto;
5. dependencia entre sesiones.

Y añade **Executable Procedure**, que exige un procedimiento suficientemente desarrollado para que otro docente pueda aplicar la actividad sin inventar los pasos faltantes.

## Prueba de referencia

Se probó el proyecto de 2.º **“Agua que no has de beber… ¡No la dejes correr!”** con 3 y 5 sesiones de 90 minutos.

La salida pasó de una instrucción general como “guiar la lectura de las páginas 116–118” a una secuencia que especifica lectura modelada, preguntas, recorrido por la escuela, observación de llaves y sanitarios, registro gráfico, comprobaciones, medición con botellas, construcción progresiva de propuestas y elaboración/difusión del producto.

Las pruebas V6.4 fueron aprobadas con `executable_procedure=true`, `pda_action_alignment=true`, `observable_evidence=true`, `product_progression=true` y `session_dependency=true`.

## Alcance protegido

V6.4 sólo gobierna solicitudes con **exactamente un grado**.

Las solicitudes de dos o más grados continúan directamente en **V6.2.1**, ya que todavía no se implementa la nueva lógica didáctica dentro del motor multigrado.

V6.4 no modifica:

- PDA oficiales;
- tablas curriculares;
- corpus LTG;
- usuarios;
- materiales avanzados;
- metodologías específicas completas;
- motor multigrado estable.

## Seguridad

`plan-support-didactic-execution-v1` y `plan-support-didactic-execution-v2` requieren una sesión real antes de generar. Sin token responden `401 AUTH_REQUIRED`.

El arnés temporal `didactic-v64-test-harness` fue neutralizado después de las pruebas y responde `410 DEPRECATED_INTERNAL_BETA`.

## Producción y rollback

Railway ejecuta:

`node server-v086-didactic.mjs`

Cadena de protección:

1. **V6.4 Didactic Execution** — un grado.
2. **V6.3 Project Action** — fallback automático si V6.4 devuelve error de calidad (`422`) o error de servidor/red.
3. **Project Core v1** — fallback inferior de V6.3.
4. **V6.2.1 Stable** — motor multigrado y respaldo estable.

Los entrypoints anteriores permanecen intactos:

- `server-v086-projectaction.mjs`
- `server-v086-projectcore.mjs`
- `server-v086.mjs`

Rollback posible:

- `MULTIPLAN_V64_ENABLED=false` → vuelve a V6.3 para un grado;
- start command `node server-v086-projectaction.mjs` → elimina la capa V6.4;
- start command `node server-v086-projectcore.mjs` → vuelve a Project Core;
- start command `node server-v086.mjs` → rollback completo a V6.2.1.

`/health` informa de forma explícita V6.4, V6.3, Project Core y V6.2.1.

## Nota de desarrollo

No agregar `service_role` ni secretos de Gemini al navegador o al repositorio. Las claves privadas permanecen en Supabase/Railway.
