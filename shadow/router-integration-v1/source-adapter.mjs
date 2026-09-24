import {makeConstraints,makeDecision,makeSnapshot} from '../project-blueprint-v1/contracts.mjs';

export const ROUTER_SOURCE_ADAPTER_VERSION='ROUTER_SOURCE_ADAPTER_V1';

const unique=a=>[...new Set(a)];
const asText=v=>typeof v==='string'?v.trim():'';
const asInt=v=>{const n=Number(v);return Number.isInteger(n)?n:null};
const list=v=>{
 if(Array.isArray(v))return unique(v.map(x=>asText(x)).filter(Boolean));
 if(typeof v==='string')return unique(v.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean));
 return [];
};
const pdaIdsFromRequest=body=>unique((Array.isArray(body?.pdas)?body.pdas:[]).map(x=>asText(x?.pda_id||x?.id)).filter(Boolean));
const gradesFromRequest=body=>unique((Array.isArray(body?.grados)?body.grados:[]).map(asInt).filter(x=>x&&x>=1&&x<=6)).sort((a,b)=>a-b);

export function requestEligibility(body){
 const reasons=[];
 const grades=gradesFromRequest(body);
 const pdaIds=pdaIdsFromRequest(body);
 const sessions=asInt(body?.sesiones);
 const minutes=asInt(body?.minutos);
 const problem=asText(body?.situacion_problema);
 const context=asText(body?.contexto);
 const selectedMethod=asText(body?.methodology_selection||body?.metodologia);
 if(!grades.length)reasons.push('GRADES_REQUIRED');
 if(!pdaIds.length)reasons.push('PDA_SELECTION_REQUIRED');
 if(!sessions||sessions<1)reasons.push('SESSIONS_REQUIRED');
 if(!minutes||minutes<1)reasons.push('MINUTES_REQUIRED');
 if(!problem)reasons.push('PROBLEM_REQUIRED');
 if(!context)reasons.push('CONTEXT_REQUIRED');
 if(!selectedMethod)reasons.push('METHODOLOGY_REQUIRED');
 return Object.freeze({eligible:reasons.length===0,reasons,grades,pda_ids:pdaIds,sessions,minutes,problem,context,selected_method:selectedMethod});
}

function normalizeStudents(value,grades){
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const out={};
 for(const grade of grades){
  const n=asInt(source[grade]??source[String(grade)]);
  if(n&&n>0)out[String(grade)]=n;
 }
 return out;
}

function explicitLtgSelections(body,pdaIds){
 if(!Array.isArray(body?.explicit_ltg_selections))return [];
 const allowed=new Set(pdaIds);
 const seen=new Set();
 const out=[];
 for(const row of body.explicit_ltg_selections){
  const project_id=asText(row?.project_id);
  const intent=asText(row?.intent).toUpperCase();
  const ids=unique((Array.isArray(row?.pda_ids)?row.pda_ids:[]).map(asText).filter(id=>allowed.has(id)));
  if(!project_id||!ids.length||!['CORE','SUPPORT','OPTIONAL'].includes(intent))continue;
  const key=`${project_id}|${intent}|${ids.slice().sort().join(',')}`;
  if(seen.has(key))continue;seen.add(key);
  out.push({project_id,pda_ids:ids,intent});
 }
 return out;
}

function assertAuthoritativePdas(rows,eligibility){
 if(!Array.isArray(rows))throw Error('CURRICULUM_PDA_LOOKUP_INVALID');
 const byId=new Map(rows.map(r=>[r.pda_id,r]));
 for(const id of eligibility.pda_ids){
  const row=byId.get(id);
  if(!row)throw Error(`AUTHORITATIVE_PDA_NOT_FOUND:${id}`);
  if(!eligibility.grades.includes(Number(row.grade)))throw Error(`AUTHORITATIVE_PDA_GRADE_MISMATCH:${id}`);
  if(!asText(row.field)||!asText(row.content_official)||!asText(row.pda_official)||!asText(row.verification_status))throw Error(`AUTHORITATIVE_PDA_INCOMPLETE:${id}`);
 }
 return eligibility.pda_ids.map(id=>byId.get(id));
}

