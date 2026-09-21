# Multiplan — Planeador Multigrado IA

Aplicación para construir planeaciones de primaria alineadas con la Nueva Escuela Mexicana, usando PDA oficiales y proyectos de los Libros de Texto Gratuitos (LTG) verificados en Supabase.

## Estado actual

- Interfaz/Router productivo: **V0.9.5** en Railway.
- Planeaciones de **un grado**: **V6.4-DIDACTIC-EXECUTION-BETA.2**.
- Planeaciones de **2 a 6 grados**: **V6.4-MULTIGRADE-DIDACTIC-BETA.4**.
- Shadow metodológico no gobernante: **V6.5-METHODOLOGY-ENGINE-BETA.3**.
- Respaldo multigrado: **V0.9.1 → V6.4-MG Beta.3 → Beta.2 → PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE**.
- Respaldos inferiores para un grado: **V6.3-PROJECT-ACTION-CONTINUITY-BETA.4** y **V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA**.
- Autenticación: Supabase Auth.
- Corpus curricular: **1,333 PDA oficiales**.
- Proyectos LTG: **427/427**.
- Actividades LTG verificadas y enriquecidas: **2,364/2,364**.
- Vínculos proyecto ↔ PDA: **1,418**.

## V6.4 Didactic Execution

V6.4 exige actividades ejecutables: qué hará el docente, qué harán los alumnos, 3–6 pasos, minutos por paso, consignas, resultados esperados, comprobaciones, apoyos, transición, evidencia y aporte al producto.

## V6.4 Multigrade Didactic Beta.4

V6.4-MG se construye **encima de V6.2.1 estable**. V6.2.1 genera y valida primero la estructura: sesiones, tiempos, PDA, atención directa, trabajo simultáneo y trazabilidad LTG. Esa estructura se trata como inmutable.

La estrategia multigrado conserva el enriquecimiento por sesión y los fallbacks previos. Beta.4 añade un reintento específico cuando Gemini devuelve JSON inválido, sin relajar la validación curricular.

### Reglas multigrado

- un solo docente real por momento;
- máximo 2 grados bajo atención directa cuando hay 3 o más grados;
- todos los demás grados tienen trabajo simultáneo explícito;
- grados, PDA, LTG, `activity_order` y minutos definidos por V6.2.1 no pueden cambiar;
- el bloque atendido recibe procedimiento docente detallado;
- cada bloque autónomo recibe instrucciones previas, procedimiento, materiales, autocontrol, estrategia si se atoran y evidencia;
- todos los procedimientos de un momento duran exactamente los mismos minutos porque ocurren simultáneamente;
- en alfabetización inicial pueden usarse oralidad, dibujo, pictogramas, dictado, modelos y manipulables;
- los grados mayores incrementan análisis, cálculo, registro, argumentación, diseño y producción.

## V6.5 Methodology Engine Beta.3 — shadow

V6.5 Beta.3 **no gobierna producción**. Recibe una copia autenticada del plan V6.4 ya aprobado y genera una versión metodológicamente transformada sólo para comparación interna.

Objetivos de Beta.3:

1. convertir los productos existentes de los grados en **componentes necesarios de un solo proyecto/producto/servicio común**;
2. exigir una cadena de progresión donde la salida de una sesión alimente a la siguiente;
3. transformar realmente `student_action`, `teacher_action`, evidencias y aportes al proyecto, en vez de limitarse a explicar la metodología;
4. preservar como inmutables PDA, LTG, páginas, `activity_order`, tiempos, grados, rotaciones y número de sesiones;
5. medir la tasa real de transformación y rechazar overlays demasiado parecidos a V6.4.

El validador Beta.3 evalúa ocho dimensiones (máximo 16 puntos): coherencia del proyecto, producto progresivo, coherencia metodológica, transformación de acciones, alineación PDA, coherencia LTG, continuidad y viabilidad. El umbral de aprobación shadow es **15/16**.

### Aislamiento del shadow

V0.9.5 desactiva los shadows V6.5 Beta.2 de las capas inferiores. Para cada plan V6.4 exitoso sólo corre **un shadow metodológico: Beta.3 en la capa superior**.

## Interfaz multigrado

La vista productiva sigue mostrando V6.4 y distingue:

- **CON EL DOCENTE** — procedimiento paso a paso del bloque atendido;
- **TRABAJO AUTÓNOMO** — qué hacen simultáneamente los demás grados;
- **Procedimiento autónomo** — pasos, materiales, autocontrol, qué hacer si se atoran y resultado esperado.

V6.5 Beta.3 permanece invisible al usuario durante la fase shadow.

## Seguridad

Las funciones productivas y los shadows validan una sesión real de Supabase Auth. Una petición sin sesión o con token inválido devuelve `401` antes de consumir modelo.

No se modificaron PDA oficiales, tablas curriculares, corpus LTG ni usuarios.

## Producción y rollback

Railway ejecuta:

`node server-v095-v65beta3-clean-shadow.mjs`

Cadena productiva:

1. **V6.4 Multigrade Didactic Beta.4** — gobierna 2 a 6 grados.
2. **V6.5 Methodology Beta.3** — shadow no gobernante sobre planes V6.4 aprobados.
3. **V0.9.1 → Beta.3 → Beta.2 → V6.2.1** — fallback multigrado.
4. Para un grado: **V6.4 Didactic Execution → V6.3 Project Action → Project Core v1 → V6.2.1**.

Entry points anteriores permanecen en el repositorio para rollback, incluyendo:

- `server-v094-v64mg4-v65beta3-shadow.mjs`
- `server-v093-v64mg4-v65shadow.mjs`
- `server-v091-v64mg3-v65shadow.mjs`
- `server-v089-multigrade-didactic.mjs`
- `server-v088-multigrade-didactic.mjs`
- `server-v086-didactic.mjs`
- `server-v086-projectaction.mjs`
- `server-v086-projectcore.mjs`
- `server-v086.mjs`

Rollback rápido:

- `node server-v094-v64mg4-v65beta3-shadow.mjs` para volver a la revisión shadow anterior;
- `node server-v093-v64mg4-v65shadow.mjs` para volver a V6.5 Beta.2 shadow;
- `node server-v089-multigrade-didactic.mjs` para retirar V6.5 y volver a V6.4 multigrado;
- `node server-v086.mjs` para rollback completo al V6.2.1 estable.

`/health` informa la versión activa, motor productivo, shadow y fallbacks.

## Nota de desarrollo

No agregar `service_role` ni secretos de Gemini al navegador o al repositorio. Las claves privadas permanecen en Supabase/Railway.
