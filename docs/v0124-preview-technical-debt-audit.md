# Multiplan — Auditoría de deuda técnica del preview v0.12.4

Fecha: 2026-09-23  
Rama auditada: `pedagogical-review-v1-shadow`  
Commit base de la auditoría: `042ff643ef2c284fc220a7f9b93a337423d2cee4`  
Alcance: **documentación y clasificación; sin cambio del motor ni de producción**.

## 1. Resumen ejecutivo

El preview v0.12.4 funciona y conserva garantías importantes, pero hoy no es una aplicación única. Es una cadena acumulativa de wrappers Node que fueron agregando correcciones, rutas de fallback, UI, autenticación y observabilidad sin retirar las capas anteriores.

La cadena activa contiene **33 procesos Node** dentro del servicio preview. Además, el HTML base no es completamente autocontenido: `server-v084c.mjs` obtiene la página raíz desde el despliegue Railway externo `planeador-multigrado-ia-v084b-production.up.railway.app`, y capas posteriores inyectan autenticación, renderizadores, metodología, historial, workflow, revisión y DOCX.

Esto no significa que las reglas deban eliminarse. Varias capas contienen garantías que siguen siendo obligatorias. La deuda está en que esas garantías están distribuidas entre muchos procesos y parches de HTML, no en que sean innecesarias.

**Decisión de esta auditoría:** no retirar wrappers antes de terminar `ProjectBlueprint V1`. Primero preservar las garantías como pruebas/contratos; después consolidar la implementación en módulos explícitos.

---

## 2. Cadena activa observada

La cadena principal que arranca el preview es:

`v0.12.4 → v0.12.3 → v0.12.2 → v0.12.1 → v0.12.0 → v0.11.8 → v0.11.7 → v0.11.6 → v0.11.4 result guard → v0.11.4 root normalizer → v0.11.4 rootfix → v0.11.3 → v0.10.8 → v0.10.7 → v0.10.6 → v0.10.5 → v0.10.4 → v0.10.2 → v0.10.1 → v0.9.8 → v0.9.7 → v0.9.6 → v0.9.5 → v0.9.1 → v0.9.0 → v0.8.9 → v0.8.8 → v0.8.7/didactic → project-action → project-core → v0.8.6 → v0.8.5 → v0.8.4c`

