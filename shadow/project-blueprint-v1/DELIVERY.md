# ProjectBlueprint V1 — Gemini 3.5 Flash-Lite

**NO LISTA para cerrar la etapa. Suite homogénea 22/22 completa; generación real bloqueada, sin APPROVED ni adversarial.**

Rama: `project-blueprint-v1-shadow`. Referencia solicitada: `5dcc8f5482d7d8c9a411fcd107a9aadb38d4bd21`. El fetch Git por HTTPS carecía de credenciales; se incorporó el archivo edge/index.ts del commit exacto mediante GitHub, conservando el historial local. El commit final remoto desciende de esa referencia. No se ejecutaron auditorías generales ni se repitió la suite local al iniciar.

## Modelo y revisor

Se utilizó exclusivamente `gemini-3.5-flash-lite`. Sin Pro ni fallback a 3.1. Los 22 resultados finales contienen cuatro revisiones reales cada uno, bajo `LOCAL_EVIDENCE_V1_LITERAL_QUOTES_R2`. La instrucción pedagógica, los contratos y el Gate permanecen intactos; se explicitó el requisito ya existente de citas literales continuas. La verificación de citas no fue relajada.

## Incidencias y cambios

1. El canario inicial PB-001 fue evaluable. El primer lote se detuvo en PB-006: BPD-007 fue detectado, pero BPS-008 quedó NOT_EVALUABLE por citas con elipsis y fragmentos unidos. Se conservaron esas respuestas en archivos attempt.
2. Se intentó restringir citas con enum en el schema de solicitud; Google rechazó la petición METHOD del canario con 400 INVALID_ARGUMENT. Se retiró ese cambio de schema. Se explicitó en el prompt que la cita debe ser un fragmento continuo de una sola operación, sin elipsis, dejando explicaciones en sus campos correspondientes.
3. Se reinició la corrida homogénea. Los 22 fixtures completaron sus cuatro revisiones con el mismo modelo/revisor. No se combinaron resultados anteriores para llegar a 22/22.
4. El runner de generación ahora exige modelo explícito y comprueba que los 22 resultados correspondan al mismo modelo y versión efectiva del revisor. Antes ignoraba MULTIPLAN_SHADOW_MODEL; se corrigió antes de generar para impedir el uso accidental del modelo por defecto.
5. La generación positiva con responseJsonSchema fue rechazada dos veces con 400 INVALID_ARGUMENT (una repetición diagnóstica para conservar el mensaje). Mensaje exacto: `Request contains an invalid argument.` No hubo Blueprint ni revisión pedagógica.
6. Se probó JSON mode exclusivamente para generación/reparación de 3.5, manteniendo el schema completo en el prompt y el mismo Gate local. El primer intento encontró NON_JSON_VALUE local al hashear undefined y no hizo petición; se corrigió con null en la huella y omisión del campo en el transporte.
7. La siguiente petición devolvió SHADOW_PROVIDER_ERROR, HTTP 502: `SyntaxError: Expected double-quoted property name in JSON at position 25894 (line 635 column 5)`. La función edge descarta el texto crudo al fallar JSON.parse; no tenemos esa salida, finish_reason ni uso de tokens. No se reconstruyeron. Se detuvieron las llamadas. No se afirma que el origen sea truncamiento ni que JSON mode esté validado para producción.

La política de una llamada simultánea y separación mínima de ocho segundos se mantuvo. Los errores anteriores no constituyen rechazos pedagógicos. No hubo reparaciones pedagógicas ni Blueprint modificado manualmente.

## Tabla final de fixtures

