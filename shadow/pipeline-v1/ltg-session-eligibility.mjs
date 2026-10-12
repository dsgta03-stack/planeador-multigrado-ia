import {normalizeSessionGraphAuthoring} from '../session-graph-v1/authoring.mjs';

export const LTG_SESSION_ELIGIBILITY_INSTRUCTION='CORE es una obligacion GLOBAL: al menos un uso valido en todo el grafo, NO USE en todas las sesiones. Usa ltg_session_eligibility: si eligible=false NO declares USE ni intentes crear ltg_use en esa sesion. Si eligible=true, USE solo cuando realmente creas un ltg_use autentico usando compatible_grade, compatible_pda_ids y authorized_activity_ids; null solo si null_activity_allowed. No infieras vinculos por tema o grado, no uses PDA de otra sesion ni IDs de otro proyecto. Una decision local NOT_RECOMMENDED no cambia el rol global CORE: conserva su uso real en otra sesion elegible. SUPPORT y OPTIONAL mantienen su semantica existente. Cero sesiones elegibles para CORE es incompatibilidad global: no inventes usos, no cambies focos, vinculos ni Blueprint.';

export function ltgSessionEligibility(source){
 const {blueprint,curriculum,constraints}=source;
 return (blueprint.ltg_strategy?.selections||[]).flatMap(selection=>(blueprint.session_progression||[]).map(session=>{
  const project=(curriculum.ltg||[]).find(p=>p.project_id===selection.project_id);
  const selected_activity_ids=[...(selection.activity_ids||[])];
  const verified_activity_ids=selected_activity_ids.filter(id=>project?.verified_activities?.some(a=>a.activity_id===id&&a.verification_status==='verified'));
  const intersection=(selection.pda_ids||[]).filter(id=>session.pda_focus?.includes(id)&&project?.verified_pda_links?.includes(id));
  const compatible_pda_ids=intersection.filter(id=>curriculum.pdas?.some(p=>p.pda_id===id&&p.grade===project.grade));
  const null_activity_allowed=!!project&&selected_activity_ids.length===0;
  const reasons=[];
  if(!project)reasons.push('PROJECT_NOT_IN_CURRICULUM');
  if(!intersection.length)reasons.push('NO_SESSION_PDA_INTERSECTION');
  else if(!compatible_pda_ids.length)reasons.push('PDA_GRADE_INCOMPATIBLE');
  // All active grades must participate in every session. This is potential eligibility,
  // not a claim that any particular authored activity already includes the grade.
  if(project&&!constraints.grades.includes(project.grade))reasons.push('GRADE_NOT_PARTICIPATING');
  if(project&&!null_activity_allowed&&!verified_activity_ids.length)reasons.push('NO_VERIFIED_ACTIVITY');
  let eligible=false;
  if(!reasons.length){
   // Reference-only probe delegates actual retention to the unchanged normalizer.
   // Never emit this probe as authoring or pedagogical evidence.
   const probe={sessions:[{session_number:session.session_number,activities:[{activity_key:'eligibility_probe',grade_participation:[{grade:project.grade,pda_mobilization:[]}],ltg_use:[{project_id:selection.project_id,activity_id:null_activity_allowed?null:verified_activity_ids[0]}]}]}]};
   eligible=normalizeSessionGraphAuthoring(probe,source).sessions[0].activities[0].ltg_use.length===1;
   if(!eligible)reasons.push('NO_AUTHORIZED_COMBINATION');
  }
  return {project_id:selection.project_id,role:selection.role,session:session.session_number,eligible,compatible_grade:project?.grade??null,compatible_pda_ids,selected_activity_ids,verified_activity_ids,authorized_activity_ids:[...verified_activity_ids],null_activity_allowed,reasons};
 }));
}

export function coreEligibilitySummary(source,matrix){
 return (source.blueprint.ltg_strategy?.selections||[]).filter(s=>s.role==='CORE').map(s=>({project_id:s.project_id,eligible_sessions:matrix.filter(row=>row.project_id===s.project_id&&row.eligible).map(row=>row.session)}));
}

export function assertCoreLtgEligibility(source,matrix){
 const failures=coreEligibilitySummary(source,matrix).filter(row=>row.eligible_sessions.length===0).map(row=>{
  const selection=source.blueprint.ltg_strategy.selections.find(s=>s.project_id===row.project_id);
  const project=source.curriculum.ltg?.find(p=>p.project_id===row.project_id);
  return {...row,role:'CORE',selected_pda_ids:[...(selection.pda_ids||[])],verified_pda_links:[...(project?.verified_pda_links||[])]};
 });
 if(failures.length){const e=Error('CORE_LTG_NO_ELIGIBLE_SESSION: '+failures.map(f=>f.project_id).join(','));e.code='CORE_LTG_NO_ELIGIBLE_SESSION';e.ltg_eligibility_diagnostics={core_projects:failures,local_decisions:[]};throw e;}
}

export function ltgEligibilityDiagnostics(proposal,source,matrix){
 return {core_projects:coreEligibilitySummary(source,matrix),local_decisions:(proposal.sessions||[]).flatMap(s=>(s.ltg_decisions||[]).filter(d=>d.decision==='USE').flatMap(d=>{
  const row=matrix.find(r=>r.session===s.session_number&&r.project_id===d.project_id);
  if(row?.eligible)return [];
  return [{session:s.session_number,project_id:d.project_id,role:row?.role??null,authored_decision:d.decision,eligible:false,compatible_pda_ids_count:row?.compatible_pda_ids.length??0,authorized_activity_ids_count:row?.authorized_activity_ids.length??0,reasons:row?.reasons||['PROJECT_NOT_SELECTED']}];
 }))};
}
