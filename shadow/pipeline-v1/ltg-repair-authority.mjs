// Repair transport ownership only. Domain LTG validation remains unchanged.
export const LOCKED_LTG_REPAIR_INSTRUCTION='Este repair NO tiene targets SGD-013. LTG es de solo lectura: omite ltg_decisions en cada sesion y ltg_use/ltg_activity_ids en cada actividad de proposal. No copies ni regeneres row_id, project_id o decisiones desde previous_proposal. El motor conserva exactamente esos campos previos por session_number y activity_key. No elimines ni renombres actividades que ya tienen uso LTG. Cualquier intento de escribir esos campos sera rechazado, nunca ignorado ni convertido a NOT_RECOMMENDED.';
export function lockedLtgRepair(targets,matrix){
 return matrix.length>0&&!targets.some(t=>t.rule_id==='SGD-013');
}
export function lockedLtgRepairSchema(schema){
 const copy=structuredClone(schema),session=copy.properties.proposal.properties.sessions.items,activity=session.properties.activities.items;
 for(const [node,fields] of [[session,['ltg_decisions']],[activity,['ltg_use','ltg_activity_ids']]]){
  for(const field of fields)delete node.properties[field];
  node.required=node.required.filter(k=>!fields.includes(k));
  node.additionalProperties=false;
 }
 return copy;
}
export function preserveLockedLtgRepair(raw,previous){
 const fail=(session,reason)=>{throw Error(`SESSION_PROVIDER_LTG_AUTHORITY: session=${session} ${reason} NOT_PROVIDER_OWNED`);};
 // Validate all attempted writes before copying any motor-owned values.
 for(const s of raw.sessions||[]){
  if(Object.hasOwn(s,'ltg_decisions'))fail(s.session_number,'LTG_FIELDS_LOCKED');
  for(const a of s.activities||[])if(Object.hasOwn(a,'ltg_use')||Object.hasOwn(a,'ltg_activity_ids'))fail(s.session_number,'LTG_FIELDS_LOCKED');
 }
 for(const s of previous.sessions||[]){
  const next=(raw.sessions||[]).find(n=>n.session_number===s.session_number);
  if(!next)fail(s.session_number,'LOCKED_LTG_SESSION_REMOVED');
  for(const a of s.activities||[])if((a.ltg_use||[]).length&&!(next.activities||[]).some(n=>n.activity_key===a.activity_key))fail(s.session_number,'LOCKED_LTG_ACTIVITY_REMOVED_OR_RENAMED');
 }
 const copy=structuredClone(raw);
 for(const s of copy.sessions||[]){
  const prior=(previous.sessions||[]).find(p=>p.session_number===s.session_number);
  s.ltg_decisions=structuredClone(prior?.ltg_decisions||[]);
  for(const a of s.activities||[]){
   const old=(prior?.activities||[]).find(p=>p.activity_key===a.activity_key);
   a.ltg_use=structuredClone(old?.ltg_use||[]);
   a.ltg_activity_ids=structuredClone(old?.ltg_activity_ids||[]);
  }
 }
 return copy;
}
export function assertLockedLtgPreserved(proposal,previous){
 for(const s of previous.sessions||[]){
  const next=(proposal.sessions||[]).find(n=>n.session_number===s.session_number);
  if(JSON.stringify(next?.ltg_decisions)!==JSON.stringify(s.ltg_decisions||[]))throw Error(`SESSION_PROVIDER_LTG_AUTHORITY: session=${s.session_number} LOCKED_LTG_CHANGED_AFTER_NORMALIZATION NOT_PROVIDER_OWNED`);
  for(const a of s.activities||[]){
   const after=next?.activities?.find(n=>n.activity_key===a.activity_key);
   if(!(a.ltg_use||[]).length&&!after)continue;
   if(JSON.stringify(after?.ltg_use)!==JSON.stringify(a.ltg_use||[])||JSON.stringify(after?.ltg_activity_ids)!==JSON.stringify(a.ltg_activity_ids||[]))throw Error(`SESSION_PROVIDER_LTG_AUTHORITY: session=${s.session_number} LOCKED_LTG_CHANGED_AFTER_NORMALIZATION NOT_PROVIDER_OWNED`);
  }
 }
}
