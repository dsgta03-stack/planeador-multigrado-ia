# Multiplan — Planeador Multigrado IA

Aplicación para construir planeaciones de primaria alineadas con la Nueva Escuela Mexicana, usando PDA oficiales y proyectos de los Libros de Texto Gratuitos (LTG) verificados en Supabase.

## Estado actual

- Interfaz: **V0.8.6** en Railway, sin cambios visuales por V6.3.
- Planeaciones de **un grado**: **V6.3-PROJECT-ACTION-CONTINUITY-BETA.4**.
- Primer respaldo para un grado: **V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA** mediante `plan-support-project-core-v1`.
- Planeaciones de **2 o más grados**: **PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE** mediante `plan-support-gemini-lab` versión 11.
- Modelo: Gemini a través de Edge Functions de Supabase.
- Autenticación: Supabase Auth por correo y contraseña.
- Corpus curricular: **1,333 PDA oficiales**.
- Proyectos LTG: **427/427 cubiertos**.
- Actividades LTG verificadas y enriquecidas: **2,364/2,364**.
- Vínculos proyecto ↔ PDA: **1,418**.

## V6.3 Project Action Continuity

La unidad principal sigue siendo el **proyecto**, pero V6.3 añade una capa de calidad sobre Project Core para convertir PDA y proyecto en actividades concretas y dependientes entre sí.

Flujo:

`problema/reto/necesidad/interés → PDA → búsqueda de proyectos LTG compatibles → LTG base / LTG adaptado / proyecto propio → acciones de aprendizaje → actividades activas → productos parciales → sesiones dependientes → producto final`

### Cinco controles de calidad

V6.3 valida de forma determinística:

1. **Activity Specificity**: la actividad debe describir una acción observable del alumno; dialogar o reflexionar puede acompañar, pero no sustituir una actividad concreta.
2. **PDA Action Alignment**: cada actividad debe declarar qué acción de aprendizaje derivada del PDA desarrolla.
3. **Observable Evidence**: cada momento debe producir una evidencia identificable.
4. **Product Progression**: cada sesión debe aportar un producto parcial o avance real hacia el producto final.
5. **Session Dependency**: cada sesión produce un artefacto identificado por `output_artifact_id` y la siguiente debe reutilizarlo en `input_artifact_ids`.

La V6.3 mantiene además tiempo exacto, PDA oficiales, trazabilidad LTG y validación de `activity_order`.

### Decisión de proyecto

El selector V6.3 compara proyectos LTG antes de generar uno propio:

- `LTG_BASE`: el proyecto LTG puede sostener el hilo conductor.
- `LTG_ADAPTED`: su núcleo es pertinente, pero requiere contextualización.
- `MULTIPLAN_GENERATED`: ningún LTG alcanza compatibilidad suficiente sin forzar problema, PDA o contexto.

Marcar un LTG en la interfaz significa **disponibilidad o interés**, no obligación. La selección final considera problema, PDA, propósito, producto, contexto y utilidad de las actividades verificadas.

### Metodologías específicas

V6.3 **no implementa todavía** las fases oficiales de ABP, STEAM, Aprendizaje Servicio o Proyectos Comunitarios.

Los títulos originales de momentos/actividades LTG pueden aparecer en `ltg_use` como trazabilidad. Una capa determinística evita que esos nombres se conviertan en la estructura narrativa de las sesiones.

## Arquitectura V6.3

La generación de un grado utiliza dos llamadas de modelo, no tres:

1. `project-core-selector-v63`: interpreta problema/PDA, compara proyectos LTG y bloquea la decisión de Project Core.
2. `plan-support-project-action-v2`: genera la secuencia completa con acciones, evidencias, productos parciales y dependencias.

`plan-support-project-action-v3` es una capa determinística sin llamada adicional a Gemini. Valida/repara únicamente casos seguros como acciones de aprendizaje demasiado cortas o menciones de fases metodológicas en la narrativa. No repara otros errores pedagógicos.

La primera V6.3 experimental de tres llamadas (`plan-support-project-action-v1`) fue retirada por latencia y ahora responde `410`. El arnés temporal de pruebas también fue cerrado y responde `410`.

## Pruebas V6.3

Se probaron los tres modos principales:

- `LTG_BASE`: proyecto alimentario de 1.º con cadena registro → borrador → menú final.
- `LTG_ADAPTED`: proyecto de reglamento adaptado al problema de inasistencia con cadena causas → acuerdos → folleto/tendedero → presentación final.
- `MULTIPLAN_GENERATED`: proyecto de 4.º sobre separación de mezclas con cadena registro de propiedades → diseño → estación de separación funcional.

En los casos aprobados los cinco controles de calidad quedaron en `true`. Los tiempos observados de las pruebas V6.3 de dos llamadas estuvieron aproximadamente entre **22 y 52 segundos**.

## Alcance deliberadamente protegido

V6.3 sólo gobierna solicitudes con **exactamente un grado**.

Las solicitudes de dos o más grados continúan en V6.2.1, ya que esta versión no pretende implementar todavía el nuevo motor multigrado.

Tampoco cambia todavía:

- interfaz;
- usuarios;
- esquema de base de datos;
- materiales didácticos avanzados;
- evaluación avanzada;
- fases específicas de metodologías.

## Seguridad

Las funciones nuevas (`project-core-selector-v63`, `plan-support-project-action-v2` y `plan-support-project-action-v3`) validan un `access_token` real de Supabase Auth antes de procesar la solicitud.

Las rutas experimentales abiertas durante las pruebas fueron neutralizadas después de usarse. El antiguo publicador V0.8 continúa desactivado y el generador OpenAI V2 permanece deprecado.

## Producción y cadena de rollback

Railway ejecuta actualmente:

`node server-v086-projectaction.mjs`

La cadena es:

1. **V6.3 Project Action** — un grado.
2. **Project Core v1** — fallback automático para un grado si V6.3 devuelve error de calidad (`422`) o error de servidor/red.
3. **V6.2.1 Stable** — motor conservado para 2+ grados y respaldo estable inferior.

Los archivos anteriores permanecen intactos:

- `server-v086-projectcore.mjs`
- `server-v086.mjs`

El router V6.3 ejecuta `server-v086-projectcore.mjs` como proceso hijo, y éste mantiene `server-v086.mjs` debajo.

Formas de rollback:

- establecer `MULTIPLAN_V63_ENABLED=false` para saltar V6.3 y volver al router Project Core;
- cambiar el start command a `node server-v086-projectcore.mjs`;
- para rollback completo al motor anterior, cambiar el start command a `node server-v086.mjs`.

`/health` informa explícitamente V6.3, el fallback Project Core y el motor multigrado V6.2.1.

## Nota de desarrollo

No agregar `service_role` ni secretos de Gemini al navegador o al repositorio. La clave publicable de Supabase puede utilizarse en cliente; los secretos permanecen en Supabase/Railway.
