import {randomUUID} from 'node:crypto';
import {hash} from '../project-blueprint-v1/contracts.mjs';

// Diagnostics only. Never return authored content, prompts, errors or credentials.
const list=x=>Array.isArray(x)?x:[];
const grade=x=>Number.isInteger(x)&&x>=1&&x<=6?x:null;
const id=x=>typeof x==='string'&&/^(?:act_s\d+_\d+|s\d+_a\d+|[abp]\d+|session_\d+(?:_activity_\d+)?|F[1-6]-[A-Z]{2,8}-[1-6]-\d{3})$/.test(x)?x:typeof x==='string'?`id#${hash(x).slice(0,16)}`:null;
const mode=x=>['WORKED','DEVELOPING','TRANSVERSAL'].includes(x)?x:'UNKNOWN';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function repairTraceState(proposal,source){
 const sessions=list(proposal?.sessions);
 const participation=g=>({grade:grade(g.grade),participation_mode:list(g.pda_mobilization).length?'PDA_MOBILIZED':'NO_PDA_MOBILIZATION',pda_ids:list(g.pda_mobilization).slice(0,16).map(m=>({pda_id:id(m.pda_id),status:mode(m.status)})),omitted_pdas:Math.max(0,list(g.pda_mobilization).length-16)});
 const watched=sessions.filter(s=>s.session_number===1).flatMap(s=>list(s.activities).flatMap(a=>list(a.grade_participation).filter(g=>g.grade===2).map(g=>({activity_id:id(a.activity_key??a.activity_id),...participation(g)}))));
 const focused=list(source?.blueprint?.session_progression).find(s=>s.session_number===1)?.pda_focus||[];
 const owned=list(source?.curriculum?.pdas).filter(p=>p.grade===2&&focused.includes(p.pda_id)).map(p=>p.pda_id);
 const mobilized=sessions.filter(s=>s.session_number===1).flatMap(s=>list(s.activities).flatMap(a=>list(a.grade_participation).filter(g=>g.grade===2).flatMap(g=>list(g.pda_mobilization).map(m=>m.pda_id))));
 return {session_1_grade_2:{present:watched.length>0,focused_owned_pda_ids:owned.map(id).slice(0,16),missing_focused_pda_ids:owned.filter(p=>!mobilized.includes(p)).map(id).slice(0,16),activities:watched.slice(0,16),omitted_activities:Math.max(0,watched.length-16),semantic_validity:'NOT_EVALUATED'},sessions:sessions.slice(0,12).map(s=>({session_number:Number.isInteger(s.session_number)?s.session_number:null,session_id:id(s.session_id),activities:list(s.activities).slice(0,12).map(a=>({activity_id:id(a.activity_key??a.activity_id),active_grades:list(a.grade_participation).map(g=>grade(g.grade)).slice(0,6),participation:list(a.grade_participation).slice(0,6).map(participation)})),omitted_activities:Math.max(0,list(s.activities).length-12)})),omitted_sessions:Math.max(0,sessions.length-12)};
}
const fields=['title','contribution_mode','contribution_rationale','common_student_action','grade_participation','execution','teacher_role','resources','supports','minutes','input_refs','output','contributes_to_artifact_ids','methodology_operations','functional_requirement_ids','ltg_activity_ids','ltg_use','evidence','assessment_criteria'];
export function repairTraceChanges(previous,next){
 const changes=[];
 for(const s of list(next?.sessions)){
  const prior=list(previous?.sessions).find(p=>p.session_number===s.session_number);
  for(const a of list(s.activities)){
   const old=list(prior?.activities).find(p=>p.activity_key===a.activity_key);
   const changed=old?fields.filter(k=>!equal(old[k],a[k])):['ACTIVITY_ADDED_OR_RENAMED'];
   if(changed.length)changes.push({session:Number.isInteger(s.session_number)?s.session_number:null,activity:id(a.activity_key),fields:changed});
  }
  for(const a of list(prior?.activities))if(!list(s.activities).some(n=>n.activity_key===a.activity_key))changes.push({session:Number.isInteger(s.session_number)?s.session_number:null,activity:id(a.activity_key),fields:['ACTIVITY_REMOVED_OR_RENAMED']});
 }
 for(const s of list(previous?.sessions))if(!list(next?.sessions).some(n=>n.session_number===s.session_number))changes.push({session:Number.isInteger(s.session_number)?s.session_number:null,fields:['SESSION_REMOVED']});
 return {activities:changes.slice(0,40),omitted_changes:Math.max(0,changes.length-40)};
}
export function repairTraceTargets(targets){
 return list(targets).slice(0,24).map(t=>({rule:typeof t.rule_id==='string'&&/^(?:SGD-\d{3}|WORKED(?:_COGNITIVE_REQUIREMENTS)?)$/.test(t.rule_id)?t.rule_id:'OTHER',session:Number.isInteger(t.session)?t.session:null,activity:id(t.activity_key),grade:grade(t.grade),field:['execution.grouping','execution.resource_use','contributes_to_artifact_ids'].includes(t.field)?t.field:null,missing_requirement_ids:list(t.missing_requirements??t.missing_components).slice(0,16).map(x=>['INDAGA_SOURCE_OR_OBSERVATION','INDAGA_PROCESS_OR_CONTRAST','INDAGA_TRACEABLE_RECORD','INDAGA_OFFICIAL_SCOPE','SHARE_OR_COMMUNICATE_PURPOSE','EXPLICA_LOCAL_ACTION','PROPONE_LOCAL_ACTION'].includes(x)?x:'OTHER')}));
}
export function startRepairTrace(){return {trace_id:randomUUID(),attempt:2};}
export function emitRepairTrace(trace,phase,{proposal,source,previous,targets,error,compiled,notReached=false}={}){
 // Logging must never change provider/validator results, including malformed proposals.
 if(!trace)return;
 try{
  const row={trace_id:trace?.trace_id,attempt:trace?.attempt??2,phase};
  if(proposal)row[phase]=repairTraceState(proposal,source);
  if(previous&&proposal)row.changed_fields=repairTraceChanges(previous,proposal);
  if(targets)row.repair_target=repairTraceTargets(targets);
  if(compiled)row.compiled_graph=repairTraceState(compiled,source);
  if(phase==='global_validation'){
   const session=String(error?.message||'').match(/session (\d+)/),g=String(error?.message||'').match(/grade (\d+)/);
   row.global_validation={status:notReached?'NOT_REACHED':error?'FAIL':'PASS',first_failing_rule:notReached?null:/^SGD-\d{3}$/.test(error?.rule)?error.rule:error?'OTHER':null,session:notReached?null:session?Number(session[1]):null,grade:notReached?null:g?Number(g[1]):null};
  }
  // Keep valid JSON below log-line limits, retaining the watched state and explicit omissions.
  for(const value of Object.values(row))if(value?.sessions)while(JSON.stringify(row).length>16000&&value.sessions.length){value.sessions.pop();value.omitted_sessions++;}
  if(JSON.stringify(row).length>18000){console.error('[SESSION_REPAIR_TRACE]',JSON.stringify({trace_id:row.trace_id,attempt:row.attempt,phase,truncated:true}));return;}
  console.error('[SESSION_REPAIR_TRACE]',JSON.stringify(row));
 }catch{/* A diagnostic failure must not become a repair failure. */}
}
