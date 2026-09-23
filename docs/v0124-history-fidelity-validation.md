# Multiplan v0.12.4 shadow — fidelidad de historial y validación visual

Fecha: 2026-09-23  
Estado: **TECH-HIST-01 resuelto en shadow**

## Problema resuelto

`model_output_json` conserva la salida interna del motor, pero capas posteriores pueden transformar la respuesta HTTP que finalmente ve el docente. El historial leía sólo `model_output_json`, por lo que podía reconstruir una versión distinta.

## Solución

1. La respuesta final visible de `/api/gemini-plan` se persiste como `validator_json.final_output_snapshot`.
2. Se guarda `final_output_snapshot_meta` con:
   - `schema_version = FINAL-PLAN-SNAPSHOT-V1`;
   - hash canónico SHA-256;
   - fecha de captura;
   - origen `VISIBLE_HTTP_RESPONSE`.
3. `model_output_json` no se sobrescribe.
4. `Mis planeaciones` usa el snapshot final, cuando existe, tanto para:
   - tarjeta: título, grados, sesiones, metodología, `base_run_id`;
   - detalle: `state.latestPlanData` recibe el snapshot final.
5. Planeaciones antiguas sin snapshot siguen usando `model_output_json`.
6. Un fallo al persistir snapshot no impide entregar la generación al docente.

## Revisión reproducible

La Revisión Pedagógica V1.1 usa cache persistente en `validator_json.pedagogical_review_cache` con llave:

`hash canónico del snapshot + versión del revisor`

- mismo plan + misma versión → HIT y mismo JSON de revisión;
- cambia el plan → MISS;
- cambia la versión del revisor → MISS;
- si el plan recibido no coincide con el hash del snapshot final → `HISTORY_SNAPSHOT_MISMATCH` y no se ejecuta una revisión sobre una versión distinta.

## Componentes

- `persist-final-plan-snapshot-v1`
- `pedagogical-review-cache-v1`
- `server-v0124-history-fidelity-v2-shadow.mjs`
- `server-v0124-review-cache-shadow.mjs`
- `tests/history-fidelity-v1.mjs`
- `tests/review-cache-fidelity-v1.mjs`

## Regresiones

### Historial

PASS:
- fallback para planeaciones antiguas;
- detalle prefiere snapshot final;
- `model_output_json` interno permanece intacto;
- tarjeta usa metadatos del snapshot final;
- fallo de persistencia no cambia la respuesta de generación.

### Cache de revisión

PASS:
- hash canónico estable ante distinto orden de llaves;
- HIT para mismo plan y misma V1.1;
- el HIT devuelve exactamente el resultado almacenado;
- modificar una actividad invalida el cache;
- cambiar la versión del revisor invalida el cache.

## Validación visual controlada

Se renderizó una réplica de los componentes reales de v0.12.4 en escritorio y móvil para revisar jerarquía, legibilidad y comportamiento responsive.

Resultado:
- escritorio: ruta de 5 pasos, revisión y tarjetas legibles;
- móvil: revisión legible, indicadores 2×2, hallazgos en una columna;
- historial móvil: tarjeta en una columna y acción de apertura a ancho completo;
- la revisión no debe mostrarse en la vista de historial.

### Ajustes de polish detectados

No bloqueantes, para la consolidación previa a producción:

1. considerar apilar verticalmente la ruta de 5 pasos en móvil en vez de scroll horizontal;
2. actualizar el pill superior para mostrar v0.12.4 cuando esta capa sea la visible;
3. al pulsar el paso `Revisión`, priorizar scroll al panel `mpPedagogicalReview` y usar el plan como fallback;
4. consolidar/squash de wrappers shadow antes de promover para no aumentar procesos Node innecesarios.

## Producción

Esta solución permanece en `pedagogical-review-v1-shadow`. No sustituye `main` ni la producción v0.12.2.
