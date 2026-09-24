# Multiplan — separación de contrato local y schema Gemini

**NO LISTA.** La única generación positiva nueva volvió a recibir **400 INVALID_ARGUMENT**. No existe Blueprint evaluable, APPROVED ni adversarial en esta ronda. Se conservó evidencia durable y no se hizo una segunda llamada.

Rama: `project-blueprint-v1-shadow`. Base publicada: `e596ef85db7f777b8c11aa8959c9be6f1c27720d`. [Entrega previa](DELIVERY-PRE-SCHEMA-COMPATIBILITY.md).

## Investigación local del request histórico

Request `fb77d3bf-aafe-4a7f-afab-85ab36512332`: se usaron sus fuentes/plan y el código respaldado para recrear offline el prompt y response_schema. No se envió HTTP; fetch fue un mock. La huella coincidió exactamente con la telemetría histórica:

`9f8eb51d69ad127284ea68b742d839e9de27bf7e04a2df1ed9d4633aa6b285b0`.

La evidencia durable anterior guardaba la respuesta y el hash, no todo el request. Por ello se distingue esta recreación verificable de una captura de red. [Request efectivo histórico](evidence/schema-400-effective-request.json).

El schema tenía **70 apariciones de maxLength** añadidas por authoringSchema después de la reducción del transport schema. La [referencia oficial de GenerationConfig](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig) enumera el subset de responseJsonSchema y no incluye maxLength ni minLength. Sí incluye additionalProperties, anyOf, enums, minimum/maximum, minItems/maxItems y referencias.

**Conclusión causal limitada:** se demostró que enviábamos una restricción fuera del subset documentado. No se demostró que fuera la causa única ni suficiente del 400; al retirarla, el error persistió. No se presenta la hipótesis inicial como causa definitivamente resuelta.

## Cambios exclusivamente en transporte

Nuevo `provider-schema.mjs`:

- `providerResponseSchema` clona el contrato y elimina maxLength/minLength únicamente del schema enviado a Google. Cualquier keyword inesperada distinta de esas dos falla explícitamente; no se borra en silencio.
- `assertProviderSchema` recorre propiedades, definiciones, items, alternativas, prefixItems y additionalProperties. Distingue nombres de campos de keywords; un campo llamado maxLength no se confunde con la restricción.
- Error de guard: `PROVIDER_SCHEMA_UNSUPPORTED_KEYWORD`, con `keyword` y ruta JSON concreta.
- El guard se ejecuta antes del limitador/fetch, por tanto antes de consumir cuota del proveedor.
- La versión efectiva de transporte queda registrada como `GEMINI_JSON_SCHEMA_SUBSET_V1`.

**LOCAL AUTHORING CONTRACT intacto:** support_need conserva 1.200 caracteres; otros textos conservan 4.000. El exceso sigue arrojando `AUTHORING_FIELD_EXCESSIVE_LENGTH`. No se trunca ni se reescribe. No cambió `authoring-proposal.mjs`, `construction.mjs`, ProjectBlueprintV1 ni el Gate.

Diff del intento histórico GENERATE frente al schema proyectado:

| Elemento | Cambio |
|---|---|
| maxLength | Se retiran 70 instancias sólo del provider schema |
| minLength | No aparecía en este GENERATE; ninguna instancia retirada |
| shape / properties / required | Idénticos |
| enums / refs / nullabilidad | Idénticos |
| arrays / minItems / maxItems | Idénticos |
| minimum / maximum / additionalProperties | Idénticos |
| Contrato local de autoría | Sin modificación |

[Diff completo con las 70 rutas](evidence/schema-compatibility-diff.json).

El guard detectó además minLength en el schema del revisor. La primera prueba focalizada falló por esa detección esperada del nuevo guard y se conservó [su salida](evidence/schema-guard-initial-discovery.tap). Se proyecta también minLength fuera del transporte REVIEW, conservando el schema local, el prompt del revisor y su lógica BPS. Esto no modifica las reglas pedagógicas. No se ejecutó REVIEW real en esta ronda porque la generación falló antes.

## Pruebas focalizadas

