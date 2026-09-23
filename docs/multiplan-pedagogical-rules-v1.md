# Multiplan — Banco consolidado de reglas pedagógicas V1

Estado: **especificación pedagógica consolidada**  
Ámbito: planeaciones NEM de primaria multigrado  
Aplicación inicial: revisión no gobernante; ninguna regla modifica automáticamente los PDA elegidos por el docente.

## Principio rector

Una planeación sólo puede considerarse pedagógicamente coherente cuando puede demostrarse la cadena:

**contexto → problemática → PDA → metodología → proyecto → producto final → sesiones → actividades → evidencias → evaluación**.

La relación temática no basta. Toda actividad central debe justificar qué aprendizaje desarrolla, qué PDA moviliza, qué evidencia deja y cómo aporta al proyecto.

## Escala de gravedad

- **CRÍTICO / 🔴**: rompe coherencia curricular, metodológica o de viabilidad. Debe impedir que la planeación sea considerada validada.
- **AJUSTE / 🟡**: la planeación puede utilizarse, pero requiere mejora explícita.
- **CORRECTO / 🟢**: la relación está suficientemente sustentada.

Las reglas marcadas como `BLOCK` son candidatas a compuerta de validación. Las marcadas como `WARN` generan advertencia. Las marcadas como `SCORE` alimentan un puntaje de calidad sin bloquear por sí mismas.

---

# A. Arquitectura del proyecto

### PRJ-01 — Problema y propósito deben conducir al producto
**Severidad:** 🔴 `BLOCK`  
El producto, acción o intervención final debe responder de forma directa a la problemática y al propósito del proyecto. No basta compartir tema o vocabulario.

**Prueba:** un revisor debe poder completar la frase: “Para responder a ___, el grupo construirá/realizará ___ porque ___”. Si no puede justificarse, falla.

### PRJ-02 — El producto final debe definirse antes de distribuir actividades
**Severidad:** 🔴 `BLOCK`  
La lógica de generación será: problema/propósito → producto final → etapas → sesiones → PDA necesarios → actividades → recursos. Una secuencia no debe construirse a partir de actividades sueltas a las que después se les atribuye relación con el proyecto.

### PRJ-03 — Debe existir un único proyecto común multigrado
**Severidad:** 🔴 `BLOCK`  
Puede haber aportes diferenciados por grado, pero todos deben integrarse en una misión, producto, servicio o intervención común. Se consideran incorrectas seis planeaciones paralelas unidas sólo por el tema.

### PRJ-04 — Cada grado debe tener una aportación identificable
**Severidad:** 🔴 `BLOCK`  
Para cada grado participante debe poder responderse: “¿qué aporta al proyecto común y qué aprendizaje/PDA desarrolla mediante esa aportación?”.

### PRJ-05 — El producto debe tener trayectoria de construcción
**Severidad:** 🔴 `BLOCK`  
Ningún producto complejo puede aparecer por primera vez al final. Debe existir una trayectoria observable de exploración, obtención de información, decisiones/diseño, elaboración, integración y revisión según corresponda.

### PRJ-06 — Los productos parciales deben alimentar el producto final
**Severidad:** 🔴 `BLOCK`  
Un producto parcial sólo es válido si se reutiliza, integra, compara, transforma o sirve de insumo para una etapa posterior. Si nunca vuelve a utilizarse, se considera producto aislado.

### PRJ-07 — Las actividades centrales deben aportar al proyecto
**Severidad:** 🟡 `WARN`  
Una actividad puede desarrollar un aprendizaje aunque no produzca directamente una parte del producto; en ese caso debe justificar por qué ese aprendizaje es necesario para la etapa actual. Actividades meramente temáticas o decorativas deben eliminarse o pasar a opcionales.

---

# B. Alineación PDA → actividad → evidencia → producto → evaluación

### PDA-01 — Respetar el verbo cognitivo del PDA
**Severidad:** 🔴 `BLOCK`  
La actividad y la evidencia deben permitir observar el desempeño expresado por el verbo central del PDA. Ejemplos mínimos:

- identifica/reconoce → distingue, selecciona, clasifica o señala;
- dialoga → intercambia ideas y construye significado con otros;
- indaga → busca, consulta, contrasta o analiza información/evidencias;
- explica → comunica relaciones, causas, procesos o significados;
- propone → formula una propuesta concreta;
- argumenta → ofrece razones o evidencias;
- representa → produce una representación observable;
- analiza → compara, interpreta o establece relaciones.