| Puerto | Archivo / capa | Responsabilidad actual | Clasificación |
|---:|---|---|---|
| 8080 | `server-v0124-consolidated-shadow.mjs` | Project Coherence, snapshot final, revisión/cache, DOCX, UI v0.12.4 | **PRESERVAR / núcleo preview** |
| 6901 | `server-v0123-workflow-guidance.mjs` | Ruta Contexto → PDA → Metodología → Planeación → Revisión | **CONSOLIDAR UI** |
| 6801 | `server-v0122-methodology-ui-freeze-fix.mjs` | Parche de `MutationObserver` | **ELIMINAR AL CORREGIR UI FUENTE** |
| 6701 | `server-v0121-plan-history.mjs` | API/UI de “Mis planeaciones” | **PRESERVAR FUNCIÓN / CONSOLIDAR** |
| 6601 | `server-v0120-official-methodology-sequence.mjs` | Secuencia/fases oficiales y reparación limitada | **REDISEÑAR CON BLUEPRINT** |
| 6501 | `server-v0118-methodology-safe-rescue.mjs` | Adaptador metodológico de rescate seguro | **PRESERVAR SEMÁNTICA / CONSOLIDAR** |
| 6301 | `server-v0117-teacher-presentation.mjs` | Presentación docente y narrativa en primera persona | **PRESERVAR FUNCIÓN / CONSOLIDAR** |
| 6201 | `server-v0116-methodology-recommendation.mjs` | Recomendación y selección docente de metodología | **PRESERVAR FUNCIÓN / CONSOLIDAR** |
| 6101 | `server-v0114-ui-result-guard.mjs` | Visibilidad/progreso del plan | **CONSOLIDAR UI** |
| 6001 | `server-v0114-ui-root-normalizer.mjs` | Normalización de `/` | **LEGACY / candidato fuerte a retirar** |
| 5801 | `server-v0114-ui-professional-rootfix.mjs` | Separa fuente HTML y backend; inyecta UI profesional | **DEUDA PRIORITARIA** |
| 5701 | `server-v0113-v65beta10-promoted.mjs` | Beta.10 gobernante con V6.4 guardado y rescate estable | **PRESERVAR SEMÁNTICA CRÍTICA** |
| 5401 | `server-v0108-grade-trace-render.mjs` | Trazabilidad curricular visual por grado | **PRESERVAR INFORMACIÓN / CONSOLIDAR UI** |
| 5201 | `server-v0107-v64beta6-transversal-lock.mjs` | V6.4 + Transversal Lock + fallback estable | **PRESERVAR SEMÁNTICA CRÍTICA** |
| 5101 | `server-v0106-v65beta8-shadow.mjs` | Shadow Beta.8 (deshabilitado desde capa superior) + texto UI | **LEGACY/PASS-THROUGH** |
| 5001 | `server-v0105-zero-pda-teacher-lock.mjs` | Soporte zero-PDA mediante parche/sentinel UI | **PRESERVAR POLÍTICA / REIMPLEMENTAR** |
| 4901 | `server-v0104-teacher-selection-lock.mjs` | Autoridad de selección docente, sin auto-PDA | **PRESERVAR POLÍTICA / CONSOLIDAR** |
| 4801 | `server-v0102-gradelock-rescue.mjs` | Rescate Grade-Lock si el primario no es ejecutable | **FALLBACK; NO RETIRAR AÚN** |
| 4701 | `server-v0101-v65beta7-shadow.mjs` | Shadow Beta.7 deshabilitado por padre | **LEGACY/PASS-THROUGH** |
| 4601 | `server-v098-simplified-rescue.mjs` | Beta.5 + dos rescates estables | **FALLBACK; CONSOLIDAR** |
| 4501 | `server-v097-v65beta4-shadow.mjs` | Shadow Beta.4 deshabilitado por padre | **LEGACY/PASS-THROUGH** |
| 4401 | `server-v096-v64mg5-renderguard.mjs` | Beta.5/fallback + renderer compatible | **FALLBACK + UI LEGACY** |
| 4301 | `server-v095-v65beta3-clean-shadow.mjs` | Beta.4/fallback; shadow inferior deshabilitado | **FALLBACK LEGACY** |
| 4001 | `server-v091-v64mg3-v65shadow.mjs` | Beta.3/fallback; shadow inferior deshabilitado | **FALLBACK LEGACY** |
| 3901 | `server-v090-v65-shadow.mjs` | Shadow Beta.2 deshabilitado por herencia | **LEGACY/PASS-THROUGH** |
| 3801 | `server-v089-multigrade-didactic.mjs` | Beta.2 multigrado + V6.2.1 fallback | **FALLBACK LEGACY** |
| 3701 | `server-v088-multigrade-didactic.mjs` | Beta.1 multigrado + renderer | **FALLBACK LEGACY** |
| 3601 | `server-v086-didactic.mjs` | Ruta didáctica V6.4 para un grado + fallback | **SINGLE-GRADE/FALLBACK; decidir alcance** |
| 3501 | `server-v086-projectaction.mjs` | Project Action V6.3 para un grado | **SINGLE-GRADE/FALLBACK** |
| 3401 | `server-v086-projectcore.mjs` | Project Core para un grado | **SINGLE-GRADE/FALLBACK** |
| 3301 | `server-v086.mjs` | Render explícito V6.2.1 | **UI LEGACY / fallback** |
| 3201 | `server-v085b.mjs` | Auth Supabase + `/api/retrieve`, `/api/gemini-plan`, `/api/material` | **PRESERVAR FUNCIÓN CRÍTICA / CONSOLIDAR** |
| 3101 | `server-v084c.mjs` | UI contextual base; obtiene HTML desde Railway `v084b` | **DEUDA PRIORITARIA / hacer autocontenido** |

