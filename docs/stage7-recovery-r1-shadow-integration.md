# MULTIPLAN — Recovery Stage 7 → Consolidation R1 (shadow-only)

Estado: **propuesta aislada; sin conexión al pipeline ni despliegue a producción**.  
Base de implementación: `consolidation-single-app-r1`.  
Laboratorio independiente: proyecto Supabase `uttzuegoegquowakyfoh` (`MULTIPLAN-LAB`).  
Producción: **no tocar**.

## Evidencia observada en laboratorio (24 nov 2026 UTC)

Resultados comunicados por la prueba web autenticada, seguidos de inspección independiente de PostgreSQL:

| Puerta | Resultado | Garantía comprobada |
|---|---|---|
| `STAGE7_DB_PROBE_PASS` | PASS | Rol ejecutor y transacción privada |
| `STAGE7_BINDINGS_PROBE_PASS` | PASS (16/16) | Fuentes, hashes y versiones recibidos como objetos JSON |
| `STAGE7_WORKER_SMOKE_PASS` | PASS | Escritura y lectura con aislamiento entre dos docentes |
| `STAGE7_ADVERSARIAL_CONCURRENCY_PASS` | PASS | Carrera por lease, fencing, rechazo de reenvío obsoleto |
| `STAGE7_LEASE_UNKNOWN_PASS` | PASS | Lease vencido, nuevo fence, ACK HTTP perdido simulado |
| `STAGE7_PENDING_UNKNOWN_PASS` | PASS | Revisión WORKED PENDING duradera y rechazo de nuevo request_id |

Verificación del último cierre: **5 intentos, 4 checkpoints, 1 operación WORKED/PENDING, 1 request_id único, 0 hashes SHA-256 incorrectos**. Edge Function de laboratorio v18 activa con verificación JWT. La pérdida de ACK fue **simulada**, no una caída de red ni un fallo real de Gemini.

## Fuente de verdad y componentes actuales

La consolidación R1 ya incluye:

- `shadow/pipeline-v1/pipeline.mjs`: ProjectComposition → ProjectBlueprint → SessionGraph y auditorías de sesión.
- `lib/v0125/unified-preview-orchestrator.mjs`: transforma en ciclo canónico **solo** cuando el pipeline entrega `READY_FOR_TEACHER`.
- `lib/v0125/pipeline-canonical-bridge.mjs`: exige Blueprint y SessionGraph aprobados, con hashes correspondientes.
- `supabase/functions/plan-project-blueprint-v1-shadow/durable-response.mjs`: evidencia recibida/parseada de transporte, no un checkpoint integral de sesiones.

No se debe integrar recuperación introduciendo otro router, otro wrapper de interfaz, un segundo plan canónico ni sustituyendo un gate curricular.

## Cambio propuesto en esta rama

`shadow/recovery-v1/decision.mjs` es un guard **puro, síncrono y sin efectos**. Recibe el estado recuperado desde un adaptador **autenticado y de confianza**, el contexto original inmutable y las operaciones duraderas pertenecientes al mismo intento. Verifica:

- revisión, SHA-256 del texto persistido y digest interno;
- identidad del docente, run, fuentes exactas, versiones y vinculaciones;
- estructura mínima y hashes de Blueprint/SessionGraph/ProjectComposition;
- `PENDING`, `ACCEPTED`, `FAILED` y `COMPLETED` para WORKED/METHODOLOGY/FUNCTIONAL;
- relación exacta entre request_id, familia, input_hash y registro duradero.

**Ningún resultado del módulo autoriza invocar un proveedor directamente** (`provider_call_allowed: false`). Una operación `PENDING` después de un ACK ambiguo se bloquea con `RECONCILE_SAME_REQUEST_ID_NO_AUTOMATIC_RETRY`. Un `FAILED` confirmado con estado recuperable requiere un **registro nuevo bajo el fencing SQL**, no un reenvío automático. Un snapshot válido solo pasa a *revalidación curricular*; nunca se convierte automáticamente en `READY_FOR_TEACHER`.

## Integración posterior — no implementada en esta rama

