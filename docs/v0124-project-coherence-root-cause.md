# v0.12.4 — causa raíz de la pérdida de coherencia del proyecto

## Hallazgo
En una prueba autenticada real, V6.5 Beta.10 generó internamente un proyecto común con título, producto colectivo, misión y contribuciones por grado, pero la interfaz presentó sesiones heredadas como actividades/productos independientes y ocultó el proyecto común.

Caso observado:
- Título interno: **Guardianes de nuestra identidad: El legado de los símbolos patrios**.
- Producto común interno: **Exposición comunitaria de identidad nacional**.
- La salida visible mostró actividades por grado (alebrijes, leyendas, álbumes, murales, etc.) sin dejar claro que eran aportes diferenciados al mismo producto común.

## Causa raíz
La arquitectura acumulada tenía dos reglas incompatibles:

1. V6.5 Beta.10 protegía el núcleo heredado de V6.4 con la compuerta `immutable_v64_core`.
2. La nueva regla pedagógica de Multiplan exige lógica **proyecto primero**: problema/propósito → producto final común → etapas del proyecto → sesiones → actividades → evidencias.

Beta.10 añadía `methodology_engine.integrated_project` y `methodology_engine.sessions`, pero conservaba `out.sessions` heredadas. Luego v0.12.0 distribuía etiquetas de fases metodológicas sobre esas sesiones sin convertir los campos `project_advance` y `product_relation` en la secuencia visible. El resultado era una metodología declarada, pero no necesariamente ejecutada como trayectoria de proyecto.

No es un problema de múltiples bases curriculares. Es un conflicto entre capas/versiones de lógica del motor.

## Corrección shadow: PROJECT-COHERENCE-V1
La v0.12.4 candidata aplica una capa determinista después de la generación y antes del snapshot final.

Garantías:
- un solo título autoritativo de proyecto;
- un solo producto final común;
- contribuciones diferenciadas por grado tratadas como partes del producto común, no como seis proyectos finales independientes;
- cada sesión contiene fase, propósito vinculado al producto, avance del proyecto, producto parcial, continuidad y preparación de la siguiente sesión;
- `teacher_presentation` recibe el mismo título y progresión;
- el snapshot/historial/revisor reciben esta misma versión final;
- porcentajes de avance arbitrarios como `50%` se eliminan de la guía si no representan una medición real.

## Regresión añadida
`tests/project-coherence-v1.mjs` reproduce el patrón real de 6 grados, 5 sesiones, Proyectos Comunitarios y producto común. La prueba exige:
- título visible;
- producto final común;
- 5 sesiones con progresión explícita;
- mismo título en presentación docente;
- modelo `ONE_COMMON_PRODUCT_WITH_DIFFERENTIATED_GRADE_CONTRIBUTIONS`;
- ningún porcentaje arbitrario de avance.

## Decisión arquitectónica pendiente
`PROJECT-COHERENCE-V1` estabiliza la salida sin alterar currículo ni PDA. A largo plazo, la generación debe migrar a una arquitectura nativa proyecto-primero, para que el proyecto se determine antes de construir las sesiones y no sólo se armonice después. La compuerta `immutable_v64_core` deberá redefinirse para preservar currículo/tiempos/selección docente sin impedir una reorganización pedagógica coherente de las sesiones.
