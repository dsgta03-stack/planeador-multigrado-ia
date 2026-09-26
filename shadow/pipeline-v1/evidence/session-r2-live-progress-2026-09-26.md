# SessionGraph R2 — evidencia live parcial (2026-09-26)

## Alcance

Validación shadow del tramo `ProjectBlueprint aprobado -> SessionGraph R2 -> Gates -> TeacherPlanProjection` con `gemini-3.5-flash-lite`. Esta evidencia **no certifica** todavía `READY_FOR_TEACHER`.

No se modificaron `main`, producción, PR #3 ni PR #4.

## Fuentes fijadas

- TeacherConstraints hash: `231186405b12537fc00f9cb7d644bb98e7c79b2cc9eb7cae401aecc399c5400a`
- CurriculumSnapshot hash: `e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`
- MethodologyDecision hash: `9d2b4be07b5837ac7f4b181fcbfa95b50dfb404a737698c908cf231837ed9cf6`
- Modelo: `gemini-3.5-flash-lite`
- Metodología: `proyectos_comunitarios`
- Grados: 1 y 3
- Sesiones: 3 x 90 min
- PDA: `F3-DHC-1-010`, `F4-DHC-3-001`

## ProjectBlueprint live actual

Se generó un nuevo candidato live sin reparación y con las fuentes anteriores:

- Blueprint id: `a02e58c7-c297-4dca-b286-4efb1f48ecca`
- Blueprint hash: `d552b9680a8f48eadef9c6cca36c4c3849b96eef10a472a803b8f24911ae7690`
- GENERATE request: `bp-generate-3c0dd8ea-0352-4aff-ad55-dc03579f3465`
- HTTP/provider: `200 / STOP`
- Tokens: prompt `6130`, candidate `5551`, total `11681`

Después se ejecutó una auditoría semántica independiente sobre exactamente ese candidato, sin regenerarlo. Resultado:

- `BPS-001` a `BPS-012`: `PASS`
- fallos PDA: ninguno
- fallos stages: ninguno
- fallos methodology: ninguno

Requests de la auditoría independiente:

- GLOBAL: `bp-exact-global-86f0270e-d2fc-4353-a6b3-353ff5fbd66c` — total `7221` tokens
- PDA: `bp-exact-pda-43103501-406a-40d0-9782-0dadbb388cbb` — total `2782` tokens
- STAGES: `bp-exact-stages-ce26efc3-034d-4841-88d8-b581737e8628` — total `2666` tokens
- METHOD: `bp-exact-method-daa503d7-3a1c-4b44-9e83-996452cd4d61` — total `3772` tokens

Todos devolvieron HTTP 200 / `STOP`.

El primer runner de Blueprint utilizó una copia compacta del Gate determinista para recuperación del experimento. Por esa razón este documento no promociona por sí solo el nuevo Blueprint a checkpoint canónico, aunque su auditoría semántica exacta pasó y sus fuentes están fijadas.

## SessionGraph R2 live — intento v4

Run lógico: `session-r2-live-positive-v4`.

Preflight:

- constraints: hash esperado, `PASS`
- curriculum: hash esperado, `PASS`
- methodology: hash esperado, `PASS`
- Blueprint: `d552b9680a8f48eadef9c6cca36c4c3849b96eef10a472a803b8f24911ae7690`, `PASS`

GENERATE:

- request id: `sessiongraph-generate-6f475944-7aa7-4d05-8d5f-9990aa7dc437`
- provider HTTP: `200`
- finish reason: `STOP`
- prompt tokens: `8211`
- candidate tokens: `6046`
- total tokens: `14257`
- latency: `16977 ms`

### Rechazo local correcto

La propuesta fue rechazada **antes de compilación** por el guardrail determinista:

`S3_ACT_02.grade3.WORKED F4-DHC-3-001` carecía localmente de:

- `INDAGA_SOURCE_OR_OBSERVATION`
- `INDAGA_PROCESS_OR_CONTRAST`
- `INDAGA_TRACEABLE_RECORD`

La actividad de sesión 3 contenía la socialización/presentación, pero intentó heredar componentes de la indagación realizada en actividades anteriores. Esto viola la política local de `WORKED`.

Resultado de v4:

- provider calls: `1`
- repair consumido: `0`
- compile: `NOT RUN`
- Session Gate: `NOT RUN`
- Critical Gate: `NOT RUN`
- TeacherPlanProjection: `NOT PRODUCED`
- `READY_FOR_TEACHER`: **NO**

## Corrección posterior

Se reforzó sólo la autoría shadow, sin suavizar Gates ni contratos:

- commit `7531e4ca8126ef1d2e0644498bef98e1f15ce503`
- `pda_status_policy.default_status = DEVELOPING`
- toda movilización empieza como `DEVELOPING`
- `WORKED` sólo puede asignarse cuando la misma `student_action` satisface todos los componentes locales del PDA
- se prohíbe heredar fuente, procesamiento, registro, explicación, propuesta o socialización desde otra actividad
- cada PDA recibe `required_local_signals` explícitos

Se añadió una prueba de regresión para fijar esta política:

- commit `fcca9ef128ed932bcc60e68446771a033c051cbe`
- archivo `shadow/pipeline-v1/tests/session-provider-scalar-policy.test.mjs`

La prueba asegura que GENERATE y REPAIR reciben el default `DEVELOPING`, los `required_local_signals` y la prohibición de herencia entre actividades.

## Bloqueo actual del siguiente intento live

El siguiente intento live estaba justificado por un cambio real de código, no por retry idéntico. Sin embargo, durante esta sesión el entorno de herramientas bloqueó la creación/invocación del bridge temporal necesario para disparar la nueva corrida autenticada de forma controlada. No se modificaron RLS, grants, credenciales ni producción para sortear ese límite.

Por lo tanto:

- no se realizó un retry idéntico;
- no se consumió una nueva reparación;
- no se alteró el Gate para obtener PASS;
- la validación live final permanece pendiente.

## Limpieza

Las superficies temporales `pipeline-v1-session-evaluate` y `pipeline-v1-session-preflight` fueron neutralizadas nuevamente a `410 PIPELINE_SHADOW_DISABLED` y `verify_jwt=true` al cerrar el experimento.

## Estado

`SESSIONGRAPH_R2_LIVE_NOT_YET_CERTIFIED`

Siguiente prueba válida: ejecutar un nuevo caso positivo con el autor actualizado desde `fcca9ef128ed932bcc60e68446771a033c051cbe` o posterior, usando el mismo conjunto de fuentes fijadas y máximo una reparación. Sólo un resultado real con Session Gate `PASS`, Critical Gate `PASS` y TeacherPlanProjection producido puede promoverse a `READY_FOR_TEACHER`.
