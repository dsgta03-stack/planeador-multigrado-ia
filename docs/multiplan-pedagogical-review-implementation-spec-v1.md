# Multiplan — Especificación de implementación de Revisión Pedagógica V1

Estado: **lista para implementación técnica**  
Documento fuente: `docs/multiplan-pedagogical-rules-v1.md`  
Objetivo: convertir las reglas pedagógicas consolidadas en una capa verificable sin perder funciones actuales de V6.5 Beta.10 ni modificar silenciosamente currículo.

## 1. Principio de arquitectura

La primera versión debe ser una **capa de revisión posterior a la generación** y no una reescritura del motor.

Flujo propuesto:

`V6.4 base → V6.5 Beta.10 metodología → planeación visible → Pedagogical Review V1 → informe de revisión`

La revisión:

- no agrega ni elimina PDA;
- no cambia el grado de un PDA;
- no cambia LTG seleccionados;
- no modifica sesiones ni tiempos;
- no reescribe productos o actividades;
- no sustituye el `promotion_gate` de Beta.10 en la primera fase;
- emite hallazgos y un estado global de calidad pedagógica.

Cuando exista evidencia suficiente en pruebas de regresión, reglas críticas concretas podrán promoverse gradualmente a compuertas gobernantes.

## 2. Ubicación funcional

La capa debe alimentar el paso visible de v0.12.3:

**Contexto → PDA → Metodología → Planeación → Revisión**

El paso `Revisión` se considera completo sólo después de ejecutar el revisor sobre la planeación vigente. Generar una planeación no equivale a aprobar su revisión.

## 3. Contrato de entrada

Entrada mínima:

```json
{
  "plan": {},
  "context": "",
  "problem": "",
  "methodology": "abp|steam|aprendizaje_servicio|proyectos_comunitarios",
  "selected_pdas": [
    {
      "id": "...",
      "grade": 1,
      "text": "PDA oficial",
      "content": "contenido oficial opcional"
    }
  ],
  "requested_sessions": 5,
  "minutes_per_session": 60,
  "mode": "review-only"
}
```

Si el `plan` ya contiene alguno de estos datos, el servidor puede reconstruirlos, pero la fuente autoritativa para PDA seleccionados debe ser la selección docente original.

## 4. Contrato de salida

```json
{
  "review_version": "PEDAGOGICAL-REVIEW-V1",
  "status": "BLOCKED|NEEDS_ADJUSTMENT|PEDAGOGICALLY_COHERENT",
  "score": 0,
  "critical_count": 0,
  "warning_count": 0,
  "not_evaluable_count": 0,
  "findings": [
    {
      "rule_id": "PDA-02",
      "severity": "CRITICAL",
      "status": "FAIL",
      "scope": {
        "session_number": 2,
        "grade": 4,
        "pda_id": "..."
      },
      "failure": "...",
      "pedagogical_reason": "...",
      "expected_behavior": "...",
      "observed_evidence": "...",
      "recommendation": "..."
    }
  ],
  "rule_results": {},
  "summary": {
    "project": "...",
    "pda_alignment": "...",
    "methodology": "...",
    "multigrade": "...",
    "time": "..."
  }
}
```

## 5. Dos tipos de comprobación

### 5.1 Reglas deterministas

Deben ejecutarse sin modelo generativo siempre que la estructura lo permita.

Candidatas iniciales:

- `PDA-04` repetición indebida de todos los PDA en todas las sesiones;
- `PDA-06` selección docente preservada;
- `PRJ-04` cobertura de aportaciones por grado;
- `SES-01` presencia de avance/evidencia por sesión cuando los campos existen;
- `SES-03` continuidad/preparación entre sesiones cuando los campos existen;
- `MG-03` solapamiento de atención directa;
- `MG-07` existencia de integración de aportes;
- `TIME-01` suma de minutos;
- `TIME-04` presentación/evaluación antes de construcción cuando puede trazarse estructuralmente;
- `EVD-05` PDA atribuido a tareas transversales sin selección;
- integridad de campos y cobertura por grado/sesión.

Las reglas deterministas deben devolver `NOT_EVALUABLE` si la estructura no contiene datos suficientes; nunca inventar un fallo.

### 5.2 Reglas semánticas

Necesitan interpretar lenguaje y relación pedagógica. Deben ejecutarse mediante un evaluador semántico con salida JSON estricta y temperatura baja.

Candidatas:

- `PRJ-01`, `PRJ-02`, `PRJ-05`, `PRJ-06`, `PRJ-07`;
- `PDA-01`, `PDA-02`, `PDA-05`, `PDA-07`, `PDA-08`;
- `SES-04`, `SES-05`, `SES-06`;
- `MET-01` a `MET-07`;
- `EVD-01` a `EVD-04`;
- `MG-01`, `MG-02`, `MG-04`, `MG-06`;
- `LTG-01` a `LTG-04`;
- `TIME-02`, `TIME-03`;
- `COH-01` a `COH-03`.

