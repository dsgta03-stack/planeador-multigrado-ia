# Ejecutabilidad docente en Consolidation R1

Base de trabajo: rama `consolidation-single-app-r1`, commit
`25c74b2eda2f09e6e323096231847429626d602f`.

## Problema y flujo comprobados

El autor de SessionGraph podía declarar textos no vacíos pero genéricos. El
compilador y SGD-011 comprobaban presencia y vínculos, no un procedimiento.
El adaptador canónico conservaba las actividades en `sessions`, pero reducía
`teacher_presentation.activity_blocks` a label/narrative/rol/minutos/evidencia.
Las narrativas de preparación/cierre quedaban vacías. La UI ocultaba los
campos pedagógicos que ya existían. SGD-013 sólo controlaba IDs LTG y NONE.

Flujo real de Consolidation R1:

- La ruta canónica ejecuta `runShadowPipeline` una vez.
- El compilador construye SessionGraph desde el Blueprint aprobado.
- Session Gate y Critical Gate deben aprobarlo antes de `projectTeacherPlan`.
- `canonicalPlanFromPipelineResult` usa `adaptTeacherProjectionToCanonicalPlan`.
- El ciclo canónico conserva `canonical_plan_hash` para snapshot, historial,
  revisión y DOCX.
- La UI consolidada presenta `teacher_presentation` de ese mismo plan.

## Contrato y gates

La versión continúa siendo SessionGraphV1. En el esquema histórico,
`session.ltg_decisions`, `activity.execution` y `activity.ltg_use` son extensiones
opcionales, validadas si están presentes. Esto conserva el reconocimiento de
artefactos V1 previos sin reaprobarlos mediante gates actuales. La autoría nueva
requiere execution/ltg_use y decisiones LTG cuando corresponda; el compilador
los produce y los gates actuales rechazan su ausencia. No existe un bypass
legacy dentro del pipeline nuevo. Cada actividad nueva requiere
`execution` con:

- `preparation`: preparación concreta del docente;
- `instruction`: consigna;
- `student_steps`: acciones ordenadas, sin un mínimo de palabras;
- `grouping`: organización;
- `guidance`: preguntas/modelado; puede estar vacío cuando no hace falta;
- `resource_use`: uso de cada recurso declarado, sin recursos nuevos;
- `contingency`: intervención si el alumno no avanza;
- `connection`: uso siguiente de la evidencia o cierre terminal.

Se reutilizan `teacher_role`, `grade_participation`, `output`, `evidence` y
`assessment_criteria`: no hay reescritura posterior ni una segunda IA.
SGD-017 valida la estructura sin exigir verbos de una lista cerrada, bloquea las tareas
genéricas conocidas, los pasos duplicados, la omisión de usos de materiales y
la diferenciación idéntica entre todos los grados. Si el rol promete modelado
sin guía concreta, lo bloquea. Las instrucciones breves concretas pueden pasar.
El compilador y la validación del grafo aplican la misma comprobación.

SGS-011, dentro de la revisión semántica ya existente, exige coherencia,
viabilidad, diferenciación real, necesidad de preguntas/modelado y ausencia de
relleno. Las comprobaciones locales son guardas conservadoras: no demuestran
por sí solas la calidad de todo texto libre. Un PASS estructural no sustituye
la revisión semántica ni Critical Gate. No se añadieron llamadas al proveedor.

## LTG

Cada actividad declara `ltg_use`; cada sesión compilada conserva `ltg_decisions`.
Para cada selección cuyo PDA está en el foco de la sesión:

- CORE requiere al menos un uso concreto en el grafo donde curricularmente
  corresponda; no se exige repetirlo en cada sesión con el mismo PDA. Una
  decisión USE requiere uso concreto y verificado. La pertinencia curricular
  se audita mediante la revisión semántica existente;
- SUPPORT puede fortalecer una actividad sin forzar su uso en todas las sesiones
  con el mismo PDA; si se usa debe registrar USE, y si no se usa puede omitir
  la decisión;
- OPTIONAL requiere USE o NOT_RECOMMENDED con motivo explícito;
- NONE no permite uso ni selección ajenos al Blueprint.

