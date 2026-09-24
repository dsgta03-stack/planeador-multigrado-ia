# Multiplan — máximo diagnóstico y autoría compacta

**NO LISTA. No se obtuvo un APPROVED verificable; adversarial no ejecutado.** Referencia remota: `9662228ee26a5049f20ca93faca985a297e9f5cb`, rama exclusiva `project-blueprint-v1-shadow`.

## A. Único intento con máximo temporal

El límite de salida de Gemini 3.5 Flash-Lite se confirmó en la [documentación oficial](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite): 65.536 tokens. Se habilitó sólo con opción diagnóstica explícita para GENERATE/REPAIR; el valor normal y REVIEW continúan en 22.000. La función aislada shadow fue actualizada a versión 12. Producción y su autenticación no se modificaron.

Dos pruebas dirigidas pasaron antes del intento: selección del máximo por tarea/modelo y preservación del diagnóstico MAX_TOKENS como BLUEPRINT_OUTPUT_BLOAT, sin convertirlo en fallo pedagógico. [Resultados](evidence/output-budget-tests.tap).

Se inició una sola ejecución de `run-construction.mjs positive`, con Gemini 3.5 Flash-Lite y opción diagnóstica. Quedó guardado el [plan previo](evidence/construction-positive-plan-1790217326541.json). La revisión automática de aprobación rechazó el seguimiento del proceso por considerar no establecida la autorización de divulgación al endpoint Supabase/proveedor. Se comprobó después que el runner usa fuentes sintéticas del fixture y el endpoint aislado; el proceso ya no estaba disponible y no dejó el archivo esperado de respuesta.

**Resultado: DIAGNOSTIC_RESULT_UNAVAILABLE.** No se puede confirmar si Google terminó, qué respuesta emitió ni cuánto consumió. No se reconstruyen telemetría o revisiones inexistentes. No se inició otra generación para sustituirla. [Incidencia completa](evidence/output-diagnostic-incident.json).

| Métrica del intento diagnóstico | Valor verificable |
|---|---|
| Invocaciones nuevas del runner | 1 |
| Modelo / máximo configurado | gemini-3.5-flash-lite / 65536 |
| Intentos de transporte realmente realizados | Desconocidos |
| provider_status / finish_reason | Desconocidos |
| Prompt / output / total tokens | Desconocidos |
| Caracteres / latencia | Desconocidos |
| 429 / 503 | Sin respuesta disponible; no se puede determinar |

La política de concurrencia, separación entre llamadas y reintentos operativos permanece intacta. El código no reintenta contenido inválido/MAX_TOKENS. No se usaron Gemini 3.1 ni Pro.

## B. Positive Blueprint

No existe un nuevo candidato recuperado que pueda validarse, ni hash aprobado. No se atribuye PASS al dominio, deterministas o semántica de este intento. Las revisiones y los resultados históricos permanecen intactos. Los 22/22 históricos homogéneos y el reviewer LOCAL_EVIDENCE_V1_LITERAL_QUOTES_R2 no se volvieron a ejecutar ni modificar.

## C. Adversarial

No ejecutado: requiere un APPROVED real previo. PROJECTBLUEPRINT_V1_VALIDATION continúa pendiente; los mocks no cierran la validación pedagógica.

## D. Auditoría de tamaño sin llamadas

Se analizó la **última respuesta real disponible**, `construction-positive-1790208014571.json`, histórica, con límite 22.000. No es la respuesta del intento de esta ronda.

| Métrica histórica disponible | Valor |
|---|---:|
| provider_status | 200 |
| finish_reason | MAX_TOKENS |
| promptTokenCount | 6434 |
| candidatesTokenCount | 21983 |
| totalTokenCount | 28417 |
| Caracteres reportados | 137608 |
| Caracteres conservados | 100000 |
| Latencia proveedor, ms | 51621 |

El analizador léxico mide el prefijo conservado sin reparar JSON ni reconstruir un Blueprint. Tamaños de nodos incompletos son mínimos observados; contenedores incluyen hijos y no deben sumarse con ellos. La cola de 37.608 caracteres no está disponible.

