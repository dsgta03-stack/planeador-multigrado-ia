// Opt-in compact authoring for the isolated shadow runner.
// This contract can reject authoring output; it cannot approve a Blueprint.
import {assertContract,hash,schemaErrors,sourceBinding,schemaFor} from './contracts.mjs';
import {constructionPlan,constructionTransport,compileConstruction} from './construction.mjs';
import {transportSchema} from './transport-schema.mjs';
import {FUNCTIONAL_PROFILES} from './catalog.mjs';
export const AUTHORING_VERSION='BLUEPRINT_AUTHORING_COMPACT_V1';
export const AUTHORING_INSTRUCTION='Escribe decisiones pedagógicas concretas, una idea por campo, sin introducciones ni ensayos. No repitas el PDA completo ni expliques de nuevo la metodología. Conserva acciones observables, evidencia, criterios, aportaciones por grado y progresión conceptual. support_need: hasta 1200 caracteres; otros textos: hasta 4000. Estos son límites de autoría, no criterios de aprobación pedagógica. Si no puedes expresar evidencia suficiente, informa la limitación; no sustituyas acciones por etiquetas. No escribas metadatos que completa el compilador. functional_profiles contiene sólo nombres de perfiles del catálogo (por ejemplo MUSEUM o ITINERANT), nunca sus requirement_id; functional_requirements contiene una fila por cada requisito del perfil declarado. Cuando una etapa cubra varias operaciones metodológicas, student_operation debe describir acciones observables suficientes para realizar cada una; coverage debe citar la cláusula concreta que demuestra cada operación. No reutilices una misma frase genérica para operaciones distintas salvo que esa frase realmente ejecute cada una. Si la acción cognitiva central es INDAGA, la aportación y las etapas deben incluir una fuente u observación accesible, una acción real de consulta/contraste y un registro que permita rastrear la evidencia; escribir simplemente que el alumnado indaga no demuestra el PDA. Cada functional_requirement.evidence debe ser producido o registrado explícitamente por una student_operation de alguno de sus stage_ids; no declares reportes, registros, circulación u otras evidencias que ninguna operación construye. Las referencias de evidencia deben señalar texto escrito por ti en la etapa indicada.';
const omit=(s,keys)=>{for(const k of keys)delete s.properties[k];s.required=s.required.filter(k=>!keys.includes(k));};
const copyEnum=(target,source)=>{if(source?.enum)target.enum=[...source.enum];};
export function authoringSchema(src,plan){
 const s=constructionTransport(transportSchema(src),plan),p=s.properties,domain=schemaFor('ProjectBlueprintV1').properties;
 omit(s,['schema_version','blueprint_id','revision','status','source','methodology','gate_result','construction_evidence']);
 omit(p.problem_frame,['original_problem']);omit(p.final_outcome,['outcome_id']);
 omit(p.feasibility,['requested_sessions','minutes_per_session','total_available_minutes']);
 omit(p.grade_contributions.items,['contribution_id']);
 omit(p.session_progression.items,['terminal','next_session_dependency']);
 // transportSchema intentionally strips most domain constraints. Restore every enum still
 // owned by the model so the LOCAL authoring contract and prompt cannot drift from the
 // ProjectBlueprintV1 domain. The provider decoder receives only the shape projection.
 copyEnum(p.guiding_question.properties.grade_accessibility,domain.guiding_question.properties.grade_accessibility);
 copyEnum(p.final_outcome.properties.type,domain.final_outcome.properties.type);
 p.final_outcome.properties.functional_profiles.items.enum=Object.keys(FUNCTIONAL_PROFILES);
 copyEnum(p.pda_analysis.items.properties.integration_strength,domain.pda_analysis.items.properties.integration_strength);
 copyEnum(p.ltg_strategy.properties.mode,domain.ltg_strategy.properties.mode);
 copyEnum(p.ltg_strategy.properties.selections.items.properties.role,domain.ltg_strategy.properties.selections.items.properties.role);
 for(const key of ['complexity','resource_feasibility','time_feasibility','multigrade_feasibility'])copyEnum(p.feasibility.properties[key],domain.feasibility.properties[key]);
 p.coverage={type:'array',minItems:plan.coverage_matrix.length,maxItems:plan.coverage_matrix.length,items:{type:'object',properties:{operation:{type:'string',enum:plan.coverage_matrix.map(x=>x.operation)},stage_id:{type:'string',enum:plan.stages.map(x=>x.stage_id)},action_quote:{type:'string'},evidence_ref:{type:'object',properties:{field:{type:'string',enum:['expected_output','acceptance_criteria']},index:{anyOf:[{type:'integer',minimum:0},{type:'null'}]}},required:['field','index']}},required:['operation','stage_id','action_quote','evidence_ref']}};
 s.required.push('coverage');
 const constrain=(x)=>{if(x.type==='object'){x.additionalProperties=false;Object.values(x.properties).forEach(constrain)}if(x.items)constrain(x.items);if(x.anyOf)x.anyOf.forEach(constrain);if(x.type==='string')x.maxLength=4000;};constrain(s);
 p.grade_contributions.items.properties.support_need.maxLength=1200;
 return s;
}
function validateAuthoring(value,s,path='$'){
 const errors=schemaErrors(value,s,path);
 const extra=(v,x,p)=>{if(x.anyOf)return;
  if(typeof v==='string'&&x.maxLength!==undefined&&v.length>x.maxLength)errors.push(`${p}: maxLength ${x.maxLength}`);
  if(Array.isArray(v)){if(x.maxItems!==undefined&&v.length>x.maxItems)errors.push(`${p}: maxItems`);v.forEach((item,i)=>extra(item,x.items,`${p}[${i}]`));}
  else if(v&&typeof v==='object')for(const [k,item] of Object.entries(v))if(x.properties?.[k])extra(item,x.properties[k],`${p}.${k}`);
 };extra(value,s,path);if(errors.length){const e=Error(`AUTHORING_CONTRACT: ${errors.join('; ')}`);e.code=errors.some(x=>x.includes('maxLength'))?'AUTHORING_FIELD_EXCESSIVE_LENGTH':'AUTHORING_CONTRACT_INVALID';throw e;}
}
export function compileAuthoring(proposal,src,plan,{blueprint_id,revision=1}={}){
 if(!blueprint_id||![1,2].includes(revision))throw Error('AUTHORING_ENVELOPE_REQUIRED');
 for(const [name,key] of [['TeacherConstraintsV1','constraints'],['CurriculumSnapshotV1','curriculum'],['MethodologyDecisionV1','methodology']])assertContract(name,src[key]);
 if(hash(plan)!==hash(constructionPlan(src)))throw Error('AUTHORING_SOURCE_PLAN_MISMATCH');
 validateAuthoring(proposal,authoringSchema(src,plan));
 const b=structuredClone(proposal),coverage=b.coverage;delete b.coverage;
 Object.assign(b,{schema_version:'PROJECT_BLUEPRINT_V1',blueprint_id,revision,status:'DRAFT',source:sourceBinding(src),methodology:{selected_id:src.methodology.selected_id,catalog_version:src.methodology.catalog_version,required_operations:[...src.methodology.required_operations]},gate_result:null});
 b.problem_frame.original_problem=src.constraints.original_problem;
 for(const g of b.grade_contributions)g.contribution_id=`grade_${g.grade}`;
 for(const row of b.session_progression){row.terminal=row.session_number===plan.budget.requested_sessions;row.next_session_dependency=row.terminal?null:row.session_number+1;}
 b.construction_evidence=coverage.map(row=>{
  const stage=b.project_stages.find(s=>s.stage_id===row.stage_id),ref=row.evidence_ref;
  if(!stage||(ref.field==='expected_output'&&ref.index!==null)||(ref.field==='acceptance_criteria'&&(!Number.isInteger(ref.index)||ref.index>=stage.acceptance_criteria.length)))throw Error('AUTHORING_EVIDENCE_REFERENCE_INVALID');
  return {operation:row.operation,stage_id:row.stage_id,student_operation_quote:row.action_quote,evidence_quote:ref.field==='expected_output'?stage.expected_output:stage.acceptance_criteria[ref.index]};
 });
 const built=compileConstruction(b,plan);
 assertContract('ProjectBlueprintV1',built.blueprint);
 return {blueprint:built.blueprint,record:{authoring_version:AUTHORING_VERSION,proposal_hash:hash(proposal),raw_proposal:structuredClone(proposal),construction:built.record}};
}
