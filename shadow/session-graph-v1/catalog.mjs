export const SESSION_GRAPH_VERSION='SESSION_GRAPH_V1';
export const SESSION_GRAPH_PROPOSAL_VERSION='SESSION_GRAPH_AUTHORING_V1';
export const SESSION_GRAPH_GATE_VERSION='SESSION_GRAPH_GATE_V1';
export const BLUEPRINT_APPROVAL_VERSION='PROJECT_BLUEPRINT_APPROVAL_V1';

export const CONTRIBUTION_MODES=Object.freeze(['DIRECT','COMPLEMENTARY']);
export const PDA_MOBILIZATION_STATUSES=Object.freeze(['WORKED','DEVELOPING']);

export const METHODOLOGY_OPERATION_SEMANTICS=Object.freeze({
 IDENTIFICACION:Object.freeze({required:'El alumnado identifica, describe o delimita de forma observable la situación, problema o elemento que será trabajado.',not_enough:'Nombrar el tema o escuchar una explicación docente sin identificar nada.'}),
 RECUPERACION:Object.freeze({required:'El alumnado recupera, expresa, registra, compara o pone en juego saberes, experiencias o información previa pertinente.',not_enough:'Recibir información nueva sin recuperar saberes o experiencias previas.'}),
 PLANIFICACION:Object.freeze({required:'El alumnado toma decisiones de organización: criterios, orden, responsabilidades, ruta de trabajo o acciones concretas para producir el resultado.',not_enough:'Conversar sobre lo que podría hacerse sin decidir un plan verificable.'}),
 ACERCAMIENTO:Object.freeze({required:'El alumnado se acerca de forma activa a información, fuentes, materiales, situaciones u observaciones pertinentes para comprender el objeto de trabajo.',not_enough:'Mencionar que se revisará información sin consulta, observación o exploración efectiva.'}),
 COMPRENSION_Y_PRODUCCION:Object.freeze({required:'En la misma actividad el alumnado procesa o comprende información Y produce, construye o transforma un componente concreto del trabajo o artefacto.',not_enough:'Sólo analizar, revisar, conversar, ordenar o comprender sin producir/construir algo concreto.'}),
 RECONOCIMIENTO:Object.freeze({required:'El alumnado reconoce hallazgos, relaciones, dificultades, criterios, diferencias, avances o necesidades de ajuste a partir del trabajo realizado.',not_enough:'Etiquetar la actividad como reconocimiento sin una acción observable de revisión, contraste o identificación.'}),
 CONCRECION:Object.freeze({required:'El alumnado concreta, termina, ensambla o deja listo un producto, componente o decisión sustantiva prevista para la etapa.',not_enough:'Preparar materiales o bosquejos que todavía no constituyen una concreción del producto.'}),
 INTEGRACION:Object.freeze({required:'El alumnado integra, combina, organiza o ensambla componentes ya producidos para formar una unidad funcional del proyecto.',not_enough:'Mover materiales o colocarlos sin integrar componentes con una finalidad funcional.'}),
 DIFUSION:Object.freeze({required:'En la misma actividad el alumnado comunica, presenta, explica o socializa el producto, hallazgo o mensaje ante una audiencia real y explícita.',not_enough:'Montar, trasladar, ensayar, diseñar una ruta, preparar una presentación o mencionar visitantes sin comunicar realmente a una audiencia.'}),
 CONSIDERACIONES:Object.freeze({required:'El alumnado recoge, considera o analiza comentarios, resultados, dificultades, criterios o efectos para valorar lo realizado y decidir ajustes o aprendizajes.',not_enough:'Cerrar la actividad o circular el producto sin considerar información de retorno o resultados.'}),
 AVANCES:Object.freeze({required:'El alumnado identifica, compara, registra o explica avances, cambios, mejoras, aprendizajes o pendientes a partir de evidencias del proceso.',not_enough:'Afirmar que hubo avances sin comparación, registro, reflexión o evidencia observable.'})
});

