import {makeConstraints,makeSnapshot,makeDecision} from '../project-blueprint-v1/contracts.mjs';
import {CATALOG} from '../project-blueprint-v1/catalog.mjs';

export const LEGACY_REQUEST_ADAPTER_VERSION='PIPELINE_LEGACY_REQUEST_ADAPTER_V1';
export const LEGACY_REQUEST_STATUSES=Object.freeze(['NEEDS_TEACHER_INPUT','READY_FOR_CURRICULUM_RESOLUTION','READY_FOR_PIPELINE']);

const METHOD_IDS=Object.freeze(Object.keys(CATALOG));
const nonEmpty=value=>typeof value==='string'&&value.trim().length>0;
const uniq=items=>[...new Set(items)];
const clone=value=>structuredClone(value);

function integer(value,name,{min=1,max=Infinity}={}){
 const n=Number(value);
 if(!Number.isInteger(n)||n<min||n>max)throw Error(`LEGACY_REQUEST_INVALID_${name.toUpperCase()}`);
 return n;
}
function string(value,name){if(!nonEmpty(value))throw Error(`LEGACY_REQUEST_MISSING_${name.toUpperCase()}`);return value.trim();}
function stringArray(value,name,{allowEmpty=true}={}){
 if(!Array.isArray(value)||value.some(x=>!nonEmpty(x)))throw Error(`LEGACY_REQUEST_INVALID_${name.toUpperCase()}`);
 const out=uniq(value.map(x=>x.trim()));if(!allowEmpty&&!out.length)throw Error(`LEGACY_REQUEST_MISSING_${name.toUpperCase()}`);return out;
}
function gradesFrom(body){const raw=body.grados??body.grades;if(!Array.isArray(raw)||!raw.length)throw Error('LEGACY_REQUEST_MISSING_GRADES');return uniq(raw.map(x=>integer(x,'grade',{min:1,max:6}))).sort((a,b)=>a-b);}
function pdasFrom(body,grades){
 if(!Array.isArray(body.pdas)||!body.pdas.length)throw Error('LEGACY_REQUEST_MISSING_PDAS');
 const seen=new Set();return body.pdas.map((row,index)=>{
  if(!row||typeof row!=='object')throw Error(`LEGACY_REQUEST_INVALID_PDA_${index}`);
  const pda_id=string(row.pda_id,`pda_${index}_id`),grade=integer(row.grade,`pda_${index}_grade`,{min:1,max:6});
  if(!grades.includes(grade))throw Error(`LEGACY_REQUEST_PDA_GRADE_OUTSIDE_SELECTION:${pda_id}`);
  if(seen.has(pda_id))throw Error(`LEGACY_REQUEST_DUPLICATE_PDA:${pda_id}`);seen.add(pda_id);
  return {pda_id,grade,legacy_field:nonEmpty(row.field)?row.field.trim():null,legacy_content:nonEmpty(row.content)?row.content.trim():nonEmpty(row.content_official)?row.content_official.trim():null,legacy_pda_text:nonEmpty(row.pda)?row.pda.trim():nonEmpty(row.pda_official)?row.pda_official.trim():null};
 });
}
function methodologyFrom(body){
 const selected_id=String(body.methodology_selection??body.metodologia??'').trim();
 if(!METHOD_IDS.includes(selected_id))throw Error('LEGACY_REQUEST_MISSING_OR_INVALID_METHODOLOGY');
 const rec=body.methodology_recommendation?.recommended_id??null;
 const recommended_id=rec===null||rec===undefined||rec===''?null:String(rec).trim();
 if(recommended_id!==null&&!METHOD_IDS.includes(recommended_id))throw Error('LEGACY_REQUEST_INVALID_RECOMMENDATION');
 const selection_source=recommended_id===selected_id?'TEACHER_ACCEPTED_RECOMMENDATION':'TEACHER';
 return {selected_id,recommended_id,selection_source};
}
function teacherConstraintPayload(body,grades){
 const tc=body.teacher_constraints&&typeof body.teacher_constraints==='object'?body.teacher_constraints:{};
 const missing=[];
 const students_by_grade=tc.students_by_grade&&typeof tc.students_by_grade==='object'&&!Array.isArray(tc.students_by_grade)?clone(tc.students_by_grade):null;
 if(!students_by_grade||grades.some(g=>!Number.isInteger(Number(students_by_grade[String(g)]??students_by_grade[g]))||Number(students_by_grade[String(g)]??students_by_grade[g])<1))missing.push('students_by_grade');
 const reading_profile=nonEmpty(tc.reading_profile)?tc.reading_profile.trim():null;if(!reading_profile)missing.push('reading_profile');
 const writing_profile=nonEmpty(tc.writing_profile)?tc.writing_profile.trim():null;if(!writing_profile)missing.push('writing_profile');
 const autonomy_profile=nonEmpty(tc.autonomy_profile)?tc.autonomy_profile.trim():null;if(!autonomy_profile)missing.push('autonomy_profile');
 const connectivity=nonEmpty(tc.connectivity)?tc.connectivity.trim():null;if(!connectivity)missing.push('connectivity');
 const available_resources=Array.isArray(tc.available_resources)?stringArray(tc.available_resources,'available_resources'):null;if(available_resources===null)missing.push('available_resources');
 const supports=Array.isArray(tc.supports)?stringArray(tc.supports,'supports'):null;if(supports===null)missing.push('supports');
 const teacher_explicit_constraints=Array.isArray(tc.teacher_explicit_constraints)?stringArray(tc.teacher_explicit_constraints,'teacher_explicit_constraints'):null;if(teacher_explicit_constraints===null)missing.push('teacher_explicit_constraints');
 return {missing,values:{students_by_grade,reading_profile,writing_profile,autonomy_profile,connectivity,available_resources,supports,teacher_explicit_constraints}};
}