function snapshotLtg(rows,pdaIds,grades){
 const allowedPdas=new Set(pdaIds),allowedGrades=new Set(grades);
 const out=[];
 for(const row of Array.isArray(rows)?rows:[]){
  const project_id=asText(row?.project_id);const grade=asInt(row?.grade);
  if(!project_id||!allowedGrades.has(grade))continue;
  const start=asInt(row?.pages?.start??row?.start_page),end=asInt(row?.pages?.end??row?.end_page);
  if(!start||!end||end<start)continue;
  const links=unique((row?.verified_pda_links||[]).map(asText).filter(id=>allowedPdas.has(id)));
  const activities=(Array.isArray(row?.verified_activities)?row.verified_activities:[]).map(a=>({
   activity_id:asText(a.activity_id||a.id),activity_order:asInt(a.activity_order),summary:asText(a.summary||a.activity_summary),page_start:asInt(a.page_start),page_end:asInt(a.page_end),verification_status:asText(a.verification_status)
  })).filter(a=>a.activity_id&&a.activity_order&&a.summary&&a.page_start&&a.page_end&&a.verification_status);
  out.push({project_id,grade,book:asText(row.book)||'LTG',scenario:asText(row.scenario)||'NO_ESPECIFICADO',name:asText(row.name)||project_id,pages:{start,end},verified_pda_links:links,verified_activities:activities});
 }
 return out;
}

export async function buildPipelineSourcesFromProductionRequest(body,{curriculumLookup}={}){
 const eligibility=requestEligibility(body);
 if(!eligibility.eligible){const e=Error(`ROUTER_SOURCE_NOT_ELIGIBLE:${eligibility.reasons.join(',')}`);e.code='ROUTER_SOURCE_NOT_ELIGIBLE';e.reasons=eligibility.reasons;throw e}
 if(typeof curriculumLookup!=='function')throw Error('CURRICULUM_LOOKUP_REQUIRED');
 const authoritative=await curriculumLookup({pda_ids:eligibility.pda_ids,grades:eligibility.grades});
 const pdas=assertAuthoritativePdas(authoritative?.pdas,eligibility).map(row=>({
  pda_id:row.pda_id,grade:Number(row.grade),field:row.field,content_official:row.content_official,pda_official:row.pda_official,verification_status:row.verification_status
 }));
 const ltg=snapshotLtg(authoritative?.ltg,eligibility.pda_ids,eligibility.grades);
 const explicit=explicitLtgSelections(body,eligibility.pda_ids).filter(x=>ltg.some(p=>p.project_id===x.project_id));
 const recommended=asText(body?.methodology_recommendation?.recommended_id)||null;
 const selection_source=recommended&&recommended===eligibility.selected_method?'TEACHER_ACCEPTED_RECOMMENDATION':'TEACHER';
 const constraints=makeConstraints({
  grades:eligibility.grades,
  selected_pda_ids:eligibility.pda_ids,
  explicit_ltg_selections:explicit,
  requested_sessions:eligibility.sessions,
  minutes_per_session:eligibility.minutes,
  original_problem:eligibility.problem,
  original_context:eligibility.context,
  students_by_grade:normalizeStudents(body?.students_by_grade||body?.alumnos_por_grado,eligibility.grades),
  reading_profile:asText(body?.reading_profile||body?.perfil_lectura)||'NOT_PROVIDED',
  writing_profile:asText(body?.writing_profile||body?.perfil_escritura)||'NOT_PROVIDED',
  autonomy_profile:asText(body?.autonomy_profile||body?.perfil_autonomia)||'NOT_PROVIDED',
  connectivity:asText(body?.connectivity||body?.conectividad)||'UNKNOWN',
  available_resources:list(body?.recursos||body?.available_resources),
  supports:list(body?.supports||body?.apoyos),
  teacher_explicit_constraints:list(body?.teacher_explicit_constraints||body?.restricciones_docente)
 });
 const curriculum=makeSnapshot({
  corpus_version_or_provenance:asText(authoritative?.provenance)||'SUPABASE_PUBLIC_PDA_LTG_AUTHORITATIVE_SNAPSHOT',
  pdas,
  ltg
 });
 const methodology=makeDecision({recommended_id:recommended,selected_id:eligibility.selected_method,selection_source});
 return Object.freeze({adapter_version:ROUTER_SOURCE_ADAPTER_VERSION,sources:Object.freeze({constraints,curriculum,methodology}),eligibility});
}