El evaluador semántico debe citar fragmentos breves del propio plan como `observed_evidence`; no puede introducir currículo externo ni declarar un PDA distinto del seleccionado.

## 6. Política de severidad

- `CRITICAL + FAIL` → contribuye a `BLOCKED`.
- `WARNING + FAIL` → contribuye a `NEEDS_ADJUSTMENT`.
- `PASS` → no genera alerta.
- `NOT_EVALUABLE` → informa falta de datos; no bloquea por sí mismo.

Un `score` alto nunca anula un crítico.

## 7. Puntaje sugerido

El puntaje es secundario a las compuertas.

Pesos iniciales:

- proyecto y trayectoria: 20;
- PDA–actividad–evidencia–evaluación: 25;
- progresión de sesiones: 15;
- metodología NEM: 15;
- integración multigrado: 15;
- tiempo/recursos/contexto: 10.

Cada dimensión se calcula sólo con reglas evaluables. Si una dimensión tiene demasiados `NOT_EVALUABLE`, debe mostrarse como “información insuficiente” y no inflar el puntaje.

## 8. Reglas que NO deben gobernar todavía

En la primera fase no deben bloquear automáticamente el plan visible basándose sólo en juicio semántico de un modelo:

- pertinencia fina de PDA (`PDA-05`);
- calidad de diferenciación (`MG-02`);
- uso óptimo de LTG (`LTG-01`, `LTG-02`);
- aplicación contextual (`COH-01`);
- carga cognitiva estimada (`TIME-02`).

Deben mostrarse como hallazgos para acumular evidencia. Su promoción a bloqueo exige pruebas de falsos positivos/falsos negativos.

## 9. Reglas candidatas a bloqueo técnico temprano

Pueden promoverse antes porque son objetivables:

1. selección docente alterada (`PDA-06`);
2. minutos imposibles (`TIME-01`);
3. doble atención docente simultánea (`MG-03`);
4. PDA marcado `WORKED` sin ninguna actividad/evidencia trazable (`PDA-02`/`PDA-03` cuando exista estructura explícita);
5. atribución curricular a tarea transversal sin PDA (`EVD-05`);
6. producto final sin ninguna trayectoria previa detectable (`PRJ-05`, primero en modo shadow hasta calibración);
7. metodología declarada sin ninguna acción de sus funciones básicas (`MET-01`, primero en shadow).

## 10. Esquema de trazabilidad por PDA

Para cada combinación `grade + pda_id + session_number` producir:

```json
{
  "status": "WORKED|DEVELOPING|NOT_MOBILIZED|NOT_EVALUABLE",
  "activity_refs": [],
  "evidence_refs": [],
  "product_refs": [],
  "assessment_refs": [],
  "verb_alignment": "PASS|WARN|FAIL|NOT_EVALUABLE"
}
```

El estado `WORKED` requiere actividad directa y evidencia. `DEVELOPING` nunca debe presentarse visualmente como PDA alcanzado.

## 11. Esquema de trayectoria del proyecto

Para cada sesión:

```json
{
  "session_number": 1,
  "project_state_before": "...",
  "project_stage": "...",
  "needed_learning": ["..."],
  "advance": "...",
  "partial_product_or_evidence": "...",
  "reused_in": [2],
  "project_state_after": "..."
}
```

La revisión debe detectar:

- `orphan_output`: evidencia/producto que nunca se reutiliza cuando debería;
- `missing_input`: sesión que exige un insumo no construido;
- `sudden_final_product`: producto final sin etapas previas;
- `no_project_advance`: sesión que no cambia el estado del proyecto.

## 12. Evaluación de la metodología

No distribuir fases sólo por índice de sesión. El evaluador debe comprobar funciones reales.

### ABP
Problema comprensible → información/saberes necesarios → formulación/organización → experiencia de resolución → resultados/análisis.

### STEAM
Fenómeno/pregunta → diseño de indagación → desarrollo/obtención de evidencia → organización/explicación → aplicación/comunicación → reflexión.

### Aprendizaje Servicio
Necesidad/punto de partida → saberes/preguntas → organización → acción de servicio → comunicación/valoración.

### Proyectos Comunitarios
Planeación → acción → intervención/aplicación realista → valoración.

La cantidad de sesiones puede variar; las funciones pueden compartir sesión, pero no desaparecer cuando son indispensables.

## 13. Integración multigrado

El revisor debe construir una matriz por momento:

