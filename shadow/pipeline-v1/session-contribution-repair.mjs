import {deepFreeze} from '../project-blueprint-v1/contracts.mjs';
import {complementaryConsumerMissing,validateSessionGraphAuthoring,directArtifactErrors} from '../session-graph-v1/authoring.mjs';

export const DIRECT_REPAIR_INSTRUCTION='DIRECT significa que el output constituye una contribucion observable a un artefacto esperado de ESA MISMA sesion. Si permanece DIRECT, contributes_to_artifact_ids debe contener al menos un authorized_artifact_id de esa sesion ya existente. No inventes artifacts ni IDs, no uses IDs de otras sesiones, no elimines vinculos validos existentes ni actividades. No cambies contribution_mode solo para pasar. Conserva las otras actividades DIRECT validas. Audita TODAS las actividades DIRECT finales despues de normalizacion: todas deben conservar al menos una referencia autorizada. No completes nada automaticamente.';

export function directRepairDiagnostics(raw,normalized,blueprint){
 const known=new Set((blueprint.project_stages||[]).map(s=>s.output_artifact_id));
 return (normalized.sessions||[]).flatMap(s=>(s.activities||[]).filter(a=>a.contribution_mode==='DIRECT').map(a=>{
  const before=raw.sessions?.find(row=>row.session_number===s.session_number)?.activities?.find(row=>row.activity_key===a.activity_key)?.contributes_to_artifact_ids||[];
  const after=a.contributes_to_artifact_ids||[];
  const authorized=blueprint.session_progression.find(row=>row.session_number===s.session_number)?.expected_output_artifact_ids||[];
  return {session:s.session_number,activity_key:a.activity_key,mode:a.contribution_mode,artifact_ids_before_normalization:[...before],artifact_ids_after_normalization:[...after],authorized_artifact_ids:[...authorized],status:!before.length?'NOT_PROVIDED':!after.length?'ALL_FILTERED':'RETAINED',filtered_reasons:[...new Set(before.filter(id=>!authorized.includes(id)).map(id=>known.has(id)?'ARTIFACT_NOT_AUTHORIZED_FOR_SESSION':'ARTIFACT_NOT_FOUND'))]};
 }));
}

export function validateDirectRepair(proposal,source){
 const errors=(proposal.sessions||[]).flatMap(s=>{
  const authorized=source.blueprint.session_progression.find(row=>row.session_number===s.session_number)?.expected_output_artifact_ids||[];
  return (s.activities||[]).filter(a=>a.contribution_mode==='DIRECT').flatMap(a=>directArtifactErrors(a,authorized).map(reason=>`$.sessions[${s.session_number}].${a.activity_key}: ${reason}`));
 });
 if(errors.length){const e=Error(`SESSION_GRAPH_REPAIR_TARGET: ${errors.join('; ')}`);e.code='SESSION_GRAPH_AUTHORING_INVALID';throw e;}
 return true;
}

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
