# ProjectBlueprint V1 — cierre de ronda de transporte

**Transporte resuelto en la ejecución real; etapa pedagógica NO LISTA.** La única generación positiva produjo un Blueprint JSON válido y evaluable. Tras la única reparación permitida terminó REJECTED. No hubo APPROVED ni se ejecutó el adversarial.

Rama `project-blueprint-v1-shadow`, referencia `450a1ccb2df50d2128e857daa5dbac78b4b91238`. Modelo exclusivo: `gemini-3.5-flash-lite`. Se preservan los 22/22 fixtures ya validados con `LOCAL_EVIDENCE_V1_LITERAL_QUOTES_R2`: no se volvieron a ejecutar ni se modificaron reviewer, Gate, BPD/BPS o schemas de dominio.

## Separación de contratos

**Provider Transport Contract != ProjectBlueprintV1 Domain Contract.** [Diseño y límites](TRANSPORT.md).

`transport-schema.mjs` conserva tipos, propiedades, claves requeridas, items, nullabilidad, marcadores de versión, DRAFT, gate_result nulo y cantidad exacta de sesiones. Omite restricciones dinámicas costosas para Google, que siguen en el prompt y en la validación local autoritativa. No tiene capacidad de aprobar proyectos. El schema completo de dominio y Gate permanecieron sin cambios.

## Observabilidad y tratamiento de errores

La función shadow separa HTTP de Google, extracción del texto candidato y JSON.parse estricto. Un candidato inválido devuelve PROVIDER_OUTPUT_INVALID_JSON con provider_status=200, modelo, finish_reason, usageMetadata/usage, texto crudo (hasta 100 000 unidades UTF-16, con indicador de truncamiento), longitud, error de parseo, posición cuando está disponible y latencia. No hay parsing tolerante, reparación de texto ni reconstrucción de salida. No se registra el texto en logs; se devuelve sólo al ejecutor autenticado. Credenciales conocidas se redactan defensivamente; no se incluyen API key, Authorization o token en evidencia.

El cliente conserva los diagnósticos en telemetría. JSON inválido no se reintenta, no se convierte en PROVIDER_UNAVAILABLE ni en BPS/BPD, no crea un Blueprint ni aumenta repair_count. Si falla el transporte de REPAIR se conserva revision 1, sin fabricar revision 2. Los mensajes de error Google 400 ya no se cortan a 500 caracteres.

Sólo se desplegó `plan-project-blueprint-v1-shadow`, versión 10, bundle SHA256 `e85cb2b80ef8ed362a27e7b8b09b64f960a26ad868e8d25cbf3bfb5fc1e52956`. Se mantuvo su autenticación propia expirable y configuración local deshabilitada. No se desplegó código productivo.

## Pruebas antes de la llamada real

**6/6 mocks PASS**, cubriendo A–G: parse exacto de JSON válido; error específico de JSON inválido; raw/finish/usage; sin retry ni reparación; límite y redacción de diagnóstico; representación de un Blueprint válido; rechazo autoritativo por contrato/Gate aunque transporte lo acepte; preservación de revision 1 si REPAIR falla en transporte. [Salida](evidence/transport-mocks.tap).

No se ejecutaron las 63 pruebas anteriores al inicio ni los 22 fixtures remotos.

## Única generación real y reparación

[Evidencia completa: fuentes, ambos Blueprints, Gate, revisión semántica, telemetría y diff](evidence/round2-generated-positive-1790193176957.json).

Las fuentes fueron exclusivamente TeacherConstraintsV1 + CurriculumSnapshotV1 + MethodologyDecisionV1. No se usaron sesiones heredadas. Hubo un GENERATE, cuatro focos de revisión, un REPAIR pedagógico y cuatro focos de revisión. Ningún error de transporte generó revisiones. No se hicieron generaciones adicionales.

| Revisión | JSON / dominio | Estado | Reglas deterministas fallidas |
|---|---|---|---|
| 1 | Válido / PASS | NEEDS_REPAIR | BPD-002, BPD-007, BPD-015, BPD-019, BPD-TIME |
| 2 | Válido / PASS | REJECTED | BPD-002, BPD-015, BPD-019, BPD-TIME |

La reparación corrigió BPD-007, pero no todos los incumplimientos. BPD-002 verifica texto oficial y grados; BPD-015, procedencia/producción única de artefactos; BPD-019, cobertura metodológica y sus vínculos; BPD-TIME, estimaciones por sesión. El presupuesto solicitado era 270 minutos; las once etapas suman 375 minutos en ambas revisiones. No se redujeron reglas para aprobarlo.

