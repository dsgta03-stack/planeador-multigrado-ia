export const SESSION_GRAPH_ADVERSARIAL_VERSION='SESSION_GRAPH_ADVERSARIAL_V1';

/**
 * Creates a deliberately semantic-only defect while preserving the structural
 * shape expected by the deterministic compiler. The adversary keeps artifact,
 * methodology and functional-requirement links but replaces actual itinerant
 * execution with discussion/planning language. A correct deterministic pass
 * followed by semantic rejection demonstrates that SGS-005/SGS-008 are doing
 * work that cannot be reduced to ID/link validation.
 */
export function makeItinerancySemanticAdversarial(proposal){
 const x=structuredClone(proposal);
 const target=x.sessions
  ?.flatMap(s=>s.activities.map(a=>({session:s,activity:a})))
  .find(({activity})=>activity.functional_requirement_ids?.includes('movement')&&activity.functional_requirement_ids?.includes('relocation_or_reinstallation'));
 if(!target)throw Error('ADVERSARIAL_TARGET_NOT_FOUND');
 const a=target.activity;
 a.title='Conversamos sobre un posible traslado del museo';
 a.contribution_rationale='Se conserva deliberadamente la declaración estructural de contribución para probar que el revisor semántico detecte que no existe ejecución real.';
 a.common_student_action='El alumnado conversa sobre cómo podría trasladarse el museo al patio techado, pero no desmonta, no traslada y no reinstala las piezas.';
 for(const g of a.grade_participation||[]){
  g.student_action=g.grade===1
   ? 'Describe cómo imagina que podrían llevarse sus dibujos al patio, sin realizar el traslado ni una segunda explicación.'
   : 'Escribe una lista de pasos hipotéticos para trasladar y reinstalar el museo, sin ejecutar el movimiento ni la reinstalación.';
  g.pda_mobilization=[];
  g.evidence='Lista o comentario hipotético sobre un traslado que no se ejecuta.';
 }
 a.output='Lista de ideas sobre un posible traslado no ejecutado.';
 a.evidence='Registro escrito de una conversación hipotética; no existe evidencia de movimiento, reinstalación ni circulación real.';
 a.assessment_criteria=['El grupo describe verbalmente cómo podría hacerse un traslado, sin ejecutarlo.'];
 return x;
}
