import {buildCriticalClaimsInput,criticalClaimsGate} from './critical-audit.mjs';

export const WORKED_COMPLETE_ACTION_POLICY='Antes de producir una student_action WORKED revisa el texto oficial COMPLETO y materializa TODOS sus componentes sustantivos en la MISMA accion propietaria. Explora y describe no basta si exige representar, explicar riesgos, prevencion, cuidado, comparar, argumentar o proponer. Describe conductas naturales, observables y ejecutables en aula multigrado; no copies mecanicamente el PDA ni inventes acciones artificiales para satisfacer palabras clave.';
export const WORKED_CRITICAL_REPAIR_INSTRUCTION='Para este target WORKED modifica solo student_action de la fila session/activity_key/grade/pda_id propietaria. Conserva WORKED, la identidad del claim y los componentes ya satisfechos, incluidos sus fragmentos literales verificados. Incorpora TODOS los missing_components mediante conductas autenticas, naturales y observables. No uses evidence, teacher_role, common_student_action, otro grado u otra actividad para completar el claim. No copies todo el PDA oficial ni agregues acciones irreales. Cada componente faltante necesita una conducta en esta student_action que el auditor pueda citar literalmente. La validacion local NO certifica PASS semantico: el critical gate vuelve a evaluar.';
export const WORKED_ADDITIVE_REPAIR_INSTRUCTION='Trata original_student_action como base autorizada. Por defecto realiza una edicion ADITIVA y minimalista: conserva su significado y secuencia util y agrega solo conductas observables necesarias, integradas naturalmente; evita sustituir la frase completa. CADA exact_quote de satisfied_component_witnesses debe continuar apareciendo caracter por caracter en la student_action reparada: no cambies su puntuacion interna, no parafrasees, resumas ni elimines el witness. Conserva TODOS los missing_components y atiende tambien observed_summary y expected_summary de SGS-002 en related_findings: son restricciones adicionales, no componentes nuevos del PDA. Resolver solo el missing_component critico no permite ignorar SGS-002. Ambas autoridades volveran a evaluar; no copies mecanicamente el PDA ni inventes acciones.';

export function workedCriticalTarget(item,ctx,target_id){
 if(item.claim_type!=='WORKED'||item.status!=='FAIL')return null;
 const input={blueprint:ctx.blueprint,graph:ctx.graph,curriculum:ctx.sources?.curriculum};
 if(!input.graph||!input.curriculum||!ctx.critical_audit)throw Error('WORKED_CRITICAL_REPAIR_CONTEXT_REQUIRED');
 const verified=criticalClaimsGate(input,ctx.critical_audit).findings.find(f=>f.claim_type==='WORKED'&&f.key===item.key&&f.status==='FAIL');
 if(!verified)throw Error('WORKED_CRITICAL_REPAIR_AUDIT_INVALID');
 const claim=buildCriticalClaimsInput(input).worked.find(c=>`${c.activity_id}|${c.grade}|${c.pda_id}`===item.key);
 const session=ctx.graph.sessions.find(s=>s.session_number===claim.session_number);
 const compiled=session.activities.find(a=>a.activity_id===claim.activity_id);
 const prior=ctx.previous_proposal?.sessions?.find(s=>s.session_number===claim.session_number)?.activities?.[compiled.order-1];
 if(!prior?.grade_participation?.some(g=>g.grade===claim.grade&&g.student_action===claim.student_action&&g.pda_mobilization?.some(m=>m.pda_id===claim.pda_id&&m.status==='WORKED')))throw Error('WORKED_CRITICAL_REPAIR_IDENTITY_INVALID');
 const row=ctx.critical_audit.worked_audits.find(r=>`${r.activity_id}|${r.grade}|${r.pda_id}`===item.key);
 return {target_id,source:'SESSION_CRITICAL_GATE',rule_id:'WORKED',claim_type:'WORKED',claim_key:item.key,session:claim.session_number,activity_key:prior.activity_key,grade:claim.grade,pda_id:claim.pda_id,official_pda:claim.official_pda,student_action:claim.student_action,original_student_action:claim.student_action,missing_components:row.component_checks.filter(c=>c.satisfied===false).map(c=>c.component),satisfied_components:row.component_checks.filter(c=>c.satisfied).map(c=>c.component),satisfied_component_witnesses:row.component_checks.filter(c=>c.satisfied).map(c=>({component:c.component,exact_quote:c.exact_quote})),preserved_quotes:row.component_checks.filter(c=>c.satisfied).map(c=>c.exact_quote),related_findings:[{target_id,source:'SESSION_CRITICAL_GATE',rule_id:'WORKED',claim_key:item.key,observed_summary:item.observed||'',expected_summary:item.expected||''}],requirement:'complete_owned_worked_student_action',required:WORKED_CRITICAL_REPAIR_INSTRUCTION+' '+WORKED_ADDITIVE_REPAIR_INSTRUCTION};
}

