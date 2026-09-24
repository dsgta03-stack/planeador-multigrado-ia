import {SGS,SESSION_GRAPH_GATE_VERSION} from './catalog.mjs';
import {sessionSemanticInputHash} from './gate.mjs';

export const SESSION_GRAPH_REVIEW_VERSION='SESSION_GRAPH_SEMANTIC_REVIEW_V1';
export const SESSION_GRAPH_REVIEW_INSTRUCTION=`Evalúa un SessionGraph ya compilado contra un ProjectBlueprint aprobado. No repares ni reescribas. Juzga el texto completo de acciones, evidencias, criterios, diferenciación, dependencias, tiempos y requisitos funcionales. Una etiqueta metodológica o un pda_id no demuestra ejecución. Una actividad complementaria sólo es válida si prepara de forma necesaria una acción posterior. Una actividad directa debe construir avance observable del artefacto o producto. Penaliza trayectorias paralelas por grado, evidencia decorativa, teacher talk que sustituye la acción cognitiva, presentaciones duplicadas y cualquier cierre que prepare una sesión inexistente.`;

export function buildSessionGraphReviewRequest(input){
 return {review_version:SESSION_GRAPH_REVIEW_VERSION,gate_version:SESSION_GRAPH_GATE_VERSION,input_hash:sessionSemanticInputHash(input),rules:SGS,context:{constraints:input.constraints,curriculum:input.curriculum,methodology:input.methodology,blueprint:input.blueprint,session_graph:input.graph},output_contract:{input_hash:'repeat exact input_hash',findings:'exactly one finding per SGS rule with rule_id,status PASS|FAIL,scope,observed,expected'}};
}
