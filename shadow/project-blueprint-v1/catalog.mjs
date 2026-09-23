export const CATALOG_VERSION = 'METHODOLOGY_CATALOG_V1';
export const CATALOG = Object.freeze(Object.fromEntries(Object.entries({
  abp: ['PRESENTEMOS','RECOLECTEMOS','FORMULEMOS_PROBLEMA','ORGANICEMOS_EXPERIENCIA','VIVAMOS_EXPERIENCIA','RESULTADOS_ANALISIS'],
  steam: ['INTRODUCCION_PROBLEMATIZACION','DISENO_Y_DESARROLLO_INDAGACION','ORGANIZACION_DE_RESPUESTAS','PRESENTACION_Y_APLICACION','METACOGNICION'],
  aprendizaje_servicio: ['PUNTO_DE_PARTIDA','LO_QUE_SE_Y_QUIERO_SABER','ORGANICEMOS_ACTIVIDADES','CREATIVIDAD_EN_MARCHA','COMPARTIMOS_Y_EVALUAMOS'],
  proyectos_comunitarios: ['IDENTIFICACION','RECUPERACION','PLANIFICACION','ACERCAMIENTO','COMPRENSION_Y_PRODUCCION','RECONOCIMIENTO','CONCRECION','INTEGRACION','DIFUSION','CONSIDERACIONES','AVANCES'],
}).map(([id, operations]) => [id, Object.freeze(operations)])));
export const COMMUNITY_GROUPS = Object.freeze({
  PLANEACION:Object.freeze(['IDENTIFICACION','RECUPERACION','PLANIFICACION']),
  ACCION:Object.freeze(['ACERCAMIENTO','COMPRENSION_Y_PRODUCCION','RECONOCIMIENTO','CONCRECION']),
  INTERVENCION:Object.freeze(['INTEGRACION','DIFUSION','CONSIDERACIONES','AVANCES']),
});
export const COGNITIVE_ACTIONS = Object.freeze(['IDENTIFICA','INDAGA','DIALOGA','EXPLICA','ANALIZA','ARGUMENTA','PROPONE','REPRESENTA','COMPARA','DESCRIBE','RECONOCE','REFLEXIONA']);
// Profiles are explicit semantic assertions, not inferred from an exact product name.
export const FUNCTIONAL_PROFILES = Object.freeze(Object.fromEntries(Object.entries({
 MUSEUM:['pieces','selection_criteria','organization','piece_explanation','mounting','audience_or_route','mediation'],
 ITINERANT:['movement','at_least_two_viable_spaces_or_audiences','relocation_or_reinstallation','circulation_evidence'],
 CAMPAIGN:['message','audience','channel','dissemination_action','evidence_of_dissemination'],
 INVESTIGATION:['research_question','sources_or_observations','procedure','analysis','conclusion'],
 PROTOTYPE:['need','design','construction','testing','evaluation','improvement_when_applicable'],
 SERVICE:['real_need','beneficiary','service_action','execution','service_evidence','reflection'],
 INTERVENTION:['context_action','application_or_transformation','observable_effect_or_execution_evidence'],
}).map(([k,v])=>[k,Object.freeze(v)])));
export const BPS = Object.freeze({
 'BPS-001':'Problema, propósito y resultado están vinculados.',
 'BPS-002':'La pregunta sostiene el proyecto y es accesible a todos los grados.',
 'BPS-003':'El resultado cumple su semántica funcional, incluso atributos implícitos; no basta declarar requisitos.',
 'BPS-004':'El PDA completo se desarrolla mediante su aportación, sin reducirlo a coincidencia temática.',
 'BPS-005':'La evidencia corresponde al desempeño cognitivo del PDA completo.',
 'BPS-006':'Existe un proyecto común construido con aportaciones interdependientes, no proyectos paralelos.',
 'BPS-007':'La progresión produce el resultado y cada avance tiene operación, artefacto y evidencia.',
 'BPS-008':'Las operaciones realizan auténticamente la metodología; reflexión no sustituye servicio, intervención o indagación.',
 'BPS-009':'Complejidad, autonomía y apoyos adecuados a los grados y perfiles.',
 'BPS-010':'Factibilidad temporal por complejidad y etapas, no sólo multiplicación de minutos.',
 'BPS-011':'Los grados transversales no heredan contenidos ni exigencias de PDA ajenos.',
 'BPS-012':'LTG pertinente, autorizado y al servicio del mismo proyecto; sin LTG puede ser PASS justificado.',
});