export const SGD=Object.freeze({
 'SGD-001':'El grafo está ligado exactamente a un ProjectBlueprint aprobado y a sus fuentes.',
 'SGD-002':'Existe exactamente una sesión por cada sesión del Blueprint, en el mismo orden y numeración.',
 'SGD-003':'Meta, estado, PDA, operaciones metodológicas y artefactos de cada sesión son una proyección inmutable del Blueprint.',
 'SGD-004':'Las actividades tienen identidad y orden canónicos, sin duplicados ni sesiones vacías.',
 'SGD-005':'Los minutos son positivos y la suma por sesión no excede el presupuesto aprobado.',
 'SGD-006':'Recursos y apoyos usados están autorizados por TeacherConstraints.',
 'SGD-007':'Cada participación por grado moviliza sólo PDA autorizados del mismo grado y del foco de la sesión.',
 'SGD-008':'Cada operación metodológica aprobada para la sesión está ejecutada por al menos una actividad y no aparecen operaciones ajenas.',
 'SGD-009':'Los inputs de actividad provienen de artefactos de entrada de la sesión o de outputs anteriores; no hay dependencias futuras.',
 'SGD-010':'Toda actividad directa contribuye a un artefacto esperado; toda actividad complementaria alimenta una actividad posterior.',
 'SGD-011':'Cada actividad declara acción del alumnado, rol docente, output, evidencia y criterio de evaluación observables.',
 'SGD-012':'Cada requisito funcional del resultado final está enlazado a actividades de las etapas autorizadas para construirlo.',
 'SGD-013':'Los vínculos LTG, si existen, pertenecen a selecciones verificadas del Blueprint; modo NONE implica ausencia total de vínculos.',
 'SGD-014':'Cada sesión moviliza todos los grados que tienen PDA en su foco sin atribuir exigencias curriculares ajenas.',
 'SGD-015':'La última sesión conserva el cierre terminal del Blueprint y ninguna actividad inventa una sesión posterior.',
 'SGD-017':'Cada actividad incluye preparación, consigna, pasos, organización, uso de recursos, intervención, apoyo y conexión ejecutables; una tarea genérica no basta.',
 'SGD-016':'La trazabilidad derivada coincide con las actividades compiladas y no puede ser escrita por el modelo.',
});

export const SGS=Object.freeze({
 'SGS-001':'Las actividades hacen avanzar el estado de cada sesión desde project_state_before hasta project_state_after.',
 'SGS-002':'Las acciones por grado desarrollan realmente el desempeño cognitivo del PDA completo; WORKED sólo es válido cuando la actividad realiza el desempeño y finalidad completos, DEVELOPING cuando sólo moviliza una parte.',
 'SGS-003':'La evidencia y los criterios permiten observar el aprendizaje declarado y el avance del proyecto mediante desempeños, productos o registros verificables, no fórmulas vagas.',
 'SGS-004':'Las operaciones metodológicas se realizan auténticamente mediante acciones del alumnado.',
 'SGS-005':'No hay actividades de relleno ni falsos DIRECT: DIRECT produce una parte observable del artefacto esperado; una preparación necesaria consumida después es COMPLEMENTARY.',
 'SGS-006':'La secuencia de outputs e inputs produce los artefactos de sesión y sostiene continuidad entre sesiones.',
 'SGS-007':'La organización multigrado integra aportaciones diferenciadas e interdependientes, no dos trayectorias paralelas.',
 'SGS-008':'Cada vínculo a un requisito funcional corresponde a una actividad que realmente ejecuta ese requisito y produce su evidencia; no basta la cobertura nominal.',
 'SGS-009':'La complejidad, autonomía, apoyos y formas de participación son adecuadas a cada grado.',
 'SGS-010':'La distribución temporal es pedagógicamente realista a nivel de actividad, no sólo aritméticamente válida.',
 'SGS-011':'El procedimiento permite al docente ejecutar la actividad sin inventar pasos: preparación, consigna, secuencia, organización, preguntas/modelado cuando son necesarios, uso de materiales, intervención, diferenciación, apoyo contingente y transición deben ser concretos, coherentes y viables; rechaza campos genéricos, repetidos o relleno. CORE requiere uso LTG concreto al menos una vez en el grafo donde curricularmente corresponda, sin repetición obligatoria por PDA en cada sesión; SUPPORT puede fortalecer una actividad pertinente sin uso obligatorio por sesión; OPTIONAL pertinente requiere uso o justificación de no uso por sesión. El alumnado toma decisiones, indaga, produce, explica o evalúa según corresponda; el docente no sustituye la acción cognitiva central.',
 'SGS-012':'El cierre final culmina el producto y la evaluación sin duplicar presentaciones ni preparar una sesión inexistente.',
});
