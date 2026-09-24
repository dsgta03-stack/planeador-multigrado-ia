# Multiplan — compactación conectada y evidencia durable

**NO LISTA. PROJECTBLUEPRINT V1 todavía no está validado.** La única generación positiva de esta ronda devolvió **400 INVALID_ARGUMENT** antes de producir un candidato. No hubo reparación ni adversarial. Se conservó la respuesta real completa; no se hizo una segunda generación.

Rama exclusiva: `project-blueprint-v1-shadow`. Checkpoint de compactación publicado antes de continuar: `d92bf7b5e06c5bb555f27ce19762d92f71e9e6fe`. [Entrega del checkpoint](DELIVERY-COMPACTION-CHECKPOINT.md).

## Recuperación y checkpoint

Se conservaron todos los cambios del worktree. La suite anterior había terminado correctamente: 85/85 PASS, incluidas las seis pruebas de compactación. Se publicó el checkpoint con auditoría, implementación inicial offline, documentación e incidencia de la respuesta perdida. No se reconstruyó ni repitió aquella llamada. El intento posterior descrito aquí corresponde a la autorización nueva de `Pegado text(3).txt`.

Los 22/22 fixtures remotos homogéneos permanecen históricos, con reviewer `LOCAL_EVIDENCE_V1_LITERAL_QUOTES_R2`, sin reejecutarlos. No se tocaron sus resultados, el dominio ni BPD/BPS.

## Persistencia durable

La función **shadow aislada**, versión 13, usa el bucket privado `multiplan-blueprint-shadow-evidence-v1`. No se añadieron políticas públicas ni permisos para usuarios. La comprobación limitada de políticas de Storage encontró cero políticas; el bucket se verificó privado. No se accedió a tablas de usuarios/historial ni se cambió autenticación productiva.

Flujo implementado:

1. Registrar request ID, tarea, modelo, máximo configurado y huella de entrada, sin credenciales.
2. Iniciar trabajo independiente de la conexión de Work mediante `EdgeRuntime.waitUntil`; devolver 202 al cliente.
3. Al recibir Google, guardar **received.json**, con respuesta cruda y metadatos, **antes de parsear el envelope o el candidate text**.
4. Parsear estrictamente y guardar **parsed.json** con candidate text, finish reason, usage/tokens, longitud, resultado/error de parseo y latencia.
5. Guardar **result.json** sin sobrescribir los objetos anteriores. El cliente consulta ese resultado; estas consultas no llaman a Gemini.
6. Copiar la evidencia al worktree con escritura exclusiva y fsync antes de devolver el resultado al evaluador.

El cuerpo de autorización y las claves no se serializan; los secretos conocidos se redactan de la evidencia. El cliente nunca recibe la service key. La función no permite leer rutas arbitrarias: sólo IDs y partes predefinidas del bucket shadow. La ruta conserva autenticación shadow propia y caducidad; no acepta sesiones de usuarios.

Las pruebas cubren orden de persistencia, JSON inválido, MAX_TOKENS, fallo posterior del Gate, fallo de escritura que impide continuar el parser, referencias/rutas privadas, ausencia de secretos y flujo de polling sin nuevas generaciones.

Limitación explícita: no existe garantía absoluta ante caída simultánea de Google/runtime/Storage antes de recibir la respuesta. En ese caso el request durable queda pendiente y no se inventa resultado ni se reenvía automáticamente una petición de resultado incierto. Esta ronda sí verificó los cuatro objetos remotos y su orden temporal. [Verificación](evidence/durable-storage-verification.json).

## Authoring Proposal compacto conectado

`BLUEPRINT_AUTHORING_COMPACT_V1` está conectado mediante opción explícita del runner a GENERATE y REPAIR. El revisor no cambió. [Propiedad de campos y diseño](AUTHORING.md).

- El proveedor escribe decisiones pedagógicas: interpretación, pregunta, aportaciones, acción observable, evidencia, criterios, estados conceptuales y estimaciones.
- El compilador completa invariantes y fuentes: PDA/grado/texto oficial exactos, hashes, catálogo, DAG, metadatos de artefactos, integración y presupuesto.
- Los IDs de grado y número de sesión se conservan como referencias mínimas para elegir la unidad de autoría, no como datos oficiales que el modelo pueda reasignar libremente.
- La matriz referencia evidencia ya redactada en la etapa. No se inventa pedagogía ni se aprueba mediante etiquetas.
- support_need admite hasta 1.200 caracteres y los otros textos hasta 4.000 por valor. Exceso produce `AUTHORING_FIELD_EXCESSIVE_LENGTH`; no hay truncado silencioso ni corrección de JSON. Es una restricción de autoría, no una regla BPS.
- Un fallo determinista con constructionPlan detiene el flujo **antes** de revisión semántica o reparación. La aprobación sigue requiriendo los Gates originales y mismo hash.

