import {normalizeSessionGraphAuthoring,ltgExecutionErrors,ltgUseSchema} from '../session-graph-v1/authoring.mjs';
import {schemaErrors} from '../project-blueprint-v1/contracts.mjs';
import {ltgSessionEligibility,LTG_SESSION_ELIGIBILITY_INSTRUCTION} from './ltg-session-eligibility.mjs';

const sourceOf=ctx=>({...ctx.sources,blueprint:ctx.blueprint});
const usesIn=(proposal,session,project)=> (proposal?.sessions?.find(s=>s.session_number===session)?.activities||[]).flatMap(a=>(a.ltg_use||[]).filter(u=>u.project_id===project).map(use=>({activity:a,use})));
export function structuredLtgTarget(target,ctx){
 if(target.rule_id!=='SGD-013')return target;
 const m=target.observed?.match(/session=(\d+) project_id=(\S+) decision=(USE|NOT_RECOMMENDED) concrete_use=(absent|present)/);
 if(!m)return target; // A generic contract error has no authoritative session/project locator.
 const session=Number(m[1]),project_id=m[2],decision=m[3],source=sourceOf(ctx);
 const sel=ctx.blueprint?.ltg_strategy?.selections?.find(s=>s.project_id===project_id);
 const project=ctx.sources?.curriculum?.ltg?.find(p=>p.project_id===project_id);
 const eligibility=(ctx.ltg_session_eligibility||(ctx.blueprint&&ctx.sources?ltgSessionEligibility(source):[])).find(row=>row.project_id===project_id&&row.session===session);
 const selected_activity_ids=eligibility?.selected_activity_ids||[],verified_activity_ids=eligibility?.verified_activity_ids||[],compatible_pda_ids=eligibility?.compatible_pda_ids||[];
 const prior=ctx.previous_proposal??ctx.previous_authoring_proposal;
 const before=usesIn(prior,session,project_id);
 const normalized=prior&&ctx.blueprint&&ctx.sources?normalizeSessionGraphAuthoring(prior,source):null;
 const after=usesIn(normalized,session,project_id);
 const invalid=before.length>0&&(!after.length||ltgExecutionErrors([{session_number:session,activities:before.map(x=>x.activity),ltg_decisions:[]}],source).some(e=>/unverified|generic LTG use|without verified|selected LTG activity|required|minLength|additionalProperties|maxLength/.test(e)));
 const mismatch_kind=decision==='NOT_RECOMMENDED'?'CONCRETE_USE_WITH_NOT_RECOMMENDED':invalid?'USE_WITH_INVALID_CONCRETE_USE':'USE_WITHOUT_CONCRETE_USE';
 return {...target,session,project_id,decision,concrete_use:invalid?'invalid':m[4],role:sel?.role??null,selected_activity_ids,verified_activity_ids,compatible_grade:project?.grade??null,compatible_pda_ids,mismatch_kind,
  authorized_use_possible:eligibility?.eligible===true,eligibility_reasons:eligibility?.reasons||['PROJECT_NOT_SELECTED'],authorized_activity_ids:eligibility?.authorized_activity_ids||[],null_activity_allowed:eligibility?.null_activity_allowed===true,
  requirement:LTG_SESSION_ELIGIBILITY_INSTRUCTION};
}

// Metadata only. Acceptance remains exclusively with existing normalizer/validators.
export function ltgRepairDiagnostics(raw,normalized,source,targets){
 return targets.filter(t=>t.rule_id==='SGD-013'&&Number.isInteger(t.session)&&t.project_id).map(t=>{
  const before=usesIn(raw,t.session,t.project_id),after=usesIn(normalized,t.session,t.project_id),reasons=[];
  for(const {activity,use} of before){
   const sel=source.blueprint.ltg_strategy.selections.find(s=>s.project_id===use.project_id),p=source.curriculum.ltg?.find(p=>p.project_id===use.project_id);
   const focus=source.blueprint.session_progression.find(s=>s.session_number===t.session)?.pda_focus||[];
   if(!sel)reasons.push('PROJECT_NOT_SELECTED');
   else if(!p)reasons.push('PROJECT_NOT_IN_CURRICULUM');
   else if(!activity.grade_participation?.some(g=>g.grade===p.grade))reasons.push('GRADE_NOT_PARTICIPATING');
   else if(!sel.pda_ids.some(id=>focus.includes(id)&&p.verified_pda_links.includes(id)))reasons.push('PDA_LINK_NOT_VERIFIED');
   else if(use.activity_id===null&&sel.activity_ids.length)reasons.push('NULL_ACTIVITY_NOT_ALLOWED');
   else if(use.activity_id!==null&&(!sel.activity_ids.includes(use.activity_id)||!p.verified_activities.some(a=>a.activity_id===use.activity_id&&a.verification_status==='verified')))reasons.push('ACTIVITY_NOT_AUTHORIZED');
  }
  return {target_id:t.target_id,session:t.session,project_id:t.project_id,role:t.role,mismatch_kind:t.mismatch_kind,ltg_use_before_normalization:before.length,ltg_use_after_normalization:after.length,normalization_outcome:before.length===0?'NOT_CREATED':after.length===0?'ALL_FILTERED':'RETAINED',filtered_reasons:[...new Set(reasons)],invalid_shape_count:before.filter(x=>schemaErrors(x.use,ltgUseSchema()).length).length};
 });
}
