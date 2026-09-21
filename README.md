# Multiplan — Planeador Multigrado IA

Aplicación para construir planeaciones de primaria alineadas con la Nueva Escuela Mexicana, usando PDA oficiales y proyectos de los Libros de Texto Gratuitos (LTG) verificados en Supabase.

## Estado actual

- Interfaz: **V0.8.6** en Railway, sin cambio visual por Project Core.
- Planeaciones de **un grado**: **V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA** mediante `plan-support-project-core-v1`.
- Planeaciones de **2 o más grados**: continúan en **PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE** mediante `plan-support-gemini-lab` versión 11.
- Modelo: Gemini a través de Edge Functions de Supabase.
- Autenticación: Supabase Auth por correo y contraseña.
- Corpus curricular: **1,333 PDA oficiales**.
- Proyectos LTG: **427/427 cubiertos**.
- Actividades LTG verificadas y enriquecidas: **2,364/2,364**.
- Vínculos proyecto ↔ PDA: **1,418**.

## Project Core Beta

La unidad principal de planeación es el **proyecto**, no la sucesión de páginas o libros.

Flujo:

`problema/reto/necesidad/interés → PDA → búsqueda de proyectos LTG compatibles → LTG base / LTG adaptado / proyecto propio → producto → actividades → sesiones continuas → recursos complementarios`

### Decisión de proyecto

- `LTG_BASE`: un proyecto LTG tiene compatibilidad pedagógica alta y puede sostener el hilo principal.
- `LTG_ADAPTED`: el núcleo del LTG es pertinente, pero requiere contextualizar situación, actividades, producto, recursos o extensión.
- `MULTIPLAN_GENERATED`: ningún proyecto LTG alcanza compatibilidad suficiente sin forzar problema, PDA o contexto.

Marcar un LTG en la interfaz significa **disponibilidad o interés docente**, no obligación. Un proyecto marcado puede ser descartado si otro proyecto oficialmente vinculado es claramente más pertinente. El backend también admite `principal_project_id` para un futuro control explícito de “proyecto principal”.

Cada PDA se interpreta como comprensiones, acciones de aprendizaje y señales de evidencia antes de construir actividades.

Los proyectos complementarios sólo quedan autorizados cuando la evaluación semántica indica que aportan al mismo hilo. No se incorporan por mera coincidencia temática.

Los títulos oficiales de momentos/actividades LTG se conservan únicamente en la **trazabilidad**. La narrativa de las sesiones no usa fases específicas de ABP, STEAM, Aprendizaje Servicio o Proyectos Comunitarios.

## Alcance deliberadamente pendiente

Project Core Beta **no implementa todavía**:

- fases específicas de metodologías;
- un nuevo motor multigrado completo;
- evaluación avanzada;
- materiales avanzados;
- cambios de experiencia de usuario;
- cambios de esquema de base de datos.

Por esta razón, el router de producción aplica Project Core sólo cuando la solicitud contiene **exactamente un grado**. Las solicitudes de 2 o más grados se envían al V6.2.1 estable, preservando el funcionamiento multigrado que ya estaba validado.

## Seguridad

Las funciones que generan consumo de modelo requieren un `access_token` válido de Supabase Auth. `plan-support-project-core-v1` valida el token antes de llamar a Gemini y guarda nuevas ejecuciones con el `user_id` autenticado.

La antigua función de prueba `plan-support-project-core-beta` fue neutralizada y responde `410 DEPRECATED_INTERNAL_BETA`; ya no llama a Gemini.

El respaldo `plan-support-gemini-lab` continúa autenticado y disponible. El antiguo publicador V0.8 está desactivado y el generador OpenAI V2 permanece deprecado.

## Producción y rollback

Railway ejecuta:

`node server-v086-projectcore.mjs`

Esta capa intercepta `POST /api/gemini-plan` y decide:

- 1 grado → Project Core Beta;
- 2 o más grados → V6.2.1 estable.

Todos los demás endpoints y la interfaz siguen pasando por **`server-v086.mjs`**, que permanece intacto y ejecutándose como proceso hijo.

Rollback completo:

1. Cambiar el start command de Railway a `node server-v086.mjs`, o
2. mantener el router nuevo y establecer `MULTIPLAN_PROJECT_CORE_ENABLED=false`.

El `/health` informa el motor de un grado, el motor multigrado y el respaldo estable.

## Nota de desarrollo

No agregar `service_role` ni secretos de Gemini al navegador o al repositorio. La clave publicable de Supabase puede utilizarse en cliente; los secretos permanecen en Supabase/Railway.