Las seis pruebas de compactación se volvieron a ejecutar únicamente porque hubo cambios de integración/errores en ese módulo, junto con cinco pruebas nuevas de persistencia. Pasaron 11/11. Dos pruebas focalizadas adicionales de integración pasaron 2/2. [Persistencia y compilador](evidence/durable-focused-tests.tap), [integración](evidence/durable-integration-tests.tap).

## Única generación real de esta ronda

Modelo exclusivo: **gemini-3.5-flash-lite**. Máximo de salida diagnóstico: **65536** sólo para GENERATE/REPAIR; REVIEW permanece en 22000. No se activó otro modelo ni fallback.

[Fuentes sintéticas, plan y resultado](evidence/construction-positive-1790225796420.json). [Plan previo](evidence/construction-positive-plan-1790225796420.json).

Request ID: `fb77d3bf-aafe-4a7f-afab-85ab36512332`.

| Métrica | Resultado |
|---|---|
| Llamadas lógicas GENERATE | 1 |
| Intentos de transporte a Google | 1 |
| HTTP de Google | 400 |
| Estado del proveedor | INVALID_ARGUMENT |
| Mensaje completo | Request contains an invalid argument. |
| Latencia Google | 533 ms |
| Latencia cliente, incluido almacenamiento/polling | 12236 ms |
| finish_reason | null: no candidate |
| usageMetadata / prompt / output / total tokens | null: no reportados |
| Candidate text / longitud | vacío / 0 |
| 429 / 503 | Ninguno |
| Revisiones / repair_count | 0 / 0 |

Evidencia: [recepción previa al parseo](evidence/provider-durable/fb77d3bf-aafe-4a7f-afab-85ab36512332-received.json), [diagnóstico](evidence/provider-durable/fb77d3bf-aafe-4a7f-afab-85ab36512332-parsed.json), [resultado durable](evidence/provider-durable/fb77d3bf-aafe-4a7f-afab-85ab36512332-result.json).

Este 400 no permite identificar cuál argumento rechazó Google. La compatibilidad real del nuevo schema de autoría y configuración diagnóstica queda pendiente. No se atribuye la causa a un keyword concreto sin evidencia, ni se elimina el schema para probar otra generación. Los mocks validan nuestro código, no la aceptación del schema por Google.

## Contract, Gate, reparación y adversarial

- Authoring validation / compiler / Domain Contract sobre esta generación: no ejecutados, falta candidato.
- Gate determinista y semántico: no ejecutados.
- Blueprint APPROVED y approved_blueprint_hash: no obtenidos.
- Reparación pedagógica: ninguna; error de proveedor no incrementó repair_count.
- Adversarial preparado: no ejecutado, requiere APPROVED real previo.
- No hay nuevos falsos positivos/negativos pedagógicos observables: no se confundió el 400 con rechazo del proyecto.

## Tamaño: antes y después

La [auditoría histórica](evidence/blueprint-size-audit.md) conserva todas las medidas del prefijo real anterior; no fue regenerada para fabricar una comparación favorable.

| Métrica | Antes: respuesta inflada histórica | Después: intento compacto actual |
|---|---:|---|
| Output tokens | 21983 | No reportados |
| Caracteres del candidato | 137608 reportados, 100000 conservados | Sin candidato |
| Mayor campo observado | support_need, al menos 89698 caracteres | No evaluable |
| Repetición | Secuencia de 12 palabras: 88 repeticiones | No evaluable |
| Reducción de tokens/caracteres | — | No calculable |

El hallazgo histórico es repetición descontrolada dentro de support_need; no se demuestra que el tamaño normal del Blueprint requiera decenas de miles de tokens. El motivo interno de la repetición del modelo es desconocido. La preservación de información pedagógica se comprobó con igualdad completa de candidatos sintéticos, no con un nuevo Blueprint real. No se declara reducción real ni calidad semántica a partir de esos mocks.

## Cierre y pendientes

**Suite local completa final: 92/92 PASS, 0 fallos, 0 omitidas; 56,32 segundos.** Evidencia en [durable-final-local-tests.tap](evidence/durable-final-local-tests.tap). Esta es la única corrida completa después de los cambios nuevos; la corrida 85/85 corresponde al checkpoint previo pedido por la instrucción.

Pendiente: resolver de forma acotada la compatibilidad del contrato de autoría con Google, después obtener APPROVED real y ejecutar el adversarial preparado. No se hizo otra generación para investigar el 400 en esta sesión.

Producción, main, PR #3, PR #4, datos/historial de usuarios, autenticación productiva, ProjectBlueprintV1, Gate BPD/BPS y reviewer permanecen sin cambios. Sólo se actualizó la función shadow y se creó su almacenamiento privado de evidencia. SessionGraph no iniciado.
