# Multiplan — Calibración autenticada de Revisión Pedagógica V1.1

Fecha: 2026-09-23  
Motor generado: `V6.5-METHODOLOGY-ENGINE-BETA.10-PROMOTION-GATE`  
Revisor inicial: `PEDAGOGICAL-REVIEW-V1-SHADOW`  
Resultado inicial: `BLOCKED`, score 25, 5 críticos.

## Propósito

Validar de extremo a extremo una generación real autenticada y comprobar no sólo la sensibilidad del revisor, sino también sus falsos positivos antes de permitir cualquier uso gobernante.

La prueba utilizó seis grados, tres sesiones de 90 minutos y ABP. La revisión fue posterior a la generación y no modificó la planeación ni el currículo.

## Hallazgos iniciales del revisor

El V1 inicial marcó: `PDA-04`, `PDA-01`, `SES-01`, `MG-01` y `EVD-01`.

### 1. PDA-04 — falso positivo

El evaluador semántico afirmó que la sesión 1 marcaba todos los PDA sin progresión. Sin embargo, el postcheck determinista dio `PASS` y los seis PDA estaban trazados en los momentos ejecutables de esa sesión.

**Decisión V1.1:** una regla semántica no puede convertir en FAIL una regla determinista autoritativa que ya produjo PASS para el mismo alcance.

### 2. PDA-01 — hallazgo válido

Para quinto grado, el PDA oficial exige que el alumnado identifique acontecimientos, personas y lugares representativos de la Independencia. La acción ejecutable de la sesión 2 estaba redactada como acción del docente: “Explicar la relación entre Independencia y símbolos nacionales”.

No aparece en ese momento una acción explícita del alumnado que permita observar la identificación requerida.

**Decisión V1.1:** mantener el hallazgo y reemplazar evidencia semántica libre por evidencia reconstruida desde PDA oficial + acción ejecutable + evidencia disponible.

### 3. SES-01 — falso positivo

La sesión 1 sí produjo fichas/dibujos y los metadatos metodológicos registraron avance y relación con el producto. Por tanto, era incorrecto afirmar que sólo existía discusión sin avance concreto.

**Decisión V1.1:** si una sesión contiene evidencia observable y `project_advance` o `product_relation`, un FAIL semántico de `SES-01` se suprime como contradicción estructural.

### 4. MG-01 — problema real con evidencia semántica defectuosa

El revisor señaló falta de diferenciación y mencionó una “estructura de monitores” que no estaba sustentada por el plan. Sin embargo, la cuestión pedagógica de fondo sí era válida: en la sesión 2, los grados 1.º–4.º compartían la misma tarea genérica de creación de tarjetas, pese a tener PDA cognitivamente distintos.

**Decisión V1.1:** conservar `MG-01`, pero sustituir la explicación inventada por evidencia textual tomada del bloque ejecutable y una formulación conservadora: varios grados comparten la misma tarea sin diferenciación visible de complejidad, apoyo, producto o responsabilidad.

### 5. EVD-01 — falso positivo de clasificación

“Tarjetas informativas” es un artefacto observable; no es simplemente una actividad. Puede existir otro problema de alineación o suficiencia, pero no corresponde a `EVD-01` decir que no hay evidencia por ser “actividad”.

**Decisión V1.1:** reconocer artefactos observables (tarjetas, fichas, dibujos, resúmenes, registros, líneas del tiempo, mapas, murales, textos, reportes, etc.) y dejar la calidad/alineación a otras reglas (`PDA-02`, `PDA-08`, entre otras).

## Hallazgo objetivo nuevo de la misma planeación

### PDA-03 — inconsistencia de trazabilidad por sesión

En la sesión 2, la cabecera declaró únicamente los PDA de 5.º y 6.º, mientras los momentos ejecutables también movilizaron los PDA de 1.º–4.º.

Esto no es `PDA-04` (sobredeclaración de todos los PDA), sino `PDA-03`: la declaración de la sesión no representa fielmente qué PDA están siendo movilizados.

**Postcheck V1.1:**

- si cabecera = todos los PDA seleccionados y actividades = subconjunto → `PDA-04`;
- si cabecera y PDA trazables difieren de otra manera → `PDA-03`.

## Cambios técnicos aplicados en V1.1 shadow

1. Precedencia determinista para reglas objetivables (`TIME-01`, `SES-03`, `PRJ-04`, `EVD-05`, `PDA-06`, `PDA-03`, `PDA-04`).
2. Supresión de `SES-01` semántico cuando existe avance + evidencia observable verificables.
3. Supresión de `EVD-01` cuando el plan contiene un artefacto observable para el alcance señalado.
4. Evidencia reconstruida y verificable para `PDA-01`.
5. Evidencia ejecutable normalizada para `MG-01`.
6. Recalculo del score después de suprimir falsos positivos; el score anterior ya no limita el nuevo resultado.
7. Resumen recalculado desde hallazgos que sobreviven a calibración, conservando el resumen semántico bruto sólo como diagnóstico interno.
8. Registro de hallazgos semánticos suprimidos y su motivo en `calibration.suppressed_semantic_findings`.

## Regresiones añadidas

- `pda-session-header-mismatch` → `PDA-03`.
- `deterministic-pass-beats-semantic-fail`.
- `session-has-concrete-advance`.
- `artifact-is-observable-evidence`.

## Estado

La prueba autenticada demuestra que V1 no estaba listo para gobernar, pero también permitió convertir fallos reales y falsos positivos en reglas de calibración reproducibles. V1.1 permanece **shadow / no gobernante** y requiere una nueva ejecución autenticada antes de considerarse estable para pruebas más amplias.
