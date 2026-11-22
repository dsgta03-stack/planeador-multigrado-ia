# Multiplan — Consolidación Single App R1

## Estado y regla de trabajo

Esta rama es **aislada**. No modifica producción ni el deployment restaurado. La producción queda congelada mientras se consolida.

Base de la rama: `cc63bbafa9c1d580f27c3ded8d64e9c5e9945164`.

Objetivo: sustituir la cadena histórica de wrappers por **una sola aplicación**, con un único frontend, un único servidor HTTP y un único plan canónico. No se permite resolver la consolidación agregando otro wrapper.

## Hallazgo principal

La cadena vigente llegó a ejecutar aproximadamente **33 procesos/servidores encadenados** desde la capa más nueva hasta la UI/base histórica. Cada capa intercepta HTML, rutas, headers o respuestas y algunas vuelven a transformar lo que otra capa ya transformó. Esto explica regresiones visuales y el riesgo de divergencia entre pantalla, historial, revisión y DOCX.

Cadena observada en código y logs:

```text
v0.12.5 consolidated
→ v0.12.3 workflow guidance
→ v0.12.2 methodology UI freeze fix
→ v0.12.1 plan history
→ v0.12.0 official methodology sequence
→ v0.11.8 methodology safe rescue
→ v0.11.7 teacher presentation
→ v0.11.6 methodology recommendation
→ v0.11.4 UI result guard
→ v0.11.4 UI root normalizer
→ v0.11.4 professional rootfix
→ v0.11.3 Beta.10 promoted
→ v0.10.8 grade trace renderer
→ v0.10.7 transversal lock
→ v0.10.6 Beta.8 shadow
→ v0.10.5 zero-PDA teacher lock
→ v0.10.4 teacher selection lock
→ v0.10.2 Grade-Lock rescue
→ v0.10.1 Beta.7 shadow
→ v0.9.8 simplified rescue
→ v0.9.7 Beta.4 shadow
→ v0.9.6 renderer guard
→ v0.9.5 Beta.3 clean shadow
→ v0.9.1 V6.4 MG3 / V6.5 shadow
→ v0.9.0 V6.5 shadow
→ v0.8.9 multigrade session-wise
→ v0.8.8 multigrade didactic
→ v0.8.6 didactic
→ v0.8.6 project action
→ v0.8.6 project core
→ v0.8.6 activity-render gateway
→ v0.8.5 auth gateway
→ v0.8.4c UI/base
```

## Disposición por capa

| Capa | Aporte que sí se conserva | Destino R1 |
|---|---|---|
| v0.8.4c | HTML/base funcional, formularios, selección de grados/PDA, render base | **Extraer a frontend único** |
| v0.8.5 | Supabase Auth y bearer para APIs | **Módulo de autenticación** |
| v0.8.6 activity-render | Correcciones de render de actividades | **Función de render, sin servidor** |
| v0.8.6 project-core/action/didactic | Evolución del motor previo | **No conservar como routers; sólo garantías aún vigentes** |
| v0.8.8–v0.10.1 | routers de V6.4/V6.5, shadows, rescates y fallbacks históricos | **Eliminar wrappers; conservar sólo reglas finales cubiertas por tests** |
| v0.10.2 | Grade-Lock | **Regla determinista del motor único** |
| v0.10.4 | PDA elegidos por el docente son autoritativos | **Contrato de entrada** |
| v0.10.5 | zero-PDA | **Contrato de entrada/UI** |
| v0.10.7 | Transversal Lock | **Regla determinista** |
| v0.10.8 | trazabilidad por grado | **Renderer/proyección** |
| v0.11.3 | Beta.10 promovido / fallback guardado | **Sustituido por pipeline certificado; conservar invariantes** |
| v0.11.4 professional UI | apariencia aprobada | **Fuente visual única; extraer CSS/JS, sin lectura de código fuente en runtime** |
| v0.11.4 rootfix/normalizer/result-guard | parches para superposición de wrappers | **Eliminar tras paridad** |
| v0.11.6 | recomendación metodológica | **Servicio/módulo interno** |
| v0.11.7 | presentación docente | **Teacher projection/render interno** |
| v0.11.8 | rescue metodológico seguro | **Gate interno, no proxy** |
| v0.12.0 | secuencia oficial de metodología y conteo de sesiones | **Regla del compilador/proyección** |
| v0.12.1 | historial por usuario | **Rutas del servidor único** |
| v0.12.2 | fix de reentrancia del observer | **Eliminar al dejar de existir observer duplicado; conservar test** |
| v0.12.3 | workflow guidance UI | **Componente del frontend único** |
| v0.12.4 | snapshot final, review, coherencia, DOCX | **Servicios directos del servidor único** |
| v0.12.5 | ProjectBlueprint → SessionGraph → TeacherPlanProjection → plan canónico | **Núcleo canónico definitivo** |

