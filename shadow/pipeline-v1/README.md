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
- Se permite como máximo una reparación lógica de SessionGraph por ejecución. Un fallo de transporte antes de producir candidato no cuenta como una segunda reparación pedagógica.
- Si SessionGraph determina que el Blueprint aprobado no puede ejecutarse con las restricciones disponibles, puede devolver `BLUEPRINT_REVISION_REQUIRED`, pero no puede revisar el Blueprint por sí mismo.
- `TeacherPlanProjectionV1` es una proyección determinista. No llama a IA, no resume creativamente y no cambia decisiones pedagógicas aprobadas.
- Ningún resultado de esta carpeta está conectado a producción o `main`.

## Componentes

`pipeline.mjs` contiene el orquestador y las fronteras de autoridad. El runner de ProjectBlueprint se importa dinámicamente sólo cuando no se inyecta un runner de prueba, evitando acoplar los tests del pipeline al transporte del proveedor.

`session-provider.mjs` es el adaptador aislado de SessionGraph para `gemini-3.5-flash-lite`. Generación, reparación y revisión usan el endpoint shadow protegido ya existente. No hace reintentos automáticos de una llamada cuyo resultado sea ambiguo; cuando se usa persistencia durable, consulta el mismo `request_id` en lugar de repetir la generación. La reparación tiene un protocolo explícito `BLUEPRINT_REVISION_REQUIRED`: puede solicitar que el nivel superior reabra Blueprint, pero nunca modificarlo.

`projection.mjs` genera la salida docente exclusivamente a partir de los bytes aprobados y vuelve a verificar los hashes de Blueprint y SessionGraph.

`live-shadow.mjs` conecta el runner validado de ProjectBlueprint con el adaptador de SessionGraph. Sólo funciona con `MULTIPLAN_SHADOW_RUN=1`, se bloquea en `NODE_ENV=production`, fija el modelo en `gemini-3.5-flash-lite`, activa autoría compacta y persistencia durable y no tiene acceso a la cadena histórica de planeación ni a `plan_runs`.

## Drivers de `runShadowPipeline`

- `blueprintRunner` — opcional; si falta usa `generateShadow` de ProjectBlueprint.
- `sessionAuthor` — produce únicamente la propuesta de actividades.
- `sessionReview` — revisión semántica independiente ligada al hash exacto del grafo.
- `sessionRepair` — como máximo una reparación de microarquitectura; también puede devolver `BLUEPRINT_REVISION_REQUIRED`.

## Estados de salida relevantes

- `READY_FOR_TEACHER`: Blueprint y SessionGraph están aprobados y la proyección docente está ligada a ambos hashes.
- `BLUEPRINT_NOT_APPROVED`: la frontera de ProjectBlueprint no está cerrada.
- `BLUEPRINT_REVISION_REQUIRED`: SessionGraph reporta imposibilidad de ejecución; el pipeline se detiene sin modificar el Blueprint.
- `SESSION_GRAPH_CONTRACT_REJECTED`: la propuesta de sesión no supera el contrato/compilador determinista.
- `SESSION_REVIEW_UNAVAILABLE`: no existe revisión semántica válida para el grafo exacto.
- `SESSION_GRAPH_REJECTED`: el Gate semántico rechazó el grafo después del máximo permitido de reparación.

## Estado de esta etapa

El código de orquestación, proyección y transporte shadow ya está aislado en `pipeline-v1-shadow`. La CI específica está declarada en `.github/workflows/pipeline-v1-shadow.yml`; los commits hechos mediante el conector no han producido todavía una ejecución de GitHub Actions, por lo que **esta nueva capa aún no debe declararse validada** hasta ejecutar los tests focales del repositorio y, después, un único recorrido live shadow positivo más su prueba adversarial de frontera.

No promover a producción, `main`, PR3 o PR4 durante esta etapa.
