import {deepFreeze} from '../project-blueprint-v1/contracts.mjs';
import {complementaryConsumerMissing,validateSessionGraphAuthoring} from '../session-graph-v1/authoring.mjs';

// This is a structural witness, never a pedagogical transformation. In
// particular, a permitted artifact ID is not proof of an authentic DIRECT.
export function contributionRepairPreflight({previous_proposal,blueprint}){
 const progression=blueprint.session_progression||[];
 const sessions=(previous_proposal?.sessions||[]).map(session=>{
  const approved=progression.find(row=>row.session_number===session.session_number);
  const activities=Array.isArray(session.activities)?session.activities:[];
  return {
   session_number:session.session_number,
   allowed_input_artifact_ids:[...(approved?.input_artifact_ids||[])],
   allowed_output_artifact_ids:[...(approved?.expected_output_artifact_ids||[])],
   expected_partial_product:approved?.expected_partial_product??null,
   authorized_artifacts:(blueprint.project_stages||[]).filter(stage=>approved?.expected_output_artifact_ids?.includes(stage.output_artifact_id)),
   activities:activities.map((activity,index)=>({
    activity_key:activity.activity_key,
    position:index+1,
    last_in_session:index===activities.length-1,
    contribution_mode:activity.contribution_mode,
    output:activity.output,
    evidence:activity.evidence,
    contributes_to_artifact_ids:[...(activity.contributes_to_artifact_ids||[])],
    later_same_session_consumers:activities.slice(index+1)
     .filter(next=>next.input_refs?.includes(activity.activity_key))
     .map(next=>next.activity_key),
    orphan_complementary:complementaryConsumerMissing(activities,index)
   }))
  };
 });
 return deepFreeze(structuredClone({
  version:'SESSION_CONTRIBUTION_REPAIR_PREFLIGHT_V1',
  rule:'Esta tabla describe previous_proposal, no certifica el resultado. Resuelve cada orphan_complementary y después recalcula la tabla sobre proposal FINAL. Para cada COMPLEMENTARY comprueba un consumidor con posición mayor dentro de ESA MISMA sesión cuyo input_refs contenga exactamente activity_key. Un consumidor previo, en otra sesión o sólo mencionado en reason no cuenta. La última actividad de cada sesión no puede ser COMPLEMENTARY. No añadas un input_ref cosmético: el consumidor debe usar realmente el output de la actividad precedente. No conviertas automáticamente a DIRECT ni fabriques acciones, productos o artifact_id. DIRECT exige que la acción y el output produzcan auténticamente un componente observable de un allowed_output_artifact_id; el ID autorizado por sí solo no demuestra esto. Si necesitas reordenar actividades, vuelve a auditar SGD-009. Conserva las decisiones aprobadas, PDA y presupuestos. Primero escribe el JSON proposal corregido; sólo después declara status y reason. La explicación de una corrección nunca sustituye su presencia en el JSON. Los Gates y la revisión SGS-005 siguen siendo obligatorios.',
  sessions
 }));
}

export function validateContributionRepair(proposal,source){
 // Authoritative certified preflight, including SGD-010. Do not normalize,
 // relabel DIRECT, reorder, invent edges, or infer artifact links here.
 validateSessionGraphAuthoring(proposal,source);
 return proposal;
}