/**
 * Normalize only information the current UI actually sends. It deliberately does
 * not convert the legacy free-text `recursos` field into authorized resources and
 * does not trust legacy PDA text as curricular authority.
 */
export function analyzeLegacyPlanRequest(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('LEGACY_REQUEST_OBJECT_REQUIRED');
 const grades=gradesFrom(body),pdas=pdasFrom(body,grades),methodology=methodologyFrom(body);
 const requested_sessions=integer(body.sesiones??body.requested_sessions,'sessions');
 const minutes_per_session=integer(body.minutos??body.minutes_per_session,'minutes');
 const original_problem=string(body.situacion_problema??body.original_problem,'problem');
 const original_context=string(body.contexto??body.original_context,'context');
 const teacher=teacherConstraintPayload(body,grades);
 const explicit_ltg_selections=Array.isArray(body.explicit_ltg_selections)?clone(body.explicit_ltg_selections):[];
 const normalized={adapter_version:LEGACY_REQUEST_ADAPTER_VERSION,grades,selected_pda_ids:pdas.map(x=>x.pda_id),legacy_pda_hints:pdas,requested_sessions,minutes_per_session,original_problem,original_context,methodology,explicit_ltg_selections,teacher_constraints:teacher.values,legacy_resource_text:nonEmpty(body.recursos)?body.recursos.trim():null};
 return Object.freeze({status:teacher.missing.length?'NEEDS_TEACHER_INPUT':'READY_FOR_CURRICULUM_RESOLUTION',missing_teacher_fields:Object.freeze([...teacher.missing]),normalized:Object.freeze(normalized),curriculum_query:Object.freeze({grades:[...grades],pda_ids:pdas.map(x=>x.pda_id)})});
}

function authoritativePdas(normalized,rows){
 if(!Array.isArray(rows))throw Error('AUTHORITATIVE_CURRICULUM_ROWS_REQUIRED');
 const expected=new Set(normalized.selected_pda_ids),seen=new Set(),out=[];
 for(const row of rows){
  if(!row||typeof row!=='object'||!expected.has(row.pda_id))continue;
  if(seen.has(row.pda_id))throw Error(`AUTHORITATIVE_CURRICULUM_DUPLICATE:${row.pda_id}`);seen.add(row.pda_id);
  const hint=normalized.legacy_pda_hints.find(x=>x.pda_id===row.pda_id);
  if(!hint||Number(row.grade)!==hint.grade)throw Error(`AUTHORITATIVE_CURRICULUM_GRADE_MISMATCH:${row.pda_id}`);
  out.push({pda_id:string(row.pda_id,'authoritative_pda_id'),grade:integer(row.grade,'authoritative_pda_grade',{min:1,max:6}),field:string(row.field,'authoritative_field'),content_official:string(row.content_official,'authoritative_content'),pda_official:string(row.pda_official,'authoritative_pda_text'),verification_status:string(row.verification_status,'authoritative_verification_status')});
 }
 const missing=normalized.selected_pda_ids.filter(id=>!seen.has(id));if(missing.length)throw Error(`AUTHORITATIVE_CURRICULUM_MISSING:${missing.join(',')}`);
 return out.sort((a,b)=>normalized.selected_pda_ids.indexOf(a.pda_id)-normalized.selected_pda_ids.indexOf(b.pda_id));
}
function authoritativeLtg(rows){if(!Array.isArray(rows))throw Error('AUTHORITATIVE_LTG_ROWS_REQUIRED');return clone(rows);}

/**
 * Build the three immutable Pipeline source artifacts only after the missing
 * teacher constraints have been collected and PDA/LTG rows have been resolved
 * server-side from the authoritative curriculum store.
 */
export function buildPipelineSourceArtifacts(analysis,{curriculum_pdas,ltg=[],corpus_version_or_provenance}={}){
 if(!analysis||analysis.status!=='READY_FOR_CURRICULUM_RESOLUTION'||analysis.missing_teacher_fields?.length)throw Error('LEGACY_REQUEST_NOT_READY_FOR_SOURCE_BUILD');
 const n=analysis.normalized,tc=n.teacher_constraints;
 const pdas=authoritativePdas(n,curriculum_pdas),ltgRows=authoritativeLtg(ltg),provenance=string(corpus_version_or_provenance,'corpus_provenance');
 const constraints=makeConstraints({grades:[...n.grades],selected_pda_ids:[...n.selected_pda_ids],explicit_ltg_selections:clone(n.explicit_ltg_selections),requested_sessions:n.requested_sessions,minutes_per_session:n.minutes_per_session,original_problem:n.original_problem,original_context:n.original_context,students_by_grade:clone(tc.students_by_grade),reading_profile:tc.reading_profile,writing_profile:tc.writing_profile,autonomy_profile:tc.autonomy_profile,connectivity:tc.connectivity,available_resources:[...tc.available_resources],supports:[...tc.supports],teacher_explicit_constraints:[...tc.teacher_explicit_constraints]});
 const curriculum=makeSnapshot({corpus_version_or_provenance:provenance,pdas,ltg:ltgRows});
 const methodology=makeDecision(n.methodology);
 return Object.freeze({status:'READY_FOR_PIPELINE',sources:Object.freeze({constraints,curriculum,methodology}),adapter_version:LEGACY_REQUEST_ADAPTER_VERSION});
}
