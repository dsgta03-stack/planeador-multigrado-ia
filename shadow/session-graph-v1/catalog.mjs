export const SESSION_GRAPH_VERSION='SESSION_GRAPH_V1';
export const SESSION_GRAPH_PROPOSAL_VERSION='SESSION_GRAPH_AUTHORING_V1';
export const SESSION_GRAPH_GATE_VERSION='SESSION_GRAPH_GATE_V1';
export const BLUEPRINT_APPROVAL_VERSION='PROJECT_BLUEPRINT_APPROVAL_V1';

export const CONTRIBUTION_MODES=Object.freeze(['DIRECT','COMPLEMENTARY']);
export const PDA_MOBILIZATION_STATUSES=Object.freeze(['WORKED','DEVELOPING']);

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
 'SGD-016':'La trazabilidad derivada coincide con las actividades compiladas y no puede ser escrita por el modelo.',
});

export const SGS=Object.freeze({
 'SGS-001':'Las actividades hacen avanzar el estado de cada sesión desde project_state_before hasta project_state_after.',
 'SGS-002':'Las acciones por grado desarrollan realmente el desempeño cognitivo del PDA completo, no sólo lo nombran.',
 'SGS-003':'La evidencia y los criterios permiten observar el aprendizaje declarado y el avance del proyecto.',
 'SGS-004':'Las operaciones metodológicas se realizan auténticamente mediante acciones del alumnado.',
 'SGS-005':'No hay actividades de relleno: cada una construye directamente el artefacto o prepara de forma necesaria una actividad posterior.',
 'SGS-006':'La secuencia de outputs e inputs produce los artefactos de sesión y sostiene continuidad entre sesiones.',
 'SGS-007':'La organización multigrado integra aportaciones diferenciadas e interdependientes, no dos trayectorias paralelas.',
 'SGS-008':'Las actividades realizan de manera concreta los requisitos funcionales del resultado final aprobado.',
 'SGS-009':'La complejidad, autonomía, apoyos y formas de participación son adecuadas a cada grado.',
 'SGS-010':'La distribución temporal es pedagógicamente realista a nivel de actividad, no sólo aritméticamente válida.',
 'SGS-011':'El alumnado toma decisiones, indaga, produce, explica o evalúa según corresponda; el docente no sustituye la acción cognitiva central.',
 'SGS-012':'El cierre final culmina el producto y la evaluación sin duplicar presentaciones ni preparar una sesión inexistente.',
});