1. Crear adaptador servidor que, después de Supabase Auth y RLS, consulte estado y operaciones duraderas con `run_id`, `owner_id`, `sources`, `bindings`, `versions` verificables; nunca confiar en IDs/roles declarados por el navegador.
2. Conectar un único punto de pausa/reanudación a `shadow/pipeline-v1/pipeline.mjs` **antes** de cada despacho al proveedor. Registrar un `PENDING` *antes* de enviar la solicitud y persistir el resultado de forma duradera *antes* de acusar éxito.
3. Asegurar que `UNKNOWN` o pérdida de acuse solo permiten reconciliar el **mismo request_id**, sin un segundo envío en la incertidumbre. En caso de `FAILED` confirmado, respetar los invariantes de `append_state` y `p_allow_retry`.
4. Tras recuperar una sesión, volver a ejecutar gates exactos (PDA, WORKED, Blueprint, SessionGraph, LTG), y prohibir publicación si el estado no llega legítimamente a `READY_FOR_TEACHER`.
5. Simular `503`, `fetch failed`, expiración de leases, ACK perdido y reintentos concurrentes en tests *sin API de IA*. Sólo después considerar un ensayo autenticado separado con proveedor real y presupuesto acotado.

## Ejecución y criterio de aceptación

Desde la raíz del repositorio, en Node.js >=22:

```bash
node --test shadow/recovery-v1/tests/decision.test.mjs
node --check shadow/recovery-v1/decision.mjs
```

Se deben conservar sin modificaciones las rutas productivas, el despliegue Railway, los secretos, la base Supabase productiva y el pipeline certificado. No habilitar auto-merge. Esta rama solo aporta nuevos archivos `shadow/recovery-v1/*` y esta documentación.

### Límite de la evidencia

Las pruebas locales de la nueva decisión verifican **invariantes y decisiones**, no la integración funcional de las llamadas reales del pipeline. Los resultados del laboratorio confirman que una Edge Function aislada fue capaz de guardar y recuperar datos; no prueban todavía la recuperación extremo a extremo con la construcción pedagógica y el proveedor real.

## Paso siguiente implementado: adaptador de autenticación y lectura (shadow, 24 nov 2026)

Archivos añadidos en el PR de borrador:

- `shadow/recovery-v1/authenticated-adapter.mjs`
- `shadow/recovery-v1/tests/authenticated-adapter.test.mjs`

`createSupabaseSessionVerifier` consulta `GET https://<project_ref>.supabase.co/auth/v1/user` usando un **publishable/anon key** y un bearer de sesión. Requiere usuario autenticado, rechaza JWT inválido/sesión caducada, timeout y errores HTTP. No decodifica JWT en el navegador como fuente de autoridad.

`createStage7AuthenticatedAdapter` recibe un verificador y tres lectores **de confianza, ejecutados exclusivamente en el servidor**. Todos reciben el mismo alcance `{actorId,runId,attemptId}`. Comprueba la pertenencia del `plan_run` y del intento al docente autenticado, así como el acuerdo entre los datos canónicos originales del plan y los bindings inmóviles del intento. Solo después carga `read_state` completo y las operaciones registradas; decide con `assessStage7Recovery`.

`inspectStage7BeforePipeline` establece el punto de observación previo a futura integración: no ejecuta ningún pipeline ni solicita proveedores. Incluso ante snapshots válidos solo devuelve **revalidación necesaria**, nunca `provider_call_allowed=true`. Ante pérdida de autenticación, discordancia de dueño, hash incorrecto, `PENDING` o lectura incompleta, falla cerrado.

### Pruebas locales sin proveedor

```bash
node --test shadow/recovery-v1/tests/decision.test.mjs \
  shadow/recovery-v1/tests/authenticated-adapter.test.mjs
node --check shadow/recovery-v1/authenticated-adapter.mjs
```

Resultado: **22/22 casos PASS**, cero peticiones al proveedor; 9 pruebas del guard y 13 del adaptador. Comprueban identidad cruzada, divergencia canónica, ruta de Auth de proyecto fijo, fallo de red, lecturas duraderas, pérdida de ACK, `PENDING`, corrupción de digest y estado inicial sin checkpoint.

### Límite explícito (todavía NO integrado ni certificado en vivo)

Las dependencias `readCanonicalContext`, `readState` y `readOperations` son interfaces exigidas, **NO adaptadores de base de datos implementados**: deben conectarse a una nueva lectura transaccional bajo RLS/rol mínimo que obtenga originales canónicos verificables. La función de prueba de laboratorio v18 **no publica** todo el bundle de estado/canon ni listado de operaciones que necesita el guard; no es correcto simular estos datos con valores del navegador ni copiar las credenciales del laboratorio a la aplicación.

Falta un puente autorizado de lectura servidor/Edge que entregue estado + operaciones coherentes, la conexión en un punto exacto del pipeline shadow, el registro `PENDING` antes de la petición, la persistencia posterior a respuesta, y la reejecución integral de los gates curriculares. El PR sigue en **borrador**, sin merge, producción congelada. No se han ejecutado llamadas reales a Gemini ni tests de integración con Supabase autenticada para este adaptador.