`repair_count=1`. La revision 2 conserva triggering_rules de los cinco fallos iniciales. El diff exacto conserva changed_field, previous_value y new_value; cambian revision, pda_analysis, project_stages y session_progression. Ambos candidatos están completos en la evidencia enlazada, sin edición pedagógica manual.

## Integridad de evaluación

Se comprobó assertContract(ProjectBlueprintV1) para ambos candidatos y la igualdad de hash entre candidato, Gate y revisión semántica sobre las mismas fuentes. [Verificación y resumen](evidence/transport-live-summary.json).

- Revision 1: Blueprint `735fdceddecb3f8108d9636aadbc93c05837b70e33f9a77af75a4071312686fe`; input semántico `222ba1412d954ec908c5fec36e9cef70b56aacea85c4d9c959af5270e70bda3f`.
- Revision 2: Blueprint `653eb9aa7f43f9b467dbe6533e767b2fade2c857e2f80c70ba17f771eeaa9690`; input semántico `ad293e0ca9eb1e1fb3f0b15baab992474a95ca23d7583702329b6832595b3cbe`.

No existe approved_blueprint_hash: no hubo APPROVED. Los candidatos permanecen DRAFT dentro de sus sobres de evaluación; no se modifica su contenido después de calcular hashes.

## Telemetría

```json
{
  "model": "gemini-3.5-flash-lite",
  "logical_calls": 10,
  "transport_attempts": 10,
  "tokens": 71888,
  "latency_ms": 108353,
  "provider_errors": [],
  "repair_count": 1
}
```

Diez llamadas lógicas y diez intentos HTTP, sin 400/429/503 ni JSON inválido en esta ejecución real. Latencia es suma de llamadas, incluidas esperas del limitador. Todos los inicios se sometieron a la cola global: máximo una llamada simultánea y al menos ocho segundos entre inicios. No se usó Pro ni 3.1.

## Falsos positivos y límites observados

El revisor semántico devolvió PASS en sus doce reglas para ambos candidatos, mientras el Gate determinista mantuvo el rechazo. En particular BPS-010 no detectó la incompatibilidad entre 375 minutos estimados y 270 disponibles: es una discrepancia real para revisión posterior, no evidencia de que el proyecto sea viable. No se modificó el reviewer en esta ronda de transporte ni se reejecutaron fixtures. Los 22/22 previos no garantizan aprobación de generación libre.

## Adversarial y cierre

El adversarial no se ejecutó: depende de un Blueprint APPROVED y ese requisito no se cumplió. Este rechazo de una generación positiva no se presenta como sustituto de la prueba adversarial.

Pruebas locales: la corrida completa anterior terminó con 67/69 PASS; se conserva intacta en [transport-full-tests.tap](evidence/transport-full-tests.tap). Las dos expectativas antiguas trataban fallos de transporte como NEEDS_REPAIR y una contaba reparación sin candidato. Se actualizaron únicamente esos mocks: REVIEW válido antes de simular fallo REPAIR, código operativo explícito y repair_count=0. Se ejecutaron sólo las dos pruebas pendientes: **2/2 PASS**, evidencia en [transport-pending-tests.tap](evidence/transport-pending-tests.tap). Por tanto las 69 pruebas quedan resueltas entre la corrida conservada y la comprobación focalizada; no se afirma una nueva corrida completa 69/69. No hubo cambios adicionales al código de ejecución durante este cierre.

La evidencia original de generación no se modificó. [Diff revision 1 → revision 2 y SHA256 del archivo original](evidence/transport-revision-diff.json). En la reanudación sólo se recuperaron cambios, se cerraron las dos pruebas pendientes y se preparó el respaldo; cero llamadas a Gemini, fixtures remotos, generaciones, reparaciones o adversariales nuevos.

Producción, main, PR #3, PR #4, autenticación productiva e historial no se modificaron. No se realizaron auditorías productivas adicionales. SessionGraph no se inició. Se detiene para revisión; la siguiente fase pendiente es corregir la generación contra los fallos observados, sin rebajar el Gate. La entrega anterior con 22/22 permanece en [DELIVERY-PRE-TRANSPORT.md](DELIVERY-PRE-TRANSPORT.md).