| Fixture | Resultado | Expectativa | BPD activadas | BPS activadas |
|---|---|---|---|---|
| PB-001 | FAIL | Coincide | — | BPS-003, BPS-007, BPS-008 |
| PB-002 | PASS | Coincide | — | — |
| PB-003 | FAIL | Coincide | BPD-008, BPD-009, BPD-010 | — |
| PB-004 | FAIL | Coincide | — | BPS-003, BPS-007, BPS-008 |
| PB-005 | FAIL | Coincide | BPD-019 | BPS-004, BPS-005, BPS-007, BPS-008 |
| PB-006 | FAIL | Coincide | BPD-007 | — |
| PB-007 | FAIL | Coincide | — | BPS-004, BPS-005, BPS-007 |
| PB-008 | FAIL | Coincide | — | BPS-001, BPS-003, BPS-004, BPS-005, BPS-006, BPS-007, BPS-008 |
| PB-009 | FAIL | Coincide | — | BPS-003, BPS-007, BPS-008 |
| PB-010 | PASS | Coincide | — | — |
| PB-011-STEAM-PASS | PASS | Coincide | — | — |
| PB-012-SERVICIO-PASS | PASS | Coincide | — | — |
| PB-013-COMUNITARIO-PASS | PASS | Coincide | — | — |
| PB-014-UN-GRADO-UNA-SESION | PASS | Coincide | — | — |
| PB-015-SEIS-GRADOS-DOS-SESIONES | PASS | Coincide | — | — |
| PB-016-LTG-CORE | PASS | Coincide | — | — |
| PB-017-LTG-SUPPORT | PASS | Coincide | — | — |
| PB-018-LTG-OPTIONAL | PASS | Coincide | — | — |
| PB-019-WEAK | NEEDS_TEACHER_DECISION | Coincide | — | — |
| PB-020-MUSEO-REAL | FAIL | Coincide | BPD-008, BPD-009, BPD-010 | BPS-003, BPS-007, BPS-008 |
| PB-021-CINCO-SESIONES | PASS | Coincide | — | — |
| PB-022-MAS-SESIONES-QUE-OPERACIONES | PASS | Coincide | — | — |

PB-007 detecta BPS-004/BPS-005. PB-020 detecta BPD-008/009/010 y BPS-003/007/008. Los cuatro casos positivos metodológicos conservaron PASS. Cada resultado completo con auditorías, citas, hash y telemetría está en evidence/<fixture>.json.

## Telemetría

```json
{
  "final_suite": {
    "logical_calls": 88,
    "transport_attempts": 88,
    "reported_tokens": 337378,
    "summed_latency_ms": 789728,
    "provider_429": 0,
    "provider_503": 0
  },
  "round_total": {
    "logical_calls": 119,
    "transport_attempts": 119,
    "reported_tokens": 435241,
    "summed_latency_ms": 1063241,
    "provider_429": 0,
    "provider_503": 0
  }
}
```

El total de ronda incluye canarios, el lote interrumpido y generación; los 88 llamados lógicos de la suite final son independientes de los intentos previos. Tokens son únicamente los reportados, no una estimación de salidas perdidas. Latencia es suma de llamadas e incluye esperas del limitador; no representa tiempo de pared. [Detalle completo](evidence/flash35-metrics.json). [Errores originales de proveedor](evidence/flash35-provider-errors.jsonl).

## Blueprint APPROVED completo

**No obtenido.** No hay Blueprint positivo válido que pueda mostrarse como aprobado. Fuentes y errores de cada intento se conservan en evidence/round2-generated-positive-*.json. Las entradas fueron exclusivamente TeacherConstraintsV1 + CurriculumSnapshotV1 + MethodologyDecisionV1, sin sesiones V6.4/Beta.10.

## Adversarial, revisiones y diff

**No ejecutado:** requiere un APPROVED previo. Los intentos de generación de esta ronda contienen revisions=[] y repair_count=0. No se creó revision 2 ni diff pedagógico porque no existe revision 1 válida. No se atribuyó rechazo a un proyecto inexistente.

## Falsos positivos y falsos negativos

PB-006 mostró un fallo de formato de evidencia, no una aprobación falsa: el Gate cerró correctamente con NOT_EVALUABLE. Tras corregir instrucciones de cita, las 22 expectativas coincidieron. No se observaron discrepancias adicionales en esta suite; esto no demuestra precisión general fuera de los fixtures. La generación y el adversarial siguen sin validarse.

## Pruebas locales y límites

Resultado final: **63/63 pruebas locales, 0 fallos**, duración 56 184 ms. Se ejecutó una única suite local final por los cambios de código; su resultado se conserva en [flash35-local-tests.tap](evidence/flash35-local-tests.tap). No se repitieron las 63 pruebas al inicio.

No se modificaron producción, main, PR #3, PR #4, autenticación productiva, historial ni contratos/Gate. No se desplegó la función shadow en esta ejecución. SessionGraph no se inició. Esta afirmación describe las acciones de esta ejecución; no implica una nueva auditoría productiva.

## Pendiente concreto

Conservar el texto crudo y metadatos de una respuesta de generación no parseable dentro del entorno aislado, diagnosticar el contrato de salida sin aflojar el Gate y obtener un Blueprint real aprobado. Sólo después ejecutar el adversarial. No repetir las 22 revisiones si el revisor no cambia. Estado anterior completo: [DELIVERY-PRE-FLASH35.md](DELIVERY-PRE-FLASH35.md).
