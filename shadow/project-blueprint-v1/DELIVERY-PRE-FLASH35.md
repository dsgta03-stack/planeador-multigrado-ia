# ProjectBlueprint V1 — ronda limitada 2

**NO LISTA. Bloqueada por disponibilidad/cuota del proveedor.** PB-007 y PB-020 están corregidas y verificadas en vivo. La suite completa con el nuevo revisor no pudo concluir: Flash-Lite devuelve 503 y Pro 429. No se ejecutó generación nueva porque todavía no se ha cumplido el requisito previo de 22/22.

Checkpoint previo a reanudar pruebas: [9e251fb801a174075ffc5b4d54f7f90f87779a4e](https://github.com/dsgta03-stack/planeador-multigrado-ia/commit/9e251fb801a174075ffc5b4d54f7f90f87779a4e). Rama: project-blueprint-v1-shadow.

## Cambios realizados

- Revisión independiente por cuatro focos: GLOBAL, PDA, STAGES y METHOD, todos derivados del mismo input/hash.
- Por PDA se cruzan texto oficial, grado propietario, aportación local, acción observable del grado, artefacto y evidencia; el desempeño de otro grado no compensa una carencia.
- Por etapa se verifica operación, salida, criterio, consumidor y contribución sustantiva al resultado, no sólo IDs/nombres.
- Por operación metodológica se exige acción observable congruente con el resultado y evidencia. Una declaración no prueba su cumplimiento.
- Las auditorías incompletas, citas no presentes o referencias inválidas no permiten PASS. Un FAIL global no se borra por un PASS local.
- El generador usa responseJsonSchema y restricciones de solicitud para source, outcome_01, destinos, recursos autorizados y selección metodológica. Los cinco contratos de dominio y gate.mjs permanecen sin cambios en esta ronda. No se relajaron BPD-005/014/018/019.
- Máximo tres intentos de transporte ante respuestas transitorias explícitas, con backoff 1/2 segundos. No se repiten timeouts de resultado ambiguo. Los reintentos no crean revisiones pedagógicas. El resultado final operacional se etiqueta PROVIDER_UNAVAILABLE, incluso en la revisión conservada.
- El runner detiene el lote al agotar disponibilidad o al detectar acceso shadow caducado; el nuevo runner de generación exige la suite completa antes de llamar al modelo.

## Fixtures antes/después

Antes: 20/22. Ahora PB-007 y PB-020 cumplen sus expectativas, pero no se presenta la combinación de resultados antiguos y nuevos como una nueva suite 22/22. Los intentos interrumpidos/con errores no constituyen fallos pedagógicos ni validan ausencia de regresiones.

| Fixture | Método | Antes | Última comprobación | Revisión completa | Coincide |
|---|---|---|---|---|---|
| PB-001 | proyectos_comunitarios | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-002 | proyectos_comunitarios | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-003 | abp | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-004 | aprendizaje_servicio | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-005 | steam | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-006 | abp | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-007 | abp | Pendiente | FAIL | Sí | Sí |
| PB-008 | proyectos_comunitarios | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-009 | proyectos_comunitarios | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-010 | abp | Coincidía | PROVIDER_UNAVAILABLE | No | No comprobado |
| PB-011-STEAM-PASS | steam | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-012-SERVICIO-PASS | aprendizaje_servicio | Coincidía | Error: PROVIDER_ERROR:503 | No | No comprobado |
| PB-013-COMUNITARIO-PASS | proyectos_comunitarios | Coincidía | Error: PROVIDER_ERROR:503 | No | No comprobado |
| PB-014-UN-GRADO-UNA-SESION | abp | Coincidía | Error: PROVIDER_ERROR:503 | No | No comprobado |
| PB-015-SEIS-GRADOS-DOS-SESIONES | proyectos_comunitarios | Coincidía | Error: PROVIDER_ERROR:503 | No | No comprobado |
| PB-016-LTG-CORE | abp | Coincidía | Error: PROVIDER_ERROR:503 | No | No comprobado |
| PB-017-LTG-SUPPORT | abp | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-018-LTG-OPTIONAL | abp | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-019-WEAK | abp | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-020-MUSEO-REAL | proyectos_comunitarios | Pendiente | FAIL | Sí | Sí |
| PB-021-CINCO-SESIONES | abp | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |
| PB-022-MAS-SESIONES-QUE-OPERACIONES | abp | Coincidía | Error: SHADOW_DISABLED:403 | No | No comprobado |

## PB-007 y PB-020: evidencia completa

### PB-007

Entrada: [fixture](fixtures/PB-007.json). Auditorías completas, citas, hallazgos, hash y telemetría: [resultado completo](evidence/PB-007.json).

- Deterministas activados: ninguno.
- Semánticos activados: BPS-004, BPS-005, BPS-007, BPS-008.
- Doce reglas evaluables: sí.

### PB-020-MUSEO-REAL

Entrada: [fixture](fixtures/PB-020-MUSEO-REAL.json). Auditorías completas, citas, hallazgos, hash y telemetría: [resultado completo](evidence/PB-020-MUSEO-REAL.json).

- Deterministas activados: BPD-008, BPD-009, BPD-010.
- Semánticos activados: BPS-003, BPS-007, BPS-008.
- Doce reglas evaluables: sí.

## Blueprint aprobado completo

**Pendiente. No se obtuvo ni fabricó un APPROVED nuevo.** La ejecución de generación está condicionada a 22/22 en run-generation-round2.mjs.

## Blueprint rechazado completo

El [intento rechazado de la ronda anterior](evidence/generated-attempt-1-rejected.json) conserva sus dos revisiones y diff; no sustituye el caso adversarial solicitado en esta ronda. **El nuevo adversarial no se ejecutó.** El runner preparado plantea una restricción temporal imposible y exige las mismas reglas; su resultado no se anticipa.

## Pruebas locales

```text
# tests 63
# pass 63
# fail 0
# duration_ms 247.704872
```

Incluyen las 47 originales, las siete incorporadas en ronda 1 y nueve para evidencia/reintentos/indisponibilidad. [Salida completa](evidence/round2-automated-tests.tap).

## Comparación de modelos y bloqueos

- Gemini 3.1 Flash-Lite completó las revisiones corregidas de PB-007/PB-020. En la reanudación devolvió 503 repetidos; algunas revisiones comenzaron y no pudieron completarse.
- Gemini 3.1 Pro Preview devolvió 429 tras los tres intentos permitidos. No hay salida pedagógica de Pro y no se le atribuye PASS/FAIL.
- La comprobación previa con Gemini 2.5 Pro devolvió 404. Se conservó; no se usa como modelo disponible.
- No se cambió de proveedor: todas las llamadas usan Google Gemini.
- El acceso experimental había caducado durante la pausa y devolvió 403. Se renovó únicamente el acceso expirable de la función shadow. Los 403 se conservan separados de los fallos de Gemini.
- Se detuvieron los dos procesos de lote con SIGINT al persistir la indisponibilidad. No se reconstruyeron respuestas ni consumos de llamadas interrumpidas.

## Telemetría y reparaciones

```json
{
  "logical_calls": 41,
  "transport_attempts": 59,
  "tokens": 51610,
  "latency_ms": 216514,
  "cost": null
}
```

[Telemetría por llamada e intentos](evidence/round2-metrics.json). Se preservan resultados históricos y archivos attempt; no se reemplazan silenciosamente. Coste monetario no informado por el proveedor. Latencias son suma de llamadas, no tiempo total de pared. No hubo nuevas reparaciones pedagógicas de generación en esta ronda; los retries de transporte están separados.

## Falsos positivos/falsos negativos

Los falsos negativos conocidos de PB-007/BPS-004 y PB-020/BPS-007/008 están corregidos en la evidencia guardada con la revisión dividida. El intento anterior de revisión conjunta seguía confundiendo asamblea con difusión y devolviendo listas incompletas: queda archivado. No se afirma que no existan otras regresiones ni se calcula una tasa general a partir de dos casos. La muestra positiva de las cuatro metodologías debe repetirse con el revisor final cuando el proveedor esté disponible.

## Producción y límites de alcance

Verificación sólo de lectura:

```json
{
  "checked_at": "2026-09-23T16:43:26.390657+00:00",
  "url": "https://planeador-multigrado-ia-v084c-gemini-production.up.railway.app/v0122_health",
  "http_status": 200,
  "body": {
    "ok": true,
    "version": "0.12.2",
    "methodologyUi": "OBSERVER_REENTRANCY_GUARD",
    "dataChanges": "NONE",
    "base": "0.12.1"
  }
}
```

main mantiene df21810bcec69be34f4df950e4474283ad7bb079. PR #3 y #4 siguen abiertos y sin fusionarse; esta tarea no los modificó. La rama de PR #4 ha avanzado por otra actividad, así que no se afirma igualdad con el SHA de auditorías anteriores. No hubo cambios en historial, tablas, autenticación ni despliegue productivos. Sólo se renovó la función experimental aislada. No se implementó SessionGraph.

## Continuación exacta

1. Verificar disponibilidad del proveedor con el acceso shadow expirable.
2. Repetir los 22 fixtures con el mismo código y todos los hallazgos evaluables; conservar intentos.
3. Sólo después ejecutar run-generation-round2.mjs positive y adversarial, cada uno con máximo una reparación pedagógica.
4. Obtener y revisar un APPROVED real y un rechazo adversarial apropiado, preservando fuentes/hash/revisiones/diff.
5. Actualizar esta entrega y detenerse para revisión pedagógica.

Los schemas completos, catálogo, árbol y reglas de la entrega inicial se conservan en [DELIVERY-ROUND1.md](DELIVERY-ROUND1.md) y schemas/. Esta ronda no cambia sus reglas.

## Continuación 2026-09-23 18:47 UTC — bloqueo operacional

Se retomó desde el respaldo GitHub `7a67d40d337a1fd9358cf63c22e8af187ad3222e`, sin repetir las 63 pruebas locales documentadas. La sonda mínima de Gemini 3.1 Flash Lite respondió HTTP 200 (`ok: true`): 24 020 ms totales, 14 315 ms de proveedor, 25 tokens de entrada y 5 de salida.

Se añadió una cola compartida por proceso para todas las llamadas del runner, focos de revisión y reintentos: una solicitud simultánea y al menos 8 segundos entre inicios (máximo 8 en cualquier minuto). El runner se ejecutó en un único proceso. Verificación focalizada con reloj simulado: diez solicitudes concurrentes se serializaron con inicios 0, 8000, …, 72000 ms; el rechazo de una solicitud no bloqueó la cola. `node --check provider.mjs` pasó. No se modificaron contratos, prompts, reglas del Gate ni criterios pedagógicos.

El lote final se detuvo en PB-001: tres respuestas de proveedor 503, con inicios a las 18:47:13.934, 18:47:25.047 y 18:47:33.050 UTC. Resultado `PROVIDER_UNAVAILABLE`, sin salida generada, sin revisión semántica completada y sin reparación pedagógica. La evidencia completa permanece en `evidence/PB-001.json`; el intento anterior fue archivado automáticamente. No se hicieron más llamadas al proveedor después de ese fallo final. Gemini Pro no se utilizó.

Estado: no se alcanzó 22/22; no se ejecutaron generación positiva ni adversarial. PB-007/PB-020 y las 63 pruebas previas conservan su evidencia histórica, sin afirmar que se hayan repetido. No existe un nuevo Blueprint APPROVED. La producción, main, PR #3, PR #4, autenticación e historial productivos no fueron modificados. SessionGraph no se inició. **NO LISTA PARA AVANZAR: bloqueo operacional del proveedor.**
