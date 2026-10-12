import {buildCriticalClaimsInput,criticalClaimsGate} from './critical-audit.mjs';

export const WORKED_COMPLETE_ACTION_POLICY='Antes de producir una student_action WORKED revisa el texto oficial COMPLETO y materializa TODOS sus componentes sustantivos en la MISMA accion propietaria. Explora y describe no basta si exige representar, explicar riesgos, prevencion, cuidado, comparar, argumentar o proponer. Describe conductas naturales, observables y ejecutables en aula multigrado; no copies mecanicamente el PDA ni inventes acciones artificiales para satisfacer palabras clave.';
export const WORKED_CRITICAL_REPAIR_INSTRUCTION='Para este target WORKED modifica solo student_action de la fila session/activity_key/grade/pda_id propietaria. Conserva WORKED, la identidad del claim y los componentes ya satisfechos, incluidos sus fragmentos literales verificados. Incorpora TODOS los missing_components mediante conductas autenticas, naturales y observables. No uses evidence, teacher_role, common_student_action, otro grado u otra actividad para completar el claim. No copies todo el PDA oficial ni agregues acciones irreales. Cada componente faltante necesita una conducta en esta student_action que el auditor pueda citar literalmente. La validacion local NO certifica PASS semantico: el critical gate vuelve a evaluar.';

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
 return {target_id,source:'SESSION_CRITICAL_GATE',rule_id:'WORKED',claim_type:'WORKED',claim_key:item.key,session:claim.session_number,activity_key:prior.activity_key,grade:claim.grade,pda_id:claim.pda_id,official_pda:claim.official_pda,student_action:claim.student_action,missing_components:row.component_checks.filter(c=>c.satisfied===false).map(c=>c.component),satisfied_components:row.component_checks.filter(c=>c.satisfied).map(c=>c.component),preserved_quotes:row.component_checks.filter(c=>c.satisfied).map(c=>c.exact_quote),requirement:'complete_owned_worked_student_action',required:WORKED_CRITICAL_REPAIR_INSTRUCTION};
}

export function validateWorkedCriticalTarget(proposal,source,t){
 const sessions=proposal.sessions?.filter(s=>s.session_number===t.session)||[];
 const activities=sessions.length===1?sessions[0].activities?.filter(a=>a.activity_key===t.activity_key)||[]:[];
 const a=activities.length===1?activities[0]:null;
 const grades=a?.grade_participation?.filter(g=>g.grade===t.grade)||[];
 let reason=null;
 if(grades.length!==1)reason='CLAIM_IDENTITY_MISSING';
 else if(!grades[0].pda_mobilization?.some(m=>m.pda_id===t.pda_id&&m.status==='WORKED'))reason='WORKED_PDA_IDENTITY_MISSING';
 else {
  const graph={sessions:[{session_number:t.session,activities:[{...a,activity_id:t.activity_key,methodology_operations:[],functional_requirement_ids:[]}]}]};
  const claim=buildCriticalClaimsInput({blueprint:source.blueprint,curriculum:source.curriculum,graph}).worked.find(c=>c.grade===t.grade&&c.pda_id===t.pda_id);
  if(typeof claim?.student_action!=='string'||!claim.student_action.trim())reason='OWNED_STUDENT_ACTION_EMPTY';
  else if(claim.official_pda!==t.official_pda)reason='OFFICIAL_PDA_CHANGED';
  else if(claim.student_action===t.student_action)reason='OWNED_STUDENT_ACTION_UNCHANGED';
  else if(t.preserved_quotes.some(q=>!claim.student_action.includes(q)))reason='SATISFIED_COMPONENT_WITNESS_REMOVED';
 }
 return {target_id:t.target_id,session:t.session,activity_key:t.activity_key,grade:t.grade,pda_id:t.pda_id,missing_components_count:t.missing_components.length,missing_components:[...t.missing_components],repair_applied_to_expected_claim:reason===null,...(reason?{reason}:{})};
}
