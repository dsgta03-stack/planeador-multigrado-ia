# Multiplan Shadow Pipeline V1

Esta capa conecta los dos contratos ya validados sin devolver autoridad a las capas históricas del planificador.

## Flujo de autoridad

`TeacherConstraintsV1 + CurriculumSnapshotV1 + MethodologyDecisionV1`

→ `ProjectBlueprintV1 APPROVED`

→ `SessionGraphV1 APPROVED`

→ `TeacherPlanProjectionV1`

La autoridad es monotónica. Una capa posterior puede desarrollar una decisión anterior, pero no reescribirla.

## Reglas

- `ProjectBlueprintV1` mantiene la autoridad sobre problema, pregunta guía, metodología, PDA, aportaciones por grado, resultado final, requisitos funcionales, etapas, artefactos, progresión de estados, LTG y presupuesto.
- `SessionGraphV1` sólo desarrolla la microarquitectura de actividades dentro del Blueprint aprobado.
- Los drivers de SessionGraph reciben clones congelados. Cualquier intento de modificar el Blueprint no altera el artefacto autoritativo.
- El pipeline liga cada frontera por hash: el Blueprint aprobado alimenta el SessionGraph y el SessionGraph aprobado alimenta la proyección docente.
- La revisión semántica de SessionGraph debe estar ligada al hash exacto del input evaluado.
- Se permite como máximo una reparación de SessionGraph por ejecución. No existe un bucle abierto de reparaciones.
- Si SessionGraph determina que el Blueprint aprobado no puede ejecutarse con las restricciones disponibles, puede devolver `BLUEPRINT_REVISION_REQUIRED`, pero no puede revisar el Blueprint por sí mismo.
- `TeacherPlanProjectionV1` es una proyección determinista. No llama a IA, no resume creativamente y no cambia decisiones pedagógicas aprobadas.
- Ningún resultado de esta carpeta está conectado a producción o `main`.

## Drivers

`runShadowPipeline` usa `generateShadow` como runner de ProjectBlueprint por defecto, pero permite inyectar un runner controlado para pruebas. SessionGraph todavía exige drivers explícitos de autoría y revisión; esto evita conectar prematuramente un proveedor a producción antes de validar la orquestación completa.

Los drivers opcionales son:

- `blueprintRunner`
- `sessionAuthor`
- `sessionReview`
- `sessionRepair`

## Estados de salida relevantes

- `READY_FOR_TEACHER`: Blueprint y SessionGraph están aprobados y la proyección docente está ligada a ambos hashes.
- `BLUEPRINT_NOT_APPROVED`: la frontera de ProjectBlueprint no está cerrada.
- `BLUEPRINT_REVISION_REQUIRED`: SessionGraph reporta imposibilidad de ejecución; el pipeline se detiene sin modificar el Blueprint.
- `SESSION_GRAPH_CONTRACT_REJECTED`: la propuesta de sesión no supera el contrato/compilador determinista.
- `SESSION_REVIEW_UNAVAILABLE`: no existe revisión semántica válida para el grafo exacto.
- `SESSION_GRAPH_REJECTED`: el Gate semántico rechazó el grafo después del máximo permitido de reparación.

## Objetivo de esta etapa

Probar que la nueva arquitectura puede recorrer de forma segura las fronteras aprobadas y producir una salida docente sin volver a introducir los múltiples escritores que existían en la cadena histórica V6.x/V0.12.x.
