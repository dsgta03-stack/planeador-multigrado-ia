# Regresión: selección docente y grados transversales

## Invariantes obligatorios

1. La selección de PDA/contenidos hecha por el docente es autoritativa.
2. Multiplan nunca selecciona, completa, infiere ni presta un PDA a un grado donde el docente no lo seleccionó.
3. Un grado sin PDA seleccionado participa como `TRANSVERSAL_PROJECT`.
4. Un grado transversal conserva `pda_ids: []`, no recibe LTG ajeno y no se evalúa como si hubiera logrado un PDA no seleccionado.
5. Las actividades, productos y evidencias transversales se derivan de la problemática, contexto, edad/grado, lectura, escritura, autonomía, apoyos y recursos.
6. Cuando existen PDA en otros grados, la salida transversal se genera en una pasada aislada que no recibe dichos PDA.
7. La pasada transversal debe superar el postcheck `FOREIGN-PDA-ROOT`: si detecta conceptos específicos ajenos que no están en problema/contexto, se regenera una vez; si persisten, la generación se rechaza.
8. En bloques mixtos, la UI debe mostrar trazabilidad por grado para distinguir `PDA_SELECTED` de `TRANSVERSAL_PROJECT`.
9. Con 3 o más grados, máximo 2 grados bajo atención directa en cada momento; todos los grados aparecen exactamente una vez por momento.
10. Cero PDA seleccionados es una entrada válida.

## Casos de regresión

### A — 1.º a 6.º, cero PDA
Problema: uso excesivo de redes sociales / mala organización del tiempo.

Esperado:
- todos los grados `TRANSVERSAL_PROJECT`;
- ningún PDA, LTG o criterio curricular inventado;
- actividades diferenciadas por edad;
- productos vinculados al problema común.

Resultado de prueba 2026-09-21: PASS.

### B — PDA sólo en 1.º, 2.º y 4.º
PDA de prueba: `F3-ENS-1-014`, `F3-ENS-2-014`, `F4-SPC-4-009`.

Esperado:
- 3.º, 5.º y 6.º transversales;
- los PDA sólo se aplican a sus grados oficiales;
- si un bloque mezcla grados con y sin PDA, las acciones se distinguen explícitamente por grado;
- máximo 2 grados bajo atención directa.

Hallazgo inicial: Gemini intentó 3 grados directos; el repair estructural lo corrigió.
Resultado estructural reparado: PASS.

### C — PDA sólo en 4.º
PDA de prueba: `F4-SPC-4-009` (alimentación / influencia de medios y redes).

Esperado:
- 1.º, 2.º, 3.º, 5.º y 6.º transversales;
- esos grados no realizan actividades de alimentación, menús, nutrición, consumo o economía si esos temas no aparecen en el problema/contexto.

Hallazgo inicial: FAIL semántico aunque los IDs estaban correctos; el contenido de 4.º se filtró a otros grados.
Corrección: `TRANSVERSAL-LOCK-V1.1` con generación aislada + postcheck de raíces temáticas + un reintento.
Prueba aislada posterior, sin proporcionar PDA a la pasada transversal: PASS; cero coincidencias en raíces prohibidas de alimentación/consumo/economía/azúcar/grasa/nutrición/menú.

## Motores que deben conservar estas reglas

- `PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE+TRANSVERSAL-LOCK-V2.2-CONCEPT-GUARD`
- `V6.4-MULTIGRADE-DIDACTIC-BETA.6.2-CONCEPT-GUARD`
- Renderer: `GRADE-TASK-TRACE-V1`
- V6.5 metodología: `V6.5-METHODOLOGY-ENGINE-BETA.9-TRANSVERSAL-ISOLATION` ejecuta la reescritura transversal equivalente, pero permanece en `shadow` hasta aprobar una ejecución real autenticada de extremo a extremo.

## Regresión semántica derivada — 2026-09-22

El caso C se amplió para derivar de forma explícita los conceptos propios del PDA ajeno. Con el problema de uso excesivo de redes sociales y un PDA de alimentación sólo en 4.º, la política bloqueó alimentación, nutrición, Plato del Bien Comer, grasa, azúcar, ultraprocesados y economía familiar. No hubo coincidencias en productos ni procedimientos transversales: PASS.

El control D incluyó alimentación dentro de la problemática común para comprobar que el filtro no la excluyera indebidamente: PASS.