`server-v0114-ui-professional-rootfix.mjs` usa además `MULTIPLAN_UI_SOURCE_PORT` para obtener la raíz por una ruta diferente a la del backend. En el preview actual esa fuente se dirige a la capa de autenticación/UI. Por tanto hoy existen dos trayectorias: **fuente HTML** y **backend/API**.

---

## 3. Garantías que NO deben perderse durante la consolidación

Estas son reglas/funciones, no wrappers que deban conservarse para siempre:

1. Autenticación Supabase y asociación de planeaciones al usuario.
2. Selección de PDA/contenidos autoritativa por el docente; sin auto-PDA silencioso.
3. Zero-PDA permitido sólo como participación transversal, sin atribuir PDA/LTG/criterios ajenos.
4. Grade-Lock y Transversal Lock; prohibición de atribución curricular entre grados.
5. Beta.10 sólo visible cuando su promotion gate es válido; V6.4/rescate estable siguen disponibles hasta sustituirlos con evidencia equivalente.
6. Metodología elegida por el docente y secuencia metodológica oficial preservada.
7. Proyecto común, producto final y aportes por grado coherentes.
8. Snapshot final canónico + hash, historial fiel y `HISTORY_SNAPSHOT_MISMATCH`.
9. Revisión pedagógica sobre el mismo snapshot canónico.
10. Exportación DOCX desde el objeto canónico, no desde HTML/PDF/captura.
11. Recuperación curricular, materiales y demás endpoints que sigan siendo parte del producto.
12. Trazabilidad suficiente para saber qué PDA, grado, actividad y evidencia originaron cada decisión.

---

## 4. Deuda técnica prioritaria

### TECH-ARCH-01 — cadena de 33 procesos

Cada wrapper agrega latencia, superficie de fallo y dificultad de observación. Muchos procesos terminan si muere su hijo, por lo que una falla profunda puede propagarse hasta el proceso público.

**Objetivo futuro:** un servidor público modular y, durante migración, como máximo un child/rollback explícito; no una cadena histórica completa.

### TECH-ARCH-02 — raíz externa y arquitectura dividida

`server-v084c.mjs` obtiene el HTML base desde otro servicio Railway (`v084b`). `server-v0114-ui-professional-rootfix.mjs` vuelve a separar la fuente de UI del backend. El preview no es autocontenido.

**Objetivo futuro:** shell HTML/CSS/JS versionado dentro del mismo repositorio/build que sirve el preview.

### TECH-ARCH-03 — monkey-patching acumulativo del navegador

Varias capas interceptan `window.fetch`, redefinen `renderSessions`, agregan `MutationObserver`, hacen `replace()` sobre HTML y dependen de IDs DOM históricos.

**Riesgo:** una corrección visual puede dejar de montarse aunque el backend sea correcto; dos wrappers pueden redefinir la misma función en distinto orden.

**Objetivo futuro:** módulos de UI explícitos con un único estado/aplicación y renderizadores declarativos.

### TECH-ARCH-04 — políticas de generación/fallback distribuidas

`/api/gemini-plan` es interceptado por múltiples capas. Beta.10, V6.4, Grade-Lock, Transversal Lock, rescates y rutas single-grade están distribuidos entre distintos archivos.

**Objetivo futuro:** un `generation-orchestrator` único con una matriz de decisión versionada y pruebas de paridad.

### TECH-ARCH-05 — límites y timeouts heterogéneos

Cada wrapper define sus propios límites de payload y timeout. Una solicitud puede ser aceptada por una capa y rechazada por otra más profunda. Esto es especialmente difícil de razonar en rutas de fallback y single-grade.

**Objetivo futuro:** política común de límites, timeout y errores en una capa compartida.

### TECH-ARCH-06 — shadow histórico inerte todavía en la cadena

Wrappers como Beta.8/Beta.7/Beta.4/Beta.2 siguen arrancando aunque sus shadows se deshabiliten desde capas superiores. Su existencia actual aporta compatibilidad histórica, pero no debe ser la arquitectura final.

---

## 5. Archivos históricos presentes pero no activos en la cadena principal

