# V6.5 Beta.9 — regresión metodológica transversal

Fecha: 2026-09-22

## Regla validada

Los grados sin PDA reciben una reescritura metodológica aislada que sólo conoce:

- problemática y contexto comunes;
- características del grado;
- recursos y apoyos declarados;
- tarea, evidencia y aporte seguro generados para el proyecto;
- metodología principal y estructura temporal.

La reescritura no recibe PDA, contenidos oficiales, LTG ni criterios curriculares de otros grados.

## Resultados

| Caso | Metodología | Cobertura | Fases | Procedimientos | Conceptos ajenos | Resultado |
|---|---|---:|---:|---:|---:|---|
| ABP | Aprendizaje Basado en Problemas | 10/10 | 5/5 | 3–6 pasos y minutos exactos | 0 | PASS |
| STEAM | STEAM | 10/10 | 5/5 | 3–6 pasos y minutos exactos | 0 | PASS |
| Servicio | Aprendizaje Servicio | 10/10 | 5/5 | 3–6 pasos y minutos exactos | 0 | PASS |
| Comunitario | Proyectos Comunitarios | 10/10 | 5/5 | 3–6 pasos y minutos exactos | 0 | PASS |

La primera corrida fue rechazada porque Gemini devolvió dos pasos por tarea. El esquema y la instrucción se reforzaron para exigir entre tres y seis pasos; la segunda corrida aprobó los cuatro casos.

## Estado de promoción

`V6.5-METHODOLOGY-ENGINE-BETA.9-TRANSVERSAL-ISOLATION` permanece en modo `shadow-non-governing`. Aunque la regresión aislada aprobó, la capa no debe hacerse visible hasta obtener una ejecución real autenticada que confirme todas las compuertas sobre una planeación V6.4 completa.
