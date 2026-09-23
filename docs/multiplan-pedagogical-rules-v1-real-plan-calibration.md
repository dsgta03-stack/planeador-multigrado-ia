# Multiplan — Calibración de Reglas Pedagógicas V1 con planeaciones reales

Fecha: 2026-09-23  
Estado: **calibración V1 cerrada**  
Banco base: `docs/multiplan-pedagogical-rules-v1.md`

## Propósito

Comprobar que el banco V1 detecta problemas reales de Multiplan y no sólo casos sintéticos. La calibración se realizó sobre dos salidas recientes del motor V6.5 Beta.10: una planeación multigrado de cinco sesiones con Proyectos Comunitarios y una planeación multigrado de una sesión con ABP.

No se alteraron las planeaciones utilizadas para la prueba.

---

## Caso real A — cinco sesiones, Proyectos Comunitarios

### 1. Proyecto común declarado vs. ejecución real

La capa metodológica declaró un proyecto común consistente en un mural comunitario. Sin embargo, la estructura ejecutable mantuvo productos finales separados por grado y las actividades de las sesiones se concentraron en alebrijes, leyendas, álbumes, investigación, derechos y representación artística sin una trayectoria suficientemente explícita de construcción y ensamblaje del mural común.

**Reglas aplicables:** `PRJ-03`, `PRJ-05`, `PRJ-06`, `MG-07`, `COH-03`.

**Calibración:** para validar un proyecto común no basta la existencia de `methodology_engine.integrated_project`. La revisión debe buscar el producto común dentro de las actividades ejecutables, productos parciales, evidencias y relaciones entre sesiones.

### 2. Sobredeclaración de PDA por sesión

Las cinco sesiones declararon los seis PDA seleccionados. La inspección de los momentos de trabajo mostró:

- sesión 1: 6 PDA declarados / 6 trazables;
- sesión 2: 6 declarados / 4 trazables;
- sesión 3: 6 declarados / 4 trazables;
- sesión 4: 6 declarados / 4 trazables;
- sesión 5: 6 declarados / 4 trazables.

**Regla aplicable:** `PDA-04`.

**Calibración:** `PDA-04` debe tener postcheck determinista. Cuando la cabecera de la sesión declara todos los PDA pero los momentos ejecutables movilizan un subconjunto, debe producir un hallazgo crítico sin depender del evaluador semántico.

### 3. Metodología declarada vs. acciones del alumnado

Los metadatos metodológicos describieron una progresión Planeación → Acción → Intervención y afirmaron construcción, montaje e inauguración del mural. La estructura ejecutable de las sesiones no reprodujo de manera suficiente esa trayectoria; la sesión final se concentró principalmente en socialización, autoevaluación y reflexión.

**Reglas aplicables:** `MET-01`, `MET-02`, `MET-06`, `COH-03`.

**Calibración:** los campos metodológicos, encabezados o `phase_sequence` no constituyen evidencia por sí mismos. Las acciones ejecutables tienen prioridad para decidir si una fase realmente ocurrió.

### 4. LTG y recursos

El contexto original declaró recursos básicos: pizarrón, cuadernos, libros y entorno, sin conectividad. La planeación añadió diversos materiales y apoyos no declarados. Algunos incluyeron alternativas, otros se incorporaron como parte relevante de la actividad.

**Reglas aplicables:** `LTG-01`, `LTG-02`, `LTG-03`, `MET-07`.

**Calibración:** un recurso no declarado puede proponerse sólo si es razonable y existe alternativa equivalente; no debe convertirse silenciosamente en condición necesaria para que el producto o la metodología funcionen.

### 5. Organización multigrado

La descripción global de organización por bloques no coincidió de manera exacta con todas las rotaciones ejecutadas por sesión. Las tareas reales cambiaron los grados atendidos directamente y los agrupamientos autónomos.

**Reglas aplicables:** `MG-01`, `MG-02`, `MG-03`, `MG-05`, `COH-03`.

**Calibración:** la revisión multigrado debe construirse desde cada `work_moment`, no desde un resumen global de organización.

---

## Caso real B — una sesión, ABP

### 1. Cobertura nominal de metodología

El proyecto prometió un museo escolar con seis aportes de grado, pero la salida interna de Beta.10 conservó sólo la fase “Presentemos”. Una capa externa de Multiplan puede distribuir todas las fases oficiales dentro del número de sesiones solicitado, incluso dentro de una sola sesión.

**Reglas aplicables:** `MET-01`, `MET-02`, `MET-03`.