CORE además debe aparecer en el grafo. Los IDs usados deben coincidir con
`ltg_activity_ids`, tener grado/PDA verificado y estar autorizados por el
Blueprint. Un uso indica acción, momento y aporte. `activity_id:null` permite
usar el proyecto verificado sin inventar una actividad cuando no se seleccionó
una actividad específica (`selection.activity_ids` vacío). Si hay IDs
seleccionados, null se rechaza y se exige uno de ellos. Libro, proyecto, grado,
páginas y actividad se copian
exclusivamente de CurriculumSnapshot; el autor no puede escribir `reference`.
El gate recompone la referencia y rechaza cualquier alteración.

## Conservación y presentación

Proyección, TeacherPlanView y plan canónico conservan ejecución, usos y
 decisiones LTG. El canónico conserva también la sesión completa, operaciones
metodológicas y trazabilidad. El algoritmo de hashes no cambia: los nuevos
datos quedan cubiertos por los hashes de sus objetos completos.

La UI muestra propósito, preparación, consigna, pasos, organización, intervención,
acciones/diferenciación por grado, materiales/uso, apoyos, evidencia, criterios,
LTG y conexión. Mantiene el detalle técnico desplegable y lo actualiza al cambiar
el plan. El historial reutiliza esa misma presentación. Los planes históricos
sin `execution` siguen siendo presentables con sus datos existentes; no se
rellenan ni revalidan artificialmente.

El adaptador construye la narrativa textual para el exportador DOCX existente
sólo concatenando textos aprobados con etiquetas. Incluye también los motivos
de no uso LTG. No se modificaron snapshot, review, hash binding ni exportador.

## Verificación local

Node 24.19.0 (cumple >=22); dependencia existente docx 9.7.1, sin cambios de
package.json ni actualización de dependencias. Red externa bloqueada durante
las suites; los handlers HTTP se probaron sólo en loopback con dependencias
inyectadas.

- Suite completa `node --test tests/*.mjs shadow/{project-blueprint-v1,session-graph-v1,pipeline-v1,presentation-v1,integration-v1,router-integration-v1}/tests/*.test.mjs`:
  **314 PASS, 0 FAIL**.
- `npm run check:v0124`: PASS.
- `npm test`: PASS.
- `npm run test:routes`: PASS.
- Renderer serializado para el navegador y contenido XML del DOCX: PASS.

Los fixtures sintéticos de autoría se actualizaron con procedimiento para
conservar todas sus pruebas previas de grado, PDA, dependencias, reparación,
metodología y gates. No se quitaron aserciones. La suite amplia detectó además
cuatro fallos preexistentes de `tests/v0124-certified-runtime.mjs`; se reprodujeron
en el ZIP original. Sólo se corrigió su endpoint de fixture al path actual
`/functions/v1/plan-project-blueprint-v1-shadow`, manteniendo y ampliando el
rechazo del endpoint antiguo. Esta corrección se entrega en un patch separado
de mantenimiento de tests, excluido del patch pedagógico. Las suites se ejecutan
con ambos patches presentes en la copia local; el runtime no cambió.

Los tests focalizados cubren además medir, calcular, recortar, representar,
experimentar y entrevistar/consultar; SUPPORT usado sólo en una de dos sesiones
con el mismo PDA; null rechazado con IDs seleccionados y permitido sin ellos,
con referencias curriculares exactas y rechazo de páginas manipuladas.
También cubren compatibilidad del contrato histórico V1, rechazo de nueva
autoría sin execution y rechazo por SGD-017 en el gate actual; CORE usado
una sola vez en dos sesiones con el mismo PDA, PASS del grafo y rechazo al
quitar el único uso. Los ajustes anteriores siguen vigentes.

Los nuevos tests se incorporaron al workflow CI existente, sin crear workflows.

## Pendiente antes de promoción

Revisión del diff antes del commit final. No se hizo commit, push, deployment ni
llamada real al proveedor. Esta verificación local no acredita aún la calidad
de una generación real con el contrato fortalecido. Una evaluación posterior,
si se autoriza, deberá usar la rama de trabajo aislada; producción y el shadow
estable siguen sin cambios. No hace falta reconstruir el proyecto ni crear
una versión nueva para revisar estos cambios.