### PDA-02 — Evidencia observable por PDA trabajado
**Severidad:** 🔴 `BLOCK`  
Todo PDA declarado como trabajado debe tener al menos una evidencia verificable que permita inferir el desempeño solicitado. “Participó”, “escuchó” o “realizó actividad” no son evidencias suficientes si el PDA exige otra acción cognitiva.

### PDA-03 — Estados de trazabilidad por sesión
**Severidad:** 🔴 `BLOCK`  
Cada PDA debe clasificarse por sesión como:

- `WORKED`: actividad directa + evidencia suficiente;
- `DEVELOPING`: actividad preparatoria que contribuye, pero aún no demuestra el PDA;
- `NOT_MOBILIZED`: no hay actividad relacionada.

No se permite declarar `WORKED` por simple presencia temática.

### PDA-04 — Prohibido marcar todos los PDA en todas las sesiones
**Severidad:** 🔴 `BLOCK`  
La distribución debe reflejar la progresión real. La repetición automática de todos los PDA en cada sesión se considera error de trazabilidad.

### PDA-05 — Pertinencia del PDA respecto al proyecto
**Severidad:** 🟡 `WARN`  
Cada PDA se clasifica como `DIRECT`, `DIFFERENTIATED`, `SECONDARY` o `FORCED`. Un PDA `FORCED` no debe ocultarse mediante justificaciones artificiales: se advierte al docente y se ofrece mantenerlo con una línea específica, considerarlo secundario o elegir una alternativa pertinente.

### PDA-06 — La selección del docente es autoritativa
**Severidad:** 🔴 `BLOCK`  
El motor de revisión no puede agregar, sustituir ni eliminar silenciosamente PDA oficiales seleccionados por el docente. Puede advertir sobre pertinencia, pero cualquier cambio curricular requiere decisión docente.

### PDA-07 — Aportación al proyecto por PDA
**Severidad:** 🟡 `SCORE`  
Siempre que sea pedagógicamente natural, la evidencia de un PDA debe convertirse en insumo, decisión, producto parcial o criterio de revisión del proyecto. Si no aporta al proyecto, debe justificarse como aprendizaje habilitador necesario.

### PDA-08 — Evaluación alineada al desempeño
**Severidad:** 🔴 `BLOCK`  
Los criterios e instrumentos de evaluación deben observar el mismo desempeño exigido por el PDA y evidenciado en las actividades. No se valida una rúbrica o lista de cotejo que valore aspectos ajenos al aprendizaje declarado.

---

# C. Progresión y continuidad entre sesiones

### SES-01 — Cada sesión debe producir un avance concreto
**Severidad:** 🔴 `BLOCK`  
No basta tener inicio, desarrollo y cierre. La sesión debe modificar el estado del proyecto y dejar una evidencia, decisión, insumo o producto parcial utilizable posteriormente.

### SES-02 — Estado inicial y estado final explícitos
**Severidad:** 🟡 `SCORE`  
Cada sesión debe poder expresar:

1. de qué avance previo parte;
2. qué parte del proyecto desarrolla;
3. qué aprendizaje necesita;
4. qué evidencia deja;
5. cómo se reutilizará;
6. en qué estado queda el proyecto.

### SES-03 — La salida de una sesión alimenta la siguiente
**Severidad:** 🔴 `BLOCK`  
Salvo la sesión inicial, cada sesión debe recuperar algún acuerdo, información, evidencia o producto previo. Salvo la final, debe preparar una acción o necesidad de la siguiente.

### SES-04 — Detectar actividades aisladas
**Severidad:** 🟡 `WARN`  
Una actividad o producción que no se reutiliza, integra, evalúa ni habilita un aprendizaje necesario debe señalarse como aislada.

### SES-05 — Progresión auténtica
**Severidad:** 🔴 `BLOCK`  
La secuencia completa debe mostrar una progresión lógica —por ejemplo explorar → investigar → comprender → decidir/diseñar → producir/actuar → integrar → compartir/intervenir → valorar— adaptada a la metodología elegida.

### SES-06 — El cierre final debe completar el ciclo del proyecto
**Severidad:** 🟡 `WARN`  
La última sesión debe permitir presentar, aplicar, intervenir, compartir, contrastar, evaluar o valorar el producto/acción según la metodología. Un cierre exclusivamente administrativo o reflexivo es insuficiente cuando la metodología exige actuación o intervención.