**Calibración:** “todas las fases cubiertas” es una condición estructural, no una prueba pedagógica. Si una sola sesión recibe seis fases, el revisor debe comprobar si las acciones realmente cumplen sus funciones y si el tiempo permite desarrollarlas.

### 2. Producto imposible dentro del horizonte solicitado

La sesión dispuso de 90 minutos, de los cuales 15 fueron apertura, 30 trabajo y 45 cierre/presentación. Dentro de ese horizonte se declararon seis productos finales diferentes y un museo escolar común.

**Reglas aplicables:** `TIME-02`, `TIME-04`, `PRJ-05`.

**Calibración:** la factibilidad debe considerar no sólo la suma matemática de minutos, sino el trabajo material y cognitivo necesario para construir los productos antes de presentarlos o evaluarlos.

### 3. Proyecto que reconoce estar inconcluso

Aunque sólo existía una sesión solicitada, `prepares_next` indicó continuación posterior hacia los productos finales.

**Regla aplicable:** `SES-06`.

**Refinamiento:** la sesión final del horizonte solicitado no puede diferir etapas esenciales del mismo proyecto a una sesión inexistente. Puede anunciar un proyecto nuevo o una extensión opcional, pero el producto/servicio prometido debe quedar pedagógicamente cerrado dentro del plan solicitado.

### 4. Diferenciación insuficiente en tareas ejecutables

Varios grados superiores fueron agrupados en una misma tarea genérica de investigación y una evidencia común, aunque sus PDA y productos finales eran distintos.

**Reglas aplicables:** `MG-01`, `MG-02`, `PDA-01`, `PDA-02`.

**Calibración:** la diferenciación escrita en un resumen por grado no sustituye la diferenciación observable en las tareas, apoyos, evidencias y responsabilidades de cada momento.

---

# Refinamientos definitivos del Banco V1

La calibración **no requiere crear nuevas familias de reglas**. Se mantienen los IDs existentes y se precisan estas interpretaciones:

1. **PRJ-03/PRJ-05/PRJ-06:** el producto común y su trayectoria deben aparecer en la ejecución real; los metadatos no bastan.
2. **PDA-04:** incorpora postcheck determinista de PDA declarados por sesión vs. PDA realmente trazables en sus momentos de trabajo.
3. **SES-06:** la última sesión del horizonte solicitado no puede dejar pendiente una etapa esencial del proyecto.
4. **MET-01/MET-02:** la función pedagógica de las actividades tiene prioridad sobre nombres de fase, `phase_sequence` o indicadores de cobertura.
5. **MET-03 a MET-06:** una metodología sólo se considera desarrollada si sus funciones indispensables aparecen en acciones observables.
6. **MG-01/MG-02/MG-05:** la organización y diferenciación se evalúan en los momentos ejecutables, no sólo en resúmenes generales.
7. **LTG-03/MET-07:** los recursos centrales deben estar declarados, ser razonablemente disponibles o contar con alternativa equivalente.
8. **TIME-02/TIME-04:** la factibilidad incluye complejidad del producto, cantidad de grados, edad, investigación, construcción, revisión y presentación; no sólo suma de minutos.
9. **COH-03:** ante contradicción entre metadatos y actividades ejecutables, prevalece la evidencia de las actividades.

---

# Hallazgo técnico separado de las reglas pedagógicas

## TECH-HIST-01 — Fidelidad del historial

`Mis planeaciones` reconstruye una planeación desde `plan_runs.model_output_json`. Algunas capas externas de Multiplan transforman la respuesta después de que el Edge Function ya guardó su `plan_run`. Por lo tanto, una planeación abierta desde historial puede no contener exactamente todos los ajustes que el docente vio en la respuesta final de generación.

**Clasificación:** bloqueador técnico de fidelidad, no regla pedagógica.

**Requisito antes de promover la Revisión V1:** definir un snapshot persistente de la salida final visible o garantizar que el historial reconstruya determinísticamente las mismas transformaciones antes de revisar el plan.

---

# Criterio de cierre de la calibración V1

El banco se considera consolidado para la fase shadow porque:

- detectó fallos reales que el `promotion_gate` actual no bloquea;
- los hallazgos reales pudieron mapearse a reglas existentes;
- no fue necesario crear excepciones específicas por planeación;
- se identificó qué puede verificarse determinísticamente y qué requiere juicio semántico;
- se confirmó que la cobertura estructural de fases no equivale a autenticidad metodológica;
- se confirmó que la revisión debe leer las acciones ejecutables como fuente principal de evidencia pedagógica.

A partir de este punto, nuevas reglas sólo deben incorporarse cuando un hallazgo real no pueda mapearse razonablemente a ninguna categoría existente.