El repositorio conserva versiones experimentales como `server-v0100-v65beta6-shadow.mjs`, `server-v0103-auto-pda-gradelock.mjs`, `server-v0109-v13-semantic-selftest.mjs`, `server-v0110-v64guard-v65beta9-shadow.mjs`, `server-v0112-v64guard-v65beta10-shadow.mjs`, `server-v0115-ui-plan-visibility.mjs`, `server-v0119-methodology-sequence-policy.mjs`, varias capas v0.9.2–v0.9.4 y v0.9.9, entre otras.

No deben borrarse como parte de esta auditoría. Primero deben quedar fuera de referencias activas, cubrirse sus garantías relevantes con pruebas y luego archivarse/eliminarse en una ronda separada.

---

## 6. Arquitectura objetivo después de ProjectBlueprint V1

```text
HTTP app / preview único
├── auth
├── curriculum retrieval
├── methodology recommender
├── generation orchestrator
│   ├── current governing engine
│   ├── safety gates
│   └── explicit fallback policy
├── ProjectBlueprint V1 adapter
├── canonical plan + snapshot persistence
├── pedagogical review
├── history
├── DOCX export
└── UI shell + renderers
```

La separación debe ser por **módulos y contratos**, no por una cascada de procesos/puertos.

`ProjectBlueprint V1` debe convertirse en el punto natural para decidir qué información de proyecto/sesiones es canónica. El Blueprint no debe debilitar Grade-Lock, Transversal Lock, selección docente ni trazabilidad curricular.

---

## 7. Plan de consolidación propuesto

### Etapa A — ahora, antes de Blueprint

- documentar la cadena (este archivo);
- no retirar ninguna capa gobernante;
- mantener regresiones actuales de fidelidad, review, project coherence y DOCX;
- no tocar producción.

### Etapa B — después de cerrar ProjectBlueprint V1

Crear una rama separada, por ejemplo `v0125-unified-preview`, y construir un servidor autocontenido que reproduzca la salida actual usando módulos, manteniendo la cadena v0.12.4 como rollback completo.

Primero extraer la UI base al repositorio y eliminar la dependencia runtime de `v084b`. Después integrar workflow, historial, result guard, metodología, teacher presentation, revisión y DOCX sin inyección acumulativa de HTML.

### Etapa C — consolidar generación

Crear una matriz explícita de rutas para:

- multigrado con PDA en todos los grados;
- multigrado con grados sin PDA;
- selección docente distinta de la recomendación;
- uno y múltiples grados;
- fallos del motor primario;
- fallback seguro;
- sesiones cortas y largas (incluidas 15+ sesiones).

Sólo después de paridad automática se eliminan wrappers de routing/fallback.

### Etapa D — retirar legado

Retirar primero wrappers puramente pass-through/shadow deshabilitado y parches visuales sustituidos. Después retirar fallbacks antiguos que ya no sean alcanzables. Cada eliminación debe demostrar que no cambia la salida canónica ni las garantías de seguridad curricular.

---

## 8. Criterios de aceptación de la futura consolidación

La consolidación podrá sustituir la cadena actual sólo cuando:

- el preview sea autocontenido y no necesite `v084b` para obtener el HTML raíz;
- exista un único punto de orquestación de generación/fallback;
- auth, retrieval, history, review y DOCX sigan funcionando;
- selección docente, Grade-Lock, Transversal Lock y zero-PDA conserven exactamente sus garantías;
- `ProjectBlueprint V1` sea fuente canónica o exista un adaptador determinista claramente versionado;
- generación nueva y reabierta mantengan el mismo hash canónico;
- las regresiones de 15 sesiones, historial/revisión/DOCX y reglas pedagógicas sigan pasando;
- se prueben tanto rutas multigrado como single-grade antes de retirar sus fallbacks;
- producción permanezca separada hasta un promotion gate explícito.

---

## 9. Decisión de cierre de esta auditoría

**No borrar ni fusionar wrappers ahora.**

La deuda está suficientemente identificada para evitar seguir agregando parches históricos sin arquitectura. El siguiente cambio estructural debe hacerse después de disponer de la salida final de `ProjectBlueprint V1`, porque ese contrato determinará qué capas de proyecto, metodología, presentación e historial pueden reemplazarse con seguridad.
