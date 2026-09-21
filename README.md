# Multiplan — Planeador Multigrado IA

Aplicación para construir planeaciones de primaria alineadas con la Nueva Escuela Mexicana, usando PDA oficiales y proyectos de los Libros de Texto Gratuitos (LTG) verificados en Supabase.

## Estado actual

- Interfaz/Router: **V0.8.9** en Railway.
- Planeaciones de **un grado**: **V6.4-DIDACTIC-EXECUTION-BETA.2**.
- Planeaciones de **2 a 6 grados**: **V6.4-MULTIGRADE-DIDACTIC-BETA.2**.
- Respaldo multigrado estable: **PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE**.
- Respaldos inferiores para un grado: **V6.3-PROJECT-ACTION-CONTINUITY-BETA.4** y **V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA**.
- Autenticación: Supabase Auth.
- Corpus curricular: **1,333 PDA oficiales**.
- Proyectos LTG: **427/427**.
- Actividades LTG verificadas y enriquecidas: **2,364/2,364**.
- Vínculos proyecto ↔ PDA: **1,418**.

## V6.4 Didactic Execution

V6.4 exige actividades ejecutables: qué hará el docente, qué harán los alumnos, 3–6 pasos, minutos por paso, consignas, resultados esperados, comprobaciones, apoyos, transición, evidencia y aporte al producto.

## V6.4 Multigrade Didactic Beta.2

V6.4-MG se construye **encima de V6.2.1 estable**. V6.2.1 genera y valida primero la estructura: sesiones, tiempos, PDA, atención directa, trabajo simultáneo y trazabilidad LTG. Esa estructura se trata como inmutable.

La primera Beta multigrado intentaba enriquecer toda la planeación de seis grados en una sola respuesta de Gemini. En una ejecución real superó el timeout del router y cayó correctamente a V6.2.1. Beta.2 corrige esto con la estrategia:

**`SESSION-WISE-PARALLEL-ENRICHMENT`**

Flujo:

1. V6.2.1 produce una planeación estructural aprobada.
2. V6.4-MG crea inmediatamente un registro diagnóstico en `plan_runs`.
3. Cada sesión se envía a Gemini como una unidad pequeña e independiente.
4. Las sesiones se enriquecen en paralelo.
5. Si una sesión queda incompleta, sólo esa sesión tiene un intento de corrección.
6. Se reconstruye la planeación sin modificar minutos, PDA, grados, bloques o referencias LTG.
7. Un validador final comprueba toda la estructura.
8. Si V6.4-MG falla, el router conserva el fallback automático a V6.2.1 estable.

### Reglas multigrado

- un solo docente real por momento;
- máximo 2 grados bajo atención directa cuando hay 3 o más grados;
- todos los demás grados tienen trabajo simultáneo explícito;
- los grados, PDA, LTG, `activity_order` y minutos definidos por V6.2.1 no pueden cambiar;
- el bloque atendido recibe procedimiento docente de 3–6 pasos;
- cada bloque autónomo recibe instrucciones previas, procedimiento de 3–6 pasos, materiales, autocontrol, estrategia si se atoran y evidencia;
- todos los procedimientos de un momento duran exactamente los mismos minutos porque ocurren simultáneamente;
- en alfabetización inicial pueden usarse oralidad, dibujo, pictogramas, dictado, modelos y manipulables;
- los grados mayores incrementan análisis, cálculo, registro, argumentación, diseño y producción;
- sin internet, ninguna actividad puede depender de recursos en línea.

V6.4-MG produce también `multigrade_project`: problema común, pregunta guía, producto colectivo y contribución diferenciada por grado.

## Interfaz multigrado

La vista distingue:

- **CON EL DOCENTE** — procedimiento paso a paso del bloque atendido;
- **TRABAJO AUTÓNOMO** — qué hacen simultáneamente los demás grados;
- **Procedimiento autónomo** — pasos, materiales, autocontrol, qué hacer si se atoran y resultado esperado.

El renderer fue introducido en V0.8.8 y permanece debajo de V0.8.9.

## Seguridad

Las funciones productivas validan una sesión real de Supabase Auth. Una petición con token inválido devuelve `401` antes de consumir modelo.

No se modificaron PDA oficiales, tablas curriculares, corpus LTG, usuarios ni las fases específicas completas de las metodologías.

## Producción y rollback

Railway ejecuta:

`node server-v089-multigrade-didactic.mjs`

Cadena de protección:

1. **V6.4 Multigrade Didactic Beta.2** — 2 a 6 grados, enriquecimiento por sesión.
2. **V6.2.1 Stable** — fallback automático multigrado ante error de calidad, servidor, red o timeout.
3. Para un grado: **V6.4 Didactic Execution → V6.3 Project Action → Project Core v1 → V6.2.1**.

V0.8.9 ejecuta V0.8.8 como proceso hijo con su intento multigrado desactivado, evitando doble enriquecimiento. Los entrypoints previos permanecen intactos:

- `server-v088-multigrade-didactic.mjs`
- `server-v086-didactic.mjs`
- `server-v086-projectaction.mjs`
- `server-v086-projectcore.mjs`
- `server-v086.mjs`

Rollback:

- cambiar el start command a `node server-v088-multigrade-didactic.mjs` para volver a la revisión anterior;
- `MULTIPLAN_V64_MG_ENABLED=false` para saltar la capa V6.4-MG del router activo;
- `node server-v086-didactic.mjs` para volver al stack V6.4 unigrado + V6.2.1 multigrado;
- `node server-v086.mjs` para rollback completo al V6.2.1 estable.

`/health` informa la versión activa, estrategia multigrado y fallbacks.

## Nota de desarrollo

No agregar `service_role` ni secretos de Gemini al navegador o al repositorio. Las claves privadas permanecen en Supabase/Railway.