---

# D. Metodologías NEM

### MET-01 — La metodología debe observarse en las acciones del alumnado
**Severidad:** 🔴 `BLOCK`  
No basta colocar nombres de fases. Las acciones, decisiones, productos y relaciones entre sesiones deben cumplir la función pedagógica de la fase correspondiente.

### MET-02 — Secuencia metodológica coherente
**Severidad:** 🔴 `BLOCK`  
Las fases deben conservar un orden pedagógico reconocible y cada una debe preparar la siguiente. No pueden asignarse fases sólo por repartirlas proporcionalmente entre sesiones.

### MET-03 — ABP debe sostener un problema real y una respuesta razonada
**Severidad:** 🔴 `BLOCK`  
Si se usa Aprendizaje Basado en Problemas, debe existir delimitación/comprensión del problema, recuperación o búsqueda de información, formulación/organización de posibles respuestas, experiencia de resolución y análisis de resultados.

### MET-04 — STEAM debe incluir indagación y construcción de explicaciones
**Severidad:** 🔴 `BLOCK`  
Si se usa indagación con enfoque STEAM, deben observarse preguntas o identificación del fenómeno, diseño de indagación, obtención/organización de evidencias, construcción de respuestas o explicaciones, aplicación/comunicación y reflexión.

### MET-05 — Aprendizaje Servicio debe incluir servicio real o realizable
**Severidad:** 🔴 `BLOCK`  
La planeación debe transitar de una necesidad/punto de partida a organización y acción de servicio con destinatario realista, y finalizar con valoración de lo aprendido y del servicio. Una producción sólo para el grupo no debe presentarse automáticamente como servicio.

### MET-06 — Proyectos Comunitarios debe llegar a acción/intervención
**Severidad:** 🔴 `BLOCK`  
Si se declara una fase de intervención, debe existir actuación, comunicación, transformación, aplicación o incidencia verificable en la comunidad definida. Una reflexión interna no equivale a intervención.

### MET-07 — No inventar contexto, beneficiarios o recursos
**Severidad:** 🔴 `BLOCK`  
La metodología no debe fabricar internet, dispositivos, visitas, expertos, materiales, estadísticas, beneficiarios externos o acciones comunitarias no declaradas o no razonablemente disponibles.

---

# E. Productos, evidencias y evaluación

### EVD-01 — Evidencia distinta de actividad
**Severidad:** 🔴 `BLOCK`  
La evidencia describe el resultado observable del aprendizaje, no sólo la consigna realizada.

### EVD-02 — Evidencias acumulables cuando el proyecto lo requiera
**Severidad:** 🟡 `SCORE`  
La secuencia debe conservar registros, acuerdos, borradores, datos, producciones o decisiones que permitan reconstruir el proceso y alimentar etapas posteriores.

### EVD-03 — Producto final integrador
**Severidad:** 🔴 `BLOCK`  
El producto final debe integrar aportes de los grados y representar la culminación del proyecto, no una suma sin relación de trabajos individuales.

### EVD-04 — Evaluación formativa durante la construcción
**Severidad:** 🟡 `WARN`  
Además de la evaluación final, debe existir al menos una oportunidad de revisión, retroalimentación, autocorrección, coevaluación o mejora del producto/proceso antes del cierre cuando la duración del proyecto lo permita.

### EVD-05 — Evaluación sin atribución curricular indebida
**Severidad:** 🔴 `BLOCK`  
Las tareas transversales sin PDA oficial del grado pueden valorarse como participación/aporte al proyecto, pero no deben presentarse como evidencia de un PDA no seleccionado.

---

# F. Integración multigrado

### MG-01 — Experiencia común con diferenciación auténtica
**Severidad:** 🔴 `BLOCK`  
La estructura esperada es: experiencia/problema común + tareas diferenciadas + aportaciones integradas. Cambiar sólo el número de grado no constituye diferenciación.

### MG-02 — Diferenciación por complejidad, apoyo, producto o responsabilidad
**Severidad:** 🟡 `WARN`  
Entre grados debe cambiar al menos uno de estos elementos cuando los PDA lo requieran: complejidad cognitiva, nivel de apoyo, autonomía, forma de representación, responsabilidad, profundidad o tipo de producto.

### MG-03 — Simultaneidad viable
**Severidad:** 🔴 `BLOCK`  
No pueden existir dos o más tareas que exijan atención directa exclusiva del mismo docente al mismo tiempo. Los demás grupos deben contar con una tarea autónoma, colaborativa o previamente modelada y realizable.