| Principal campo/array | Caracteres observados | Observación |
|---|---:|---|
| grade_contributions[0].support_need | 89698 | Campo incompleto, MODEL_OWNED |
| final_outcome.functional_requirements | 2943 | Array completo de requisitos pedagógicos |
| pda_analysis | 2429 | Array completo |
| pda_analysis[1].cognitive_interpretation.official_text_basis | 185 | Base textual elegida para interpretar el PDA |
| final_outcome.description | 178 | Descripción pedagógica |

El campo support_need contiene una secuencia de doce palabras repetida **88 veces**. Esto demuestra repetición descontrolada en un campo; no justifica atribuir todo el volumen a la cantidad de campos del contrato. Es el 89,7% del prefijo observado, no del total original.

[Auditoría legible](evidence/blueprint-size-audit.md) y [todas las rutas, clases, duplicados y conteos](evidence/blueprint-size-audit.json). Artefactos, criterios de etapas y estados before/after que quedaron fuera del prefijo no pueden medirse. Su desconocimiento no se registra como ausencia o tamaño cero.

## E. Diseño e implementación inicial de compactación

[Diseño y propiedad de campos](AUTHORING.md). Módulo nuevo `authoring-proposal.mjs`, **offline y no habilitado en el runner vivo**:

- Gemini conserva propósito, problema interpretado, pregunta, operaciones, evidencia, criterios, contribuciones diferenciadas, estimaciones y progresión conceptual.
- El compilador copia fuentes/hashes, metodología, textos oficiales/grados y problema original; deriva identidad de contribuciones, cierre/secuencia y los metadatos ya protegidos por constructionPlan.
- La matriz referencia evidencia de la etapa por campo/índice; no vuelve a redactarla. La cita de acción permanece literal para conservar trazabilidad. El compilador no interpreta esas citas como aprobación pedagógica.
- La propuesta impide campos adicionales y rechaza suplantaciones de metadatos. Se comprueba que el plan corresponda exactamente a las fuentes.
- Instrucción de autoría concreta sin ensayos. Límites iniciales de propuesta: support_need 1.200 caracteres; otros textos 4.000 por valor. El compilador rechaza exceso sin truncar ni corregir. Estos límites no alteran ProjectBlueprintV1 ni el Gate.
- El resultado debe pasar `assertContract(ProjectBlueprintV1)` completo y posteriormente los Gates originales. No se fabrica un APPROVED.

Seis pruebas sintéticas nuevas pasaron: igualdad del Blueprint compilado completo frente al caso sintético de referencia; copia exacta PDA/grado; DAG y once operaciones en tres etapas; tiempo; conservación literal de pedagogía/estados; rechazo de referencias inventadas, campos autoritativos y texto excesivo. [Resultados](evidence/authoring-proposal-tests.tap).

No se afirma ahorro de tokens medido con Gemini ni calidad pedagógica real de la propuesta compacta. La reducción de tamaño y equivalencia comprobadas son locales/sintéticas. No hubo llamadas al modelo en esta fase.

## F. Verificación final y pendientes

**Única suite local completa de cierre: 85/85 PASS, 0 fallos, 0 omitidas.** Duración: 56,26 segundos. Las 77 pruebas previas se ejecutaron sólo en esta corrida final, junto con 2 pruebas diagnósticas y 6 de compactación. [Salida completa](evidence/authoring-final-local-tests.tap).

Pendiente para una autorización posterior: recuperar o repetir explícitamente el diagnóstico que no dejó respuesta; integrar/validar la propuesta compacta con el proveedor; obtener un Blueprint positivo APPROVED con hash verificado y después rechazo adversarial apropiado. No se deben mezclar los resultados sintéticos o históricos para declarar cierre real.

No hay nuevos falsos positivos/negativos pedagógicos medibles en esta ronda: falta respuesta evaluable. El rechazo por tamaño del contrato de autoría es operativo/estructural y no un BPD/BPS. Su límite inicial necesita validación futura de suficiencia pedagógica.

Producción, main, PR #3, PR #4, historial, autenticación productiva, schemas de dominio, Gate BPD/BPS y revisor no se modificaron. Única intervención remota de ejecución: función shadow aislada versión 12. SessionGraph no iniciado. [Entrega anterior preservada](DELIVERY-PRE-AUTHORING.md).
