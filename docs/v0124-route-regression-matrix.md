# Multiplan v0.12.4 — Matriz de regresión de rutas V1

Estado: **preview / shadow**  
Rama: `pedagogical-review-v1-shadow`  
Producción: **no modificar**  
Matriz ejecutable: `tests/route-regression-matrix-v1.json`  
Validador de estructura: `tests/route-regression-matrix-v1.mjs`

## Objetivo

Esta matriz es la red de seguridad para retirar gradualmente la cascada histórica de wrappers después de cerrar `ProjectBlueprint V1`.

No intenta conservar cada archivo o puerto actual. Conserva **comportamientos e invariantes**: selección docente, aislamiento transversal, trazabilidad por grado, seguridad de fallbacks, metodología elegida, conteo/tiempo de sesiones, fidelidad del snapshot, historial, revisión y DOCX.

La consolidación futura sólo puede considerarse equivalente si la arquitectura nueva satisface la misma matriz que el preview actual.

## Regla de comparación

Para cada escenario deben capturarse, cuando corresponda:

- HTTP status;
- `x-multiplan-plan-engine`;
- `x-multiplan-v65-promotion`;
- `x-multiplan-safe-fallback`;
- `x-multiplan-methodology-sequence`;
- `x-multiplan-session-count-preserved`;
- `x-multiplan-project-coherence`;
- `x-multiplan-final-snapshot` y versión;
- hash canónico del plan final;
- conteo de sesiones y minutos;
- `methodology_primary`;
- PDA por grado;
- grados `TRANSVERSAL_PROJECT`;
- producto final y aportes por grado;
- estado/versión de revisión;
- fuente del histórico;
- fuente semántica usada por DOCX.

Un cambio de nombre de motor o de header no es por sí mismo una regresión si la nueva arquitectura declara una migración explícita. Una pérdida de invariant sí es regresión aunque la respuesta sea HTTP 200.

## Grupos de ejecución

### A. Deterministas — ejecutar en cada cambio de arquitectura

- `RTE-013`: exactitud temporal.
- `RTE-015`: generar/reabrir conserva hash.
- `RTE-016`: histórico alterado produce `HISTORY_SNAPSHOT_MISMATCH`.
- `RTE-017`: revisión del mismo snapshot usa caché.
- `RTE-018`: DOCX nuevo e histórico parten de la misma fuente.
- Parte estructural de `RTE-020`: proyecto/producto común y contribuciones por grado.

Estos casos no deben consumir modelo cuando pueden comprobarse con fixtures.

### B. Live autenticados — ejecutar antes de promover una arquitectura

- `RTE-001`: auth ausente.
- `RTE-002`: single-grade.
- `RTE-003`: multigrado completo.
- `RTE-004`: cero PDA.
- `RTE-005`: PDA sólo en algunos grados.
- `RTE-007`: elección docente distinta de recomendación.
- `RTE-008`: Beta.10 promotion PASS.
- `RTE-011`: una sesión.

Deben utilizar una cuenta temporal de prueba y limpiar sólo los registros marcados por esa ejecución.

### C. Semánticos live — no sustituir por coincidencias de palabras

- `RTE-006`: fuga semántica de un PDA ajeno.
- Parte semántica de `RTE-020`: la contribución de cada grado debe materializarse en operación/evidencia; no basta que el proyecto global contenga vocabulario del PDA.

La evaluación debe hacerse localmente por PDA/grado y no aprobar por coincidencias globales.

### D. Inyección de fallos — staging/preview únicamente

- `RTE-009`: Beta.10 falla promotion gate y debe conservarse V6.4.
- `RTE-010`: ruta primaria multigrado falla y entra rescate estable o termina en error explícito.
- `RTE-014`: falla la persistencia de snapshot después de obtener un plan válido.

No deben probarse provocando fallos en producción.

### E. Stress

- `RTE-012`: 15 o más sesiones.

Debe comprobar el mismo conteo en respuesta visible, snapshot, histórico, revisión y DOCX. También debe vigilar límites de payload, tiempos de espera y truncamiento de tablas/documentos.

### F. Navegador/UI

- `RTE-019`: una revisión vigente pasa a `STALE` cuando cambia contexto, problema, PDA, metodología o plan.

La ruta de workflow sólo se considera completa con una revisión vigente del plan actual.

## Baseline ya existente

`tests/teacher-selection-regression.md` conserva evidencia previa para cero-PDA, selección parcial y fuga semántica transversal.

`tests/full-cycle-fidelity-v1.mjs` ya comprueba fidelidad del snapshot, hash del histórico, `HISTORY_SNAPSHOT_MISMATCH`, caché de revisión y equivalencia de fuente semántica para DOCX.

La matriz V1 no reemplaza esos tests: los incorpora como baseline y establece qué falta automatizar en extremo a extremo.

## Promotion gate para la futura consolidación

No retirar la cascada histórica sólo porque la nueva aplicación arranque o porque genere una planeación de muestra. Para sustituirla deben cumplirse conjuntamente:

1. Validador de matriz PASS.
2. Deterministas PASS.
3. Live autenticados PASS.
4. Semánticos live PASS sin rebajar reglas.
5. Fault injection PASS.
6. Stress de 15+ sesiones PASS.
7. Browser/UI PASS.
8. Paridad `generar → snapshot → historial → review → DOCX`.
9. Preview autocontenido, sin dependencia de otro deployment Railway como fuente HTML.
10. Producción sigue intacta hasta una decisión de promoción explícita.

## Orden recomendado después de ProjectBlueprint V1

1. Adaptador determinista `ProjectBlueprintV1 -> plan canónico`.
2. Ejecutar matriz contra arquitectura actual y guardar baseline.
3. Crear orquestador único paralelo, sin retirar wrappers.
4. Ejecutar la misma matriz contra el orquestador nuevo.
5. Resolver diferencias de invariantes.
6. Sustituir primero pass-through/shadows obsoletos y parches UI ya absorbidos.
7. Retirar fallbacks sólo cuando exista evidencia de equivalencia o una decisión explícita de deprecación.

La métrica de éxito no es “menos archivos”; es **menos complejidad accidental con las mismas garantías pedagógicas y de fidelidad**.
