# ProjectBlueprint V1 — construcción determinista previa

**NO LISTA. Implementación local 77/77 pruebas; única generación nueva no produjo JSON evaluable.** No existe APPROVED y no se ejecutó adversarial. No se modificaron Gate, BPD/BPS, contratos de dominio ni revisor semántico.

Rama `project-blueprint-v1-shadow`, referencia `1d3612cdfb86356478351b5bd37222993b9a3894`. Modelo exclusivo Gemini 3.5 Flash-Lite. Los 22/22 históricos permanecen respaldados y no se repitieron. Tampoco se reevaluaron las revisiones históricas.

## Causas verificadas en revision 2 histórica

- BPD-002: Gemini escribió «Indagación acerca» donde CurriculumSnapshotV1 dice «Indaga acerca» para F4-DHC-3-001. Primero conservaba el texto exacto.
- BPD-015: sólo art_acercamiento, art_integracion y art_terminal tenían sesión productora. Faltaban art_identificacion, art_recuperacion, art_planificacion, art_produccion, art_reconocimiento, art_concrecion, art_difusion y art_consideraciones.
- BPD-019: las operaciones de esas etapas no tenían un vínculo válido con su sesión productora; no era simplemente ausencia de etiquetas.
- BPD-TIME: 375 minutos estimados frente a 270 disponibles. BPD-007 ya estaba corregido y no se reabrió.

## Cambios y razón

[Construcción y límites detallados](CONSTRUCTION.md).

1. construction.mjs crea PDA bindings exactos, matriz de cobertura, DAG y presupuestos antes de la llamada. Para este caso, las tres fases oficiales de Proyectos Comunitarios forman tres paquetes de trabajo con propósito, sin exigir once etapas ni repartir operaciones por índice. Cada sesión dispone de hasta 90 minutos y el total es 270. No se utiliza porcentaje artificial.
2. El schema de solicitud omite los campos autoritativos que no debe redactar el modelo. Gemini diseña la pedagogía y aporta una cita de acción y evidencia por cada operación; el compilador copia textos/grados del snapshot y deriva las listas de artefactos/operaciones antes de crear el candidato de dominio.
3. Los minutos y el contenido pedagógico no se reescriben ni se escalan. Citas ausentes, asignaciones inválidas o exceso temporal se rechazan antes del Gate. Las citas sólo prueban trazabilidad; la revisión semántica conserva la responsabilidad de juzgar su significado.
4. Se guardan el plan previo y las propuestas crudas; una construcción válida conserva su huella y la del plan. No se trata de editar manualmente una salida del Gate.
5. Con esta política activada, cualquier fallo determinista restante detiene el flujo sin usar reparación. Sólo un fallo semántico real en un candidato determinísticamente válido puede consumir la reparación permitida.
6. run-construction.mjs exige el modelo 3.5 explícito, guarda el plan antes de llamar y exige un APPROVED real para habilitar el adversarial.

Alcance limitado: la política actual soporta Proyectos Comunitarios con tres sesiones y el adversarial de una sesión. No se presenta como solución genérica para todos los métodos/números de sesiones. Las demás combinaciones se rechazan explícitamente. No es SessionGraph ni una planeación.

## Pruebas

Ocho comprobaciones dirigidas pasaron antes de Gemini: texto y grado oficiales exactos; PDA de otro grado; inputs futuros o de la misma sesión; producción/IDs duplicados; once operaciones en tres etapas; acción/evidencia literal; presupuestos por sesión/global sin escalado; y las cuatro reglas del Gate original sobre una construcción sintética.

Evidencias: [siete mocks](evidence/construction-mocks.tap) y [comprobación con Gate](evidence/construction-gate-test.tap). Estos mocks no equivalen a aprobación pedagógica real.

**Suite local completa final: 77/77 PASS, 0 fallos, una sola corrida**: [salida](evidence/construction-full-tests.tap). No se ejecutaron los 22 fixtures remotos ni una revisión semántica histórica.

## Única generación real

El primer acceso devolvió 403 SHADOW_DISABLED antes de alcanzar Google: el acceso shadow estaba caducado. Se conservó [ese intento](evidence/construction-positive-1790207970244.json) y su plan. Se renovó exclusivamente la configuración expirable de la función shadow (versión 11), con el mismo código de transporte. No se cambió autenticación productiva.

[Plan enviado a la única llamada real](evidence/construction-positive-plan-1790208014571.json).

[Respuesta real, fragmento crudo preservado, fuentes y telemetría](evidence/construction-positive-1790208014571.json).

Resultado: PROVIDER_OUTPUT_INVALID_JSON, provider_status=200, finish_reason=MAX_TOKENS. La cadena llegó incompleta: el parser reportó una cadena sin terminar en posición 137608. El proveedor informó 137608 caracteres; por el límite de observabilidad vigente se conservan los primeros 100000 y text_truncated=true. Los 37608 restantes no están disponibles en la evidencia y no se reconstruyeron.

No hubo Blueprint de dominio, ejecución de Gate, revisión semántica ni reparación pedagógica de este candidato. Revisions=[], repair_count=0. No se hizo una segunda llamada de generación a Google. El fallo no se presenta como BPD/BPS ni como incumplimiento demostrado de las cuatro invariantes; la prevención sólo tiene validación local hasta ahora.

## Telemetría

```json
{
  "google_calls": 1,
  "google_transport_attempts": 1,
  "preceding_shadow_403_calls": 1,
  "finish_reason": "MAX_TOKENS",
  "text_length": 137608,
  "retained_candidate_characters": 100000,
  "client_latency_ms": 62121,
  "latency_ms": 51621,
  "usage": {
    "promptTokenCount": 6434,
    "candidatesTokenCount": 21983,
    "totalTokenCount": 28417,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 6434
      }
    ],
    "serviceTier": "standard"
  },
  "repair_count": 0
}
```

[Resumen completo](evidence/construction-round-summary.json). Sin 429/503. No hubo retries a Google. Se mantuvo máximo una llamada simultánea y separación mínima de ocho segundos. No se usó Gemini Pro ni 3.1.

## Estado final

- APPROVED completo/hash: no obtenido.
- Nueva revision 1/revision 2: no existen candidatos parseados en esta ronda. Las dos revisiones históricas permanecen intactas.
- Adversarial: no ejecutado, falta APPROVED previo.
- Falsos positivos/negativos: no se puede medir el nuevo diseño con una salida que no llegó a parsearse. No se declara éxito pedagógico a partir de los mocks.
- Producción, main, PR #3, PR #4, historial, contratos/Gate y autenticación productiva: no modificados. Sólo se renovó el acceso expirable shadow.
- SessionGraph: no iniciado.

Se detiene tras guardar y publicar esta evidencia. El bloqueo observado para la próxima revisión es el agotamiento de salida durante la única generación; no se incrementaron límites ni se hicieron reintentos ciegos. [Entrega anterior](DELIVERY-PRE-CONSTRUCTION.md).