### MG-04 — Instrucciones autónomas suficientes
**Severidad:** 🟡 `WARN`  
Las tareas realizadas mientras el docente atiende otro grado deben incluir consigna clara, recursos disponibles, criterio de avance/verificación y alternativa de apoyo si el estudiante se atasca.

### MG-05 — Transiciones explícitas
**Severidad:** 🟡 `SCORE`  
La planeación debe prever cómo se pasa de atención directa a trabajo autónomo/colaborativo y cómo se reúnen nuevamente los aportes sin pérdidas de tiempo inviables.

### MG-06 — Tutoría entre pares con finalidad pedagógica
**Severidad:** 🟡 `WARN`  
La tutoría entre grados debe usarse cuando beneficia a ambos participantes y no como sustitución permanente de la enseñanza del docente.

### MG-07 — Integración final de aportes
**Severidad:** 🔴 `BLOCK`  
Debe existir al menos un momento en que los aportes diferenciados se comparen, ensamblen, comuniquen o utilicen conjuntamente para avanzar el producto común.

---

# G. LTG y recursos

### LTG-01 — La pertinencia curricular no basta
**Severidad:** 🟡 `WARN`  
Una actividad de LTG debe corresponder además con etapa del proyecto, propósito de la sesión, metodología, producto en construcción, grado, contexto y organización multigrado.

### LTG-02 — LTG que rompe progresión pasa a opcional
**Severidad:** 🟡 `WARN`  
Si una actividad de LTG es curricularmente útil pero interrumpe la trayectoria del proyecto, debe presentarse como recurso complementario u opcional, no como actividad central.

### LTG-03 — No inventar disponibilidad de recursos
**Severidad:** 🔴 `BLOCK`  
Los recursos centrales deben provenir de los declarados o ser materiales escolares/comunitarios razonables. Si una actividad depende de un recurso no garantizado, se exige alternativa equivalente.

### LTG-04 — El recurso debe cumplir una función identificable
**Severidad:** 🟡 `SCORE`  
Toda lectura, juego, dinámica, ficha o material debe indicar qué aprendizaje habilita o qué avance del proyecto facilita.

---

# H. Tiempo y viabilidad

### TIME-01 — Suma exacta de tiempos
**Severidad:** 🔴 `BLOCK`  
La suma de apertura, momentos de trabajo, transiciones y cierre no puede exceder los minutos de la sesión ni presentar tiempos negativos o inexistentes.

### TIME-02 — Carga cognitiva y productiva realizable
**Severidad:** 🔴 `BLOCK`  
No se puede exigir investigar, analizar, producir, revisar y presentar un producto complejo en un tiempo incompatible con esas acciones. La revisión debe considerar cantidad de tareas, dificultad, edad/grado y organización multigrado.

### TIME-03 — Priorizar tiempo útil de aprendizaje/proyecto
**Severidad:** 🟡 `WARN`  
La mayor parte del tiempo debe destinarse a aprender, indagar, resolver, producir, dialogar, experimentar, revisar o avanzar el proyecto. Aperturas, juegos y cierres requieren función explícita.

### TIME-04 — Tiempo para construir antes de evaluar o presentar
**Severidad:** 🔴 `BLOCK`  
No puede evaluarse o presentar un producto que no haya tenido tiempo suficiente de elaboración y, cuando corresponde, revisión.

---

# I. Contexto y coherencia global

### COH-01 — Contexto aplicado, no decorativo
**Severidad:** 🟡 `WARN`  
Al menos decisiones relevantes del problema, ejemplos, recursos, beneficiarios, organización o producto deben derivarse del contexto declarado. Repetir literalmente el contexto sin modificar la planeación no cuenta como aplicación.

### COH-02 — Problemática presente a lo largo del proyecto
**Severidad:** 🟡 `SCORE`  
La problemática debe seguir orientando preguntas, decisiones, producción y cierre. Si desaparece después de la introducción, la coherencia disminuye.

### COH-03 — Coherencia global verificable
**Severidad:** 🔴 `BLOCK`  
Si una planeación cumple componentes aislados pero no puede explicar la relación entre problema, PDA, producto, sesiones, evidencias y evaluación, no se considera validada.

---

# J. Política de validación

