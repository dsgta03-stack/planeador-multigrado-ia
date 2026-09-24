# SessionGraph V1 (shadow)

SessionGraph V1 convierte un `ProjectBlueprintV1` ya aprobado en sesiones y actividades ejecutables **sin volver a decidir el proyecto**.

## Frontera de autoridad

ProjectBlueprint conserva la autoridad exclusiva sobre: problema, pregunta guía, metodología, PDA, aportaciones por grado, resultado final y perfiles funcionales, etapas, secuencia de estados, artefactos, operaciones metodológicas, LTG y presupuesto global. SessionGraph no copia esos campos como decisiones editables: el compilador los proyecta desde el Blueprint aprobado y los liga por hash.

El modelo de SessionGraph sólo puede proponer la microarquitectura de ejecución: actividades, acciones diferenciadas por grado, rol docente, minutos, recursos/apoyos, dependencias internas, outputs, evidencias, criterios y vínculos a PDA/operaciones/requisitos funcionales ya autorizados.

## Flujo

`Approved ProjectBlueprint + Sources → SESSION_GRAPH_AUTHORING_V1 → compileSessionGraph → SGD deterministic gate → SGS semantic review → SESSION_GRAPH_APPROVAL_V1`

Si una sesión no puede ejecutar el Blueprint dentro de sus restricciones, SessionGraph **no puede cambiar el proyecto**. Debe devolver `BLUEPRINT_REVISION_REQUIRED` en la capa de orquestación futura.

## Reglas clave

- No existe actividad de relleno: `DIRECT` construye un artefacto esperado; `COMPLEMENTARY` debe ser consumida por una actividad posterior.
- Todo input de actividad proviene del artefacto de entrada de la sesión o de un output anterior.
- Cada operación metodológica del Blueprint debe ejecutarse en actividades observables.
- Cada PDA en foco debe movilizarse desde el grado correcto; no se permite herencia curricular entre grados.
- Cada requisito funcional del resultado final debe enlazarse a actividades de sus etapas autorizadas.
- Recursos y apoyos se limitan a `TeacherConstraints`.
- El último nodo es terminal; nunca puede “preparar la siguiente sesión”.
- La trazabilidad PDA/metodología/artefactos/requisitos funcionales la deriva el compilador, no el modelo.

## Estado

Esta carpeta establece el contrato y Gate inicial de SessionGraph V1. No está conectada a producción ni a `main`; permanece aislada en `session-graph-v1-shadow` hasta superar casos positivo y adversarial propios.
