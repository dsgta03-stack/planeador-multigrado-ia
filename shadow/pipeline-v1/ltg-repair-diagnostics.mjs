import {normalizeSessionGraphAuthoring,ltgExecutionErrors,ltgUseSchema} from '../session-graph-v1/authoring.mjs';
import {schemaErrors} from '../project-blueprint-v1/contracts.mjs';

const sourceOf=ctx=>({...ctx.sources,blueprint:ctx.blueprint});
const usesIn=(proposal,session,project)=> (proposal?.sessions?.find(s=>s.session_number===session)?.activities||[]).flatMap(a=>(a.ltg_use||[]).filter(u=>u.project_id===project).map(use=>({activity:a,use})));
export function structuredLtgTarget(target,ctx){
 if(target.rule_id!=='SGD-013')return target;
 const m=target.observed?.match(/session=(\d+) project_id=(\S+) decision=(USE|NOT_RECOMMENDED) concrete_use=(absent|present)/);
 if(!m)return target; // A generic contract error has no authoritative session/project locator.
 const session=Number(m[1]),project_id=m[2],decision=m[3],source=sourceOf(ctx);
 const sel=ctx.blueprint?.ltg_strategy?.selections?.find(s=>s.project_id===project_id);
 const project=ctx.sources?.curriculum?.ltg?.find(p=>p.project_id===project_id);
 const focus=ctx.blueprint?.session_progression?.find(s=>s.session_number===session)?.pda_focus||[];
 const selected_activity_ids=[...(sel?.activity_ids||[])];
 const verified_activity_ids=selected_activity_ids.filter(id=>project?.verified_activities?.some(a=>a.activity_id===id&&a.verification_status==='verified'));
 const compatible_pda_ids=(sel?.pda_ids||[]).filter(id=>focus.includes(id)&&project?.verified_pda_links?.includes(id)&&ctx.sources?.curriculum?.pdas?.some(p=>p.pda_id===id&&p.grade===project.grade));
 const prior=ctx.previous_proposal??ctx.previous_authoring_proposal;
 const before=usesIn(prior,session,project_id);
 const normalized=prior&&ctx.blueprint&&ctx.sources?normalizeSessionGraphAuthoring(prior,source):null;
 const after=usesIn(normalized,session,project_id);
 const invalid=before.length>0&&(!after.length||ltgExecutionErrors([{session_number:session,activities:before.map(x=>x.activity),ltg_decisions:[]}],source).some(e=>/unverified|generic LTG use|without verified|selected LTG activity|required|minLength|additionalProperties|maxLength/.test(e)));
 const mismatch_kind=decision==='NOT_RECOMMENDED'?'CONCRETE_USE_WITH_NOT_RECOMMENDED':invalid?'USE_WITH_INVALID_CONCRETE_USE':'USE_WITHOUT_CONCRETE_USE';
 return {...target,session,project_id,decision,concrete_use:invalid?'invalid':m[4],role:sel?.role??null,selected_activity_ids,verified_activity_ids,compatible_grade:project?.grade??null,compatible_pda_ids,mismatch_kind,
  authorized_use_possible:!!sel&&!!project&&compatible_pda_ids.length>0&&(selected_activity_ids.length===0||verified_activity_ids.length>0),
  requirement:'Resolve the structured mismatch using only these authorized references and authentic student use. CORE: never automatically convert USE to NOT_RECOMMENDED; if this session keeps USE, supply a real ltg_use with project_id, authorized activity_id (null only when selected_activity_ids is empty), student_action, moment and purpose. If the real design does not use it here, adjust the session decision only without violating global CORE use. SUPPORT: valid use implies USE; no valid use may remain NOT_RECOMMENDED under existing reconciliation. OPTIONAL: preserve its existing semantics. Do not invent IDs, links or pedagogical use. If no authorized combination exists, report the limitation; do not fabricate one.'};
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
