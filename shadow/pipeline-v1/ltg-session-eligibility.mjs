import {normalizeSessionGraphAuthoring} from '../session-graph-v1/authoring.mjs';
import {hash} from '../project-blueprint-v1/contracts.mjs';

export const LTG_SESSION_ELIGIBILITY_INSTRUCTION='CORE is a graph-level obligation, not a per-session obligation. CORE exige al menos un uso valido en todo el grafo, NO USE en todas las sesiones. Para CADA fila de ltg_session_eligibility: eligible=false => ltg_decision MUST be NOT_RECOMMENDED and no ltg_use may be authored. NO declares USE ni intentes crear ltg_use en esa sesion. eligible=true => USE is allowed only when a concrete authorized use is authored. Usa compatible_grade, compatible_pda_ids y authorized_activity_ids; null solo si null_activity_allowed. Never emit USE solely because role=CORE. If CORE has at least one eligible session, it is valid for other sessions to be NOT_RECOMMENDED; el CORE debe conservar al menos un uso concreto valido en alguna sesion elegible. No infieras vinculos por tema o grado, no uses PDA de otra sesion ni IDs de otro proyecto. Una decision local NOT_RECOMMENDED no cambia el rol global CORE. SUPPORT y OPTIONAL mantienen su semantica existente. Aplica estas reglas tanto en GENERATE como en REPAIR y audita TODAS las decisiones finales contra la matriz. Cero sesiones elegibles para CORE es incompatibilidad global: no inventes usos, no cambies focos, vinculos ni Blueprint.';

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

export function ltgDecisionAuthority(matrix){
 return {
  fixed_decisions:matrix.filter(r=>!r.eligible).map(r=>({session:r.session,project_id:r.project_id,decision:'NOT_RECOMMENDED',reason:'No existe una combinacion curricular LTG autorizada para esta sesion.'})),
  provider_rows:matrix.filter(r=>r.eligible).map(r=>({row_id:'LTG_ROW_'+hash({session:r.session,project_id:r.project_id}),session:r.session,project_id:r.project_id,role:r.role})),
  instruction:'En la respuesta, ltg_decisions y ltg_use identifican el LTG exclusivamente mediante row_id de provider_rows; NO contienen project_id, role ni otra identidad del proyecto. El motor resuelve row_id a la sesion y proyecto autorizados. Omite todas las fixed_decisions: el motor las ensamblara sin pedirte que las copies. Una fila desconocida, fija o de otra sesion sera rechazada, nunca corregida. Conserva la obligacion CORE global de uso valido en alguna fila elegible.'
 };
}

// Explicit ownership boundary, before normalization; never rewrite or discard provider decisions/uses.
export function assembleLtgDecisions(proposal,matrix){
 const authority=ltgDecisionAuthority(matrix),assembled=structuredClone(proposal);
 for(const session of assembled.sessions||[]){
  const allowed=new Map(authority.provider_rows.filter(r=>r.session===session.session_number).map(r=>[r.row_id,r]));
  const authored=session.ltg_decisions;
  if(!Array.isArray(authored)&&matrix.length)throw Error('SESSION_PROVIDER_LTG_AUTHORITY: decisions array required');
  for(const item of [...(Array.isArray(authored)?authored:[]),...(session.activities||[]).flatMap(a=>a.ltg_use||[])]){
   if(Object.hasOwn(item,'project_id')||Object.hasOwn(item,'role'))throw Error(`SESSION_PROVIDER_LTG_AUTHORITY: session=${session.session_number} PROJECT_ID_NOT_PROVIDER_OWNED`);
   const row=allowed.get(item.row_id);
   if(!row)throw Error(`SESSION_PROVIDER_LTG_AUTHORITY: session=${session.session_number} UNKNOWN_OR_NONLOCAL_ROW_ID NOT_PROVIDER_OWNED`);
   delete item.row_id;
   item.project_id=row.project_id;
  }
  if(Array.isArray(authored))session.ltg_decisions=[...authored,...authority.fixed_decisions.filter(r=>r.session===session.session_number).map(({session:_,...d})=>d)];
 }
 return assembled;
}

// Transport-only schema; the persisted authoring contract and validators are unchanged.
export function providerLtgRowSchema(schema){
 const copy=structuredClone(schema),session=copy.properties.sessions.items;
 for(const item of [session.properties.ltg_decisions.items,session.properties.activities.items.properties.ltg_use.items]){
  delete item.properties.project_id;
  item.properties.row_id={type:'string'};
  item.required=item.required.map(field=>field==='project_id'?'row_id':field);
  item.additionalProperties=false;
 }
 return copy;
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