**12/12 PASS** antes de Gemini: límites locales presentes; provider sin maxLength; igualdad de todos los demás valores del schema; guard con ruta/keyword, incluso en definiciones; preservación de refs, enums y arrays; rechazo de nuevas keywords desconocidas; límites y compiler existentes; igualdad completa del Blueprint sintético con el dominio esperado; protocolo durable y detención ante fallo determinista.

[Salida focalizada](evidence/schema-compatibility-focused.tap). No se ejecutaron los 22 fixtures remotos ni la suite 92/92 al inicio.

## Única generación real nueva

Modelo: **gemini-3.5-flash-lite**, Authoring Proposal compacto, persistencia durable existente. Sin probe separado ni fallback. Configuración: temperature=0.15, maxOutputTokens=65536 diagnóstico, responseMimeType=application/json, responseJsonSchema proyectado. REVIEW conserva su máximo de 22000.

Request: `ac4df1f3-1009-4cae-9e46-c8dcb9798876`.

| Métrica | Resultado |
|---|---|
| Llamadas lógicas / intentos Google | 1 / 1 |
| HTTP Google | 400 |
| provider_error_status | INVALID_ARGUMENT |
| provider_message completo | Request contains an invalid argument. |
| Latencia proveedor | 588 ms |
| Latencia cliente, con persistencia/polling | 12223 ms |
| candidate / text_length | vacío / 0 |
| finish_reason / usageMetadata | null / null |
| Prompt / output / total tokens | No reportados |
| 429 / 503 | Ninguno |
| Revisiones / repair_count | 0 / 0 |

[Resultado y telemetría](evidence/construction-positive-1790226815919.json), [plan](evidence/construction-positive-plan-1790226815919.json), [respuesta cruda durable](evidence/provider-durable/ac4df1f3-1009-4cae-9e46-c8dcb9798876-received.json), [parse/metadata](evidence/provider-durable/ac4df1f3-1009-4cae-9e46-c8dcb9798876-parsed.json), [resultado durable](evidence/provider-durable/ac4df1f3-1009-4cae-9e46-c8dcb9798876-result.json).

## Inspección restante tras el 400

Se recreó también offline el request nuevo; coincide con su hash registrado:

`b30253078fbff27af16a47d0bb853d8671a4428f05267da65f4bcb8cd481e868`.

[Schema/configuración efectivos y revisión local](evidence/schema-compatible-effective-request.json). Se verificaron 121 nodos, 23 valores de enum y profundidad máxima 5. No quedaron keywords fuera del subset, campos required inexistentes ni minItems mayores que maxItems. No hay $ref en este schema. El máximo diagnóstico coincide con el límite de salida publicado en la [ficha oficial del modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

**Siguiente incompatibilidad concreta: no identificada con la evidencia disponible.** La respuesta Google sólo incluye code/message/status y no señala campo, keyword o límite excedido. La admisión de keywords no garantiza que el decodificador acepte la complejidad/combinación concreta del schema. Tampoco queda probado que la complejidad sea la causa. Se conserva el request para una investigación futura acotada; no se hacen llamadas adicionales ni cambios especulativos a sus reglas.

## Contract / Gate / BPS / adversarial

Sin candidato: autoría, compileAuthoring, Domain Contract, Gate determinista y semántico no se ejecutaron sobre una nueva salida real. No hay aprobado/hash; no hubo reparación ni adversarial. Este 400 se mantiene como error operativo de solicitud, no como rechazo pedagógico ni falso negativo BPS. No se fabrica un PASS a partir de los mocks.

## Cierre

**Suite local completa final: 96/96 PASS, 0 fallos, 0 omitidas, 56,34 segundos.** Evidencia en [schema-compatibility-final.tap](evidence/schema-compatibility-final.tap), una sola corrida final después de los cambios.

No se modificaron producción, main, PR #3, PR #4, autenticación productiva, datos de usuarios, contratos de dominio, construction compiler, Gate ni reglas del revisor. No se redeplegó la Edge Function ni se cambió el almacenamiento durable: se usaron los ya existentes. Sólo se añadieron objetos de evidencia del intento autorizado. SessionGraph no iniciado.

Se detiene después del commit/push. PROJECTBLUEPRINT_V1_VALIDATION sigue pendiente.
