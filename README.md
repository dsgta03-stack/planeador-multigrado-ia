# Multiplan — Planeador Multigrado IA

Aplicación para construir planeaciones de primaria alineadas con la Nueva Escuela Mexicana, usando PDA oficiales y proyectos de los Libros de Texto Gratuitos (LTG) verificados en Supabase.

## Estado actual

- Interfaz: **V0.8.8** en Railway.
- Planeaciones de **un grado**: **V6.4-DIDACTIC-EXECUTION-BETA.2**.
- Planeaciones de **2 a 6 grados**: **V6.4-MULTIGRADE-DIDACTIC-BETA.1**.
- Respaldo multigrado estable: **PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE**.
- Respaldos inferiores para un grado: **V6.3-PROJECT-ACTION-CONTINUITY-BETA.4** y **V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA**.
- Autenticación: Supabase Auth.
- Corpus curricular: **1,333 PDA oficiales**.
- Proyectos LTG: **427/427**.
- Actividades LTG verificadas y enriquecidas: **2,364/2,364**.
- Vínculos proyecto ↔ PDA: **1,418**.

## V6.4 Didactic Execution

V6.4 corrige una debilidad importante: una actividad no puede limitarse a expresiones como “guiar la lectura”, “acompañar la elaboración”, “coordinar el registro” o “hacer un cartel”.

Cada momento debe explicar de forma ejecutable qué hará el docente, qué harán los alumnos, de 3 a 6 pasos, minutos por paso, consignas, resultado esperado, comprobaciones, apoyos, transición, evidencia y contribución al producto.

## V6.4 Multigrade Didactic

La versión multigrado se construye **encima de V6.2.1 estable**. V6.2.1 sigue siendo responsable de generar y validar primero la estructura: sesiones, tiempos, atención directa, trabajo simultáneo, PDA y trazabilidad LTG. V6.4-MG recibe esa estructura aprobada como un esqueleto inmutable y sólo amplía cómo se ejecutan las actividades.

Reglas principales:

- un solo docente real por momento;
- máximo 2 grados bajo atención directa cuando hay 3 o más grados;
- todos los demás grados trabajan simultáneamente;
- no se pueden cambiar los grados asignados, PDA, LTG, `activity_order` ni minutos definidos por V6.2.1;
- el bloque atendido recibe un procedimiento docente de 3–6 pasos;
- cada bloque autónomo recibe instrucciones preparadas antes de la rotación, 3–6 pasos, materiales, autocontrol, estrategia si se atoran y evidencia;
- los procedimientos de todos los bloques de un mismo momento duran exactamente los mismos minutos porque ocurren simultáneamente;
- 1.º–2.º pueden usar oralidad, dibujo, pictogramas, clasificación, dictado, modelos y manipulables cuando corresponde;
- los grados mayores aumentan análisis, registro, cálculo, argumentación, diseño y producción;
- sin internet, ningún bloque puede depender de recursos en línea.

V6.4-MG también produce una tarjeta `multigrade_project` con problema común, pregunta guía, producto colectivo y una contribución diferenciada por cada grado.

## Validación multigrado adicional

Antes de entregar una salida V6.4-MG se vuelve a comprobar que:

1. la estructura aprobada por V6.2.1 no haya cambiado;
2. los PDA permanezcan iguales;
3. la atención directa conserve los mismos grados;
4. la trazabilidad LTG permanezca intacta;
5. cada momento cubra exactamente todos los grados una sola vez;
6. los procedimientos directos sean ejecutables;
7. los procedimientos autónomos sean ejecutables sin interrumpir al docente;
8. la duración de cada procedimiento coincida con los minutos del momento.

Si falla alguno de estos controles, V6.4-MG devuelve error de calidad y el router utiliza automáticamente V6.2.1 estable.

## Interfaz V0.8.8

La vista multigrado distingue claramente:

- **CON EL DOCENTE**: bloque atendido y procedimiento paso a paso;
- **TRABAJO AUTÓNOMO**: qué hacen simultáneamente los demás grados;
- **Procedimiento autónomo**: pasos, materiales, autocontrol, qué hacer si se atoran y resultado esperado.

También muestra el proyecto común y el aporte previsto por grado. La vista anterior permanece debajo como respaldo visual.

## Seguridad y alcance

Todas las rutas productivas de generación validan una sesión real de Supabase Auth. Una petición con token inválido se rechaza con `401` antes de consumir modelo.

No se modificaron:

- PDA oficiales;
- tablas curriculares;
- corpus LTG;
- usuarios;
- materiales avanzados;
- fases específicas completas de las metodologías.

El arnés temporal de V6.4 unigrado permanece neutralizado. El intento de crear un nuevo arnés de usuarios para V6.4-MG fue descartado al ser bloqueado por controles de seguridad; no se debilitó Auth para realizar pruebas.

## Producción y rollback

Railway ejecuta actualmente:

`node server-v088-multigrade-didactic.mjs`

Cadena de protección:

1. **V6.4 Multigrade Didactic** — 2 a 6 grados.
2. **V6.2.1 Stable** — fallback automático multigrado ante `422`, error de servidor, red o timeout.
3. Para un grado: **V6.4 Didactic Execution → V6.3 Project Action → Project Core v1 → V6.2.1**.

Todos los entrypoints anteriores permanecen intactos:

- `server-v086-didactic.mjs`
- `server-v086-projectaction.mjs`
- `server-v086-projectcore.mjs`
- `server-v086.mjs`

Rollback multigrado:

- `MULTIPLAN_V64_MG_ENABLED=false` → salta V6.4-MG y vuelve al stack anterior;
- start command `node server-v086-didactic.mjs` → elimina por completo la capa multigrado nueva;
- start command `node server-v086.mjs` → rollback completo al V6.2.1 estable.

`/health` informa explícitamente el motor V6.4-MG, el motor unigrado y todos los fallbacks.

## Nota de desarrollo

No agregar `service_role` ni secretos de Gemini al navegador o al repositorio. Las claves privadas permanecen en Supabase/Railway.