`sesión | momento | grado | modo | requiere_docente | tarea | evidencia | aporte`

Compuertas:

- máximo una atención directa exclusiva simultánea;
- los grados no atendidos directamente deben tener tarea realizable;
- cada grado debe contribuir al proyecto;
- debe existir al menos un punto de integración de aportes;
- diferenciación debe poder explicarse pedagógicamente.

## 14. Interfaz v0.12.3

El paso Revisión debe mostrar:

- estado global;
- número de críticos y ajustes;
- cinco bloques: Proyecto, PDA, Metodología, Multigrado, Tiempo/viabilidad;
- hallazgos por regla con explicación breve;
- enlace/acción “ver dónde ocurre” que lleve a sesión/grado cuando sea posible;
- texto claro: “La revisión no cambia tus PDA ni tu planeación automáticamente”.

Estados visuales:

- rojo: requiere corregir antes de considerar validada;
- amarillo: usable con ajustes;
- verde: coherencia suficiente;
- gris: no evaluable por falta de información.

El paso Revisión **no** se marca terminado sólo porque `planReady()` sea verdadero. Debe existir un `reviewResult` vigente asociado a la misma versión/hash del plan.

## 15. Hash e invalidación

Calcular `review_input_hash` sobre:

- versión del revisor;
- plan completo o representación canónica;
- selección docente de PDA;
- metodología;
- contexto/problema relevantes.

Si cambia cualquier elemento, la revisión anterior queda `STALE` y el paso Revisión vuelve a pendiente.

## 16. Persistencia

Fase inicial recomendada:

- no modificar tablas existentes para gobernar generación;
- guardar opcionalmente el resultado dentro de una nueva tabla o JSON asociado al `run_id` sólo después de definir migración separada;
- nunca sobrescribir `model_output_json` original.

Campos mínimos si se persiste:

`review_id, user_id, run_id, review_version, review_input_hash, status, score, findings_json, created_at`.

## 17. Modo shadow y promoción

### Etapa A — Shadow
El revisor corre y registra resultados, pero no bloquea uso/exportación.

### Etapa B — Advertencias visibles
Los hallazgos se muestran al docente; sólo invariantes estructurales muy seguras pueden bloquear “Validada”.

### Etapa C — Gate pedagógico parcial
Tras una batería suficiente de planeaciones, promover únicamente reglas con baja tasa de falsos positivos.

Nunca promover todo el juicio semántico de una vez.

## 18. Pruebas técnicas obligatorias

Implementar fixtures sintéticos y, después, planeaciones reales anonimizadas.

Casos mínimos:

1. plan coherente → sin críticos;
2. PDA “argumenta” con copia → `PDA-01`;
3. PDA trabajado sin evidencia → `PDA-02`;
4. producto final repentino → `PRJ-05`;
5. sesión aislada → `SES-04`;
6. metodología nominal → `MET-01`;
7. intervención falsa → `MET-06`;
8. servicio sin servicio → `MET-05`;
9. planes paralelos → `PRJ-03`/`MG-07`;
10. doble atención directa → `MG-03`;
11. tiempo excedido → `TIME-01`;
12. PDA forzado → `PDA-05` warning;
13. LTG inoportuno → `LTG-02` warning;
14. tarea transversal con PDA inventado → `EVD-05`;
15. falta de datos → `NOT_EVALUABLE`, no bloqueo inventado;
16. modificación del plan después de revisar → resultado `STALE`;
17. proveedor semántico falla → conservar revisión determinista y marcar componente semántico como no evaluable/degradado;
18. autenticación ajena → 401/403;
19. historial de otro usuario → inaccesible;
20. regresión: V6.5 Beta.10, V6.4 fallback y generación actual permanecen sin cambios.

## 19. Criterios de aceptación

La implementación V1 está lista para pruebas de usuario sólo cuando:

- ninguna regla cambia currículo automáticamente;
- el paso Revisión distingue plan generado de plan revisado;
- todos los hallazgos incluyen `rule_id` y explicación;
- críticos y advertencias se diferencian;
- `NOT_EVALUABLE` no se interpreta como fallo;
- el resultado se invalida al cambiar la planeación;
- fallos del evaluador semántico no rompen generación;
- Beta.10 y V6.4 siguen funcionando sin regresiones;
- los 20 casos mínimos tienen prueba reproducible.

## 20. Decisión de versión

No llamar a esta capa “V6.6” mientras sólo sea revisión shadow. Nombre recomendado:

`PEDAGOGICAL-REVIEW-V1-SHADOW`

V6.5 Beta.10 continúa siendo el motor visible hasta que las reglas críticas hayan sido calibradas y se tome una decisión explícita de promoción.