## Arquitectura objetivo

```text
Browser
  │
  ▼
Single Frontend
  │
  ▼
Single HTTP Server
  ├── Auth
  ├── Curriculum lookup
  ├── Methodology recommendation
  ├── Canonical generation
  │     ProjectBlueprint
  │       → deterministic/semantic gates
  │       → SessionGraph
  │       → deterministic/semantic gates
  │       → TeacherPlanProjection
  │       → CanonicalPlan + canonical_plan_hash
  ├── History / final snapshot
  ├── Pedagogical review
  ├── DOCX export
  └── Materials
```

No `spawn()` de servidores de versiones anteriores será permitido en el runtime final.

## Contratos que no se pueden perder

1. Los PDA seleccionados por el docente son autoritativos; no auto-PDA silencioso.
2. Grade-Lock.
3. Transversal Lock.
4. Soporte explícito de zero-PDA.
5. Metodología NEM elegida/recomendada con secuencia oficial y número de sesiones preservado.
6. Currículo/PDA autoritativos resueltos server-side.
7. ProjectBlueprint y SessionGraph con gates fail-closed.
8. TeacherPlanProjection como salida para el docente.
9. Un único `canonical_plan_hash`.
10. La misma instancia de plan alimenta pantalla, historial, review y DOCX.
11. Auth obligatoria donde corresponda.
12. Historial owner-scoped.
13. Snapshot final durable.
14. DOCX rechaza plan/hash que no coinciden.
15. Review no puede revisar un plan distinto al canónico.
16. La apariencia visual aprobada no cambia sin decisión explícita.
17. No hay generación costosa en pruebas de frontera que deban fallar antes del provider.

## Regla visual

La UI profesional deja de extraerse con `readFileSync + between(...)`. El CSS/JS aprobado se convertirá en un módulo/asset de primera clase. El servidor final servirá el HTML una sola vez; no habrá inyección sucesiva de HTML por wrappers.

## Fases de consolidación

### R1-A — Inventario y contratos
- manifest machine-readable de capas;
- test que impide reintroducir múltiples UI authorities;
- lista de garantías obligatorias.

### R1-B — Frontend único
- extraer UI base + professional dashboard + workflow;
- conservar IDs/acciones requeridas;
- eliminar rootfix, normalizer, result-guard y observer patch como procesos.

### R1-C — Servicios HTTP únicos
- auth;
- historial/snapshot;
- review;
- DOCX;
- materials;
- curriculum lookup;
- health.

### R1-D — Motor único
- entrada normalizada;
- ProjectBlueprint;
- SessionGraph;
- TeacherPlanProjection;
- CanonicalPlan;
- eliminar la ruta productiva por routers V6.x históricos.

### R1-E — Paridad
- pruebas unitarias existentes;
- pruebas de contratos consolidados;
- snapshot/DOM contract de UI;
- HTTP fail-closed;
- history/review/DOCX hash binding;
- sin replay Gemini completo salvo que haya una razón explícita.

### R1-F — Shadow
- desplegar como servicio aislado;
- nunca sustituir producción durante las pruebas;
- comparar visual y funcionalmente.

### R1-G — Cutover
Sólo después de paridad completa:
- un servidor;
- un proceso;
- un frontend;
- cero wrappers históricos;
- rollback preservado.

## Criterio de terminación

La consolidación **no está terminada** si el nuevo entrypoint hace `spawn()` de cualquier `server-v*.mjs`, si la UI se obtiene de otro puerto local, si pantalla/review/DOCX usan objetos de plan distintos, o si para preservar una regla se requiere dejar otro proxy histórico ejecutándose.