### VAL-01 — Ninguna advertencia modifica silenciosamente el currículo
**Severidad:** 🔴 `BLOCK`  
El revisor puede proponer correcciones, pero no alterar PDA oficiales, grado, contenidos oficiales o selección del docente sin confirmación explícita.

### VAL-02 — Separar generación de revisión
**Severidad:** arquitectura  
La revisión pedagógica debe recibir una planeación ya generada y emitir hallazgos. En su primera fase no reescribe la planeación ni gobierna el motor visible.

### VAL-03 — Hallazgo explicable
**Severidad:** arquitectura  
Cada hallazgo debe devolver:

- `rule_id`;
- `severity`;
- `status`;
- ubicación (sesión, grado, PDA o producto cuando aplique);
- qué falla;
- por qué importa;
- comportamiento esperado;
- evidencia observada;
- recomendación.

### VAL-04 — Resultado global
**Severidad:** arquitectura  
Estados de revisión:

- `BLOCKED`: existe al menos un error crítico confirmado;
- `NEEDS_ADJUSTMENT`: no hay críticos, pero sí advertencias;
- `PEDAGOGICALLY_COHERENT`: no hay críticos y los ajustes restantes son menores/informativos.

### VAL-05 — No bloquear por ausencia de información no disponible
**Severidad:** arquitectura  
Cuando la salida no contiene datos suficientes para verificar una regla semántica, el estado será `NOT_EVALUABLE`, no fallo automático. El motor debe distinguir “no comprobado” de “incorrecto”.

### VAL-06 — Puntaje complementario, no sustituto de las compuertas
**Severidad:** arquitectura  
Puede calcularse un puntaje de 0–100 para orientar mejora, pero ningún puntaje alto compensa una regla crítica incumplida.

---

# K. Pruebas pedagógicas mínimas de regresión

1. **PDA sin evidencia:** declarar un PDA como trabajado sin actividad/evidencia debe producir `PDA-02` crítico.
2. **Verbo incompatible:** PDA “argumenta” con actividad únicamente de copiar información debe producir `PDA-01` crítico.
3. **Producto súbito:** producto final que aparece sólo en la última sesión debe producir `PRJ-05` crítico.
4. **Actividad aislada:** una producción de sesión intermedia nunca reutilizada debe generar `SES-04` advertencia.
5. **Sesiones desconectadas:** ninguna sesión recupera evidencias previas debe producir `SES-03` crítico.
6. **Metodología nominal:** fases correctas en encabezados, pero acciones incompatibles, debe producir `MET-01` crítico.
7. **Intervención ficticia:** Proyectos Comunitarios con “intervención” limitada a comentar en el salón debe producir `MET-06` crítico.
8. **Servicio ficticio:** Aprendizaje Servicio sin destinatario/acción de servicio realizable debe producir `MET-05` crítico.
9. **Seis planes paralelos:** productos independientes sin integración común debe producir `PRJ-03`/`MG-07` críticos.
10. **Doble atención docente:** dos grados requieren atención directa exclusiva en el mismo momento debe producir `MG-03` crítico.
11. **LTG pertinente pero inoportuno:** actividad curricular que rompe la fase del proyecto debe producir `LTG-02` advertencia.
12. **Tiempo imposible:** suma superior a minutos disponibles o producto complejo sin construcción debe producir `TIME-01`/`TIME-02` críticos.
13. **PDA forzado:** PDA con relación sólo temática debe producir `PDA-05` advertencia, sin eliminarlo automáticamente.
14. **Transversal sin currículo:** tarea transversal atribuida a PDA no seleccionado debe producir `EVD-05` crítico.
15. **Caso correcto:** proyecto común, aportes diferenciados, trayectoria visible, PDA/evidencias alineados y tiempos viables debe quedar sin críticos.

---

# L. Orden recomendado de evaluación

La revisión debe ejecutarse en este orden para evitar diagnósticos engañosos:

1. integridad estructural y tiempo;
2. propósito/problema y producto final;
3. trayectoria del proyecto y continuidad entre sesiones;
4. alineación PDA–actividad–evidencia–evaluación;
5. metodología NEM;
6. integración multigrado y simultaneidad;
7. LTG/recursos/contexto;
8. calidad global y recomendaciones.

## Criterio de cierre V1

Este banco se considera consolidado cuando cada hallazgo de nuevas planeaciones puede:

- mapearse a una regla existente, o
- demostrar una categoría pedagógica realmente nueva.

Las reglas nuevas deben añadirse por categoría y no como excepción específica de una planeación.