// Only complete explicit locators are accepted; never inspect observed prose or
// infer identity from a similar title, action or PDA description.
function relatedIdentity(item,ctx){
 let session=item.session??item.session_number,activity_key=item.activity_key,activity_id=item.activity_id,order=item.activity,grade=item.grade,pda_id=item.pda_id;
 if(typeof item.scope==='string'){
  const m=item.scope.match(/^session=(\d+) (activity_key|activity_id)=(\S+) grade=(\d+) pda_id=(\S+)$/);
  if(m){
   if(session!==undefined&&session!==Number(m[1])||grade!==undefined&&grade!==Number(m[4])||pda_id!==undefined&&pda_id!==m[5])return null;
   if(m[2]==='activity_key'){if(activity_key!==undefined&&activity_key!==m[3])return null;activity_key=m[3];}
   else {if(activity_id!==undefined&&activity_id!==m[3])return null;activity_id=m[3];}
   session=Number(m[1]);grade=Number(m[4]);pda_id=m[5];
  }
 }
 if(!Number.isInteger(session)||!Number.isInteger(grade)||typeof pda_id!=='string')return null;
 const graphSession=ctx.graph?.sessions?.find(s=>s.session_number===session),priorSession=ctx.previous_proposal?.sessions?.find(s=>s.session_number===session);
 if(activity_id||Number.isInteger(order)){
  const matches=graphSession?.activities?.filter(a=>(!activity_id||a.activity_id===activity_id)&&(!Number.isInteger(order)||a.order===order))||[];
  if(matches.length!==1)return null;
  const resolved=priorSession?.activities?.[matches[0].order-1]?.activity_key;
  if(activity_key&&activity_key!==resolved)return null;
  activity_key=resolved;
 }
 const matches=priorSession?.activities?.filter(a=>a.activity_key===activity_key)||[];
 if(matches.length!==1||!matches[0].grade_participation?.some(g=>g.grade===grade&&g.pda_mobilization?.some(m=>m.pda_id===pda_id&&m.status==='WORKED')))return null;
 return {session,activity_key,grade,pda_id};
}

export function groupWorkedRepairTargets(targets,entries,ctx){
 const removed=new Set();
 for(let i=0;i<targets.length;i++){
  const target=targets[i],item=entries[i]?.item;
  if(target.rule_id!=='SGS-002'||item?.status!=='FAIL')continue;
  const identity=relatedIdentity(item,ctx);if(!identity)continue;
  const matches=targets.filter(t=>t.source==='SESSION_CRITICAL_GATE'&&t.rule_id==='WORKED'&&Object.entries(identity).every(([k,v])=>t[k]===v));
  if(matches.length!==1)continue;
  matches[0].related_findings.push({target_id:target.target_id,source:'SESSION_GATE',rule_id:'SGS-002',scope:item.scope??null,...identity,observed_summary:item.observed||'',expected_summary:item.expected||''});removed.add(target.target_id);
 }
 return targets.filter(t=>!removed.has(t.target_id));
}

export function validateWorkedCriticalTarget(proposal,source,t){
 const sessions=proposal.sessions?.filter(s=>s.session_number===t.session)||[];
 const activities=sessions.length===1?sessions[0].activities?.filter(a=>a.activity_key===t.activity_key)||[]:[];
 const a=activities.length===1?activities[0]:null;
 const grades=a?.grade_participation?.filter(g=>g.grade===t.grade)||[];
 let reason=null,lost_component;
 if(grades.length!==1)reason='CLAIM_IDENTITY_MISSING';
 else if(!grades[0].pda_mobilization?.some(m=>m.pda_id===t.pda_id&&m.status==='WORKED'))reason='WORKED_PDA_IDENTITY_MISSING';
 else {
  const graph={sessions:[{session_number:t.session,activities:[{...a,activity_id:t.activity_key,methodology_operations:[],functional_requirement_ids:[]}]}]};
  const claim=buildCriticalClaimsInput({blueprint:source.blueprint,curriculum:source.curriculum,graph}).worked.find(c=>c.grade===t.grade&&c.pda_id===t.pda_id);
  if(typeof claim?.student_action!=='string'||!claim.student_action.trim())reason='OWNED_STUDENT_ACTION_EMPTY';
  else if(claim.official_pda!==t.official_pda)reason='OFFICIAL_PDA_CHANGED';
  else if(claim.student_action===t.student_action)reason='OWNED_STUDENT_ACTION_UNCHANGED';
  else if(t.preserved_quotes.some(q=>!claim.student_action.includes(q))){
   reason='SATISFIED_COMPONENT_WITNESS_REMOVED';
   lost_component=t.satisfied_component_witnesses?.find(w=>!claim.student_action.includes(w.exact_quote))?.component;
  }
 }
 return {target_id:t.target_id,session:t.session,activity_key:t.activity_key,grade:t.grade,pda_id:t.pda_id,missing_components_count:t.missing_components.length,missing_components:[...t.missing_components],repair_applied_to_expected_claim:reason===null,...(reason?{reason}:{}),...(lost_component!==undefined?{lost_component}:{})};
}
