// Opt-in compact authoring for the isolated shadow runner.
// This contract can reject authoring output; it cannot approve a Blueprint.
import {assertContract,hash,schemaErrors,sourceBinding,schemaFor} from './contracts.mjs';
import {constructionPlan,constructionTransport,compileConstruction} from './construction.mjs';
import {transportSchema} from './transport-schema.mjs';
import {FUNCTIONAL_PROFILES} from './catalog.mjs';
import {functionalDiagnostics} from './gate.mjs';
export const COMPOSITION_OUTCOME_INSTRUCTION='PROJECT_COMPOSITION_V1 es autoridad absoluta sobre final_outcome.name, final_outcome.purpose y final_outcome.description. Copia esos tres textos EXACTAMENTE: no resumir, mejorar redaccion, cambiar puntuacion, mayusculas o espacios ni parafrasear. En REPAIR funcional modifica solo los campos funcionales necesarios y conserva intactos los tres textos vinculantes. No reinterpretar el resultado aprobado.';
export function compositionOutcomeDiagnostics(proposal,composition,revision=1){
 if(!composition)return [];
 return ['name','purpose','description'].filter(field=>proposal?.final_outcome?.[field]!==composition.final_outcome[field]).map(field=>({field,revision,phase:revision===1?'GENERATE':'REPAIR'}));
}
export function assertCompositionOutcomeAuthoring(proposal,composition,revision=1){
 const diagnostics=compositionOutcomeDiagnostics(proposal,composition,revision);
 if(!diagnostics.length)return;
 const e=Error('PCB-AUTHORING '+diagnostics.map(x=>`FINAL_OUTCOME_${x.field.toUpperCase()}_DRIFT`).join('; '));
 e.code='AUTHORING_CONTRACT_INVALID';e.rule='PCB-AUTHORING';e.outcome_binding_diagnostics=diagnostics;throw e;
}
export const FUNCTIONAL_PROFILE_INSTRUCTION='available_functional_profiles es un catalogo de ALTERNATIVAS DISPONIBLES, no una seleccion. final_outcome.functional_profiles contiene solo perfiles que describen el funcionamiento real del RESULTADO FINAL, no actividades del proceso ni semejanza tematica. Investigar durante el proyecto no convierte automaticamente el outcome en INVESTIGATION; comunicar informacion no lo convierte en CAMPAIGN; construir materiales no lo convierte en PROTOTYPE; ayudar a la comunidad no lo convierte en SERVICE; actuar sobre el contexto no lo convierte en INTERVENTION; una exposicion no lo convierte en MUSEUM. ITINERANT solo aplica cuando el resultado realmente se mueve/circula entre espacios o publicos distintos. Para cada perfil seleccionado y para un type catalogado, incluye TODOS sus requirement_id obligatorios exactos; cada requisito debe representar una funcion real del outcome, con criterio, etapas y evidencia autenticos. No inventes requirements para justificar perfiles innecesarios. functional_profiles puede quedar vacio si no necesita perfiles especializados; conserva al menos los functional_requirements reales exigidos por el schema.';
export const FUNCTIONAL_PROFILE_REPAIR_INSTRUCTION='Resuelve simultaneamente TODOS los missing_requirement_ids de cada target. Si el perfil es genuino y funcional al outcome, conservalo y desarrolla TODOS sus requirements reales. Si fue sobredeclarado, retiralo unicamente si el resultado real no depende de esa funcion. No completes artificialmente siete perfiles ni inventes requisitos. Un type catalogado sigue exigiendo sus requisitos. La propuesta reparada completa volvera a pasar el mismo preflight.';
function validateFunctionalProfiles(proposal){
 const diagnostics=functionalDiagnostics(proposal);
 if(!diagnostics.length)return;
 const e=Error('BPD-AUTHORING '+diagnostics.map(({profile,missing})=>`FUNCTIONAL_PROFILE_REQUIREMENTS_MISSING:${profile}:${missing.join(',')}`).join('; '));
 e.code='AUTHORING_CONTRACT_INVALID';e.rule='BPD-AUTHORING';
 e.functional_profile_targets=diagnostics.map(({profile,missing})=>({profile,missing_requirement_ids:[...missing],outcome:{name:proposal.final_outcome.name,type:proposal.final_outcome.type,purpose:proposal.final_outcome.purpose},instruction:FUNCTIONAL_PROFILE_REPAIR_INSTRUCTION}));
 throw e;
}
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
function normalizeCoverageReferences(proposal,plan){
 const copy=structuredClone(proposal);
 return copy;
}
function validateRequiredResources(proposal,src){
 const allowed=new Set(src.constraints.available_resources);
 const rows=proposal.final_outcome?.required_resources;
 if(!Array.isArray(rows))return;
 const failures=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  const resourceOk=typeof row.resource==='string'&&allowed.has(row.resource);
  const alternativeOk=typeof row.alternative==='string'&&allowed.has(row.alternative)&&typeof row.alternative_rationale==='string'&&row.alternative_rationale.trim().length>0;
  if(!resourceOk&&!alternativeOk)failures.push(i);
 }
 if(failures.length){
  const e=Error('BPD-018: unauthorized required_resources at indexes '+failures.join(', '));
  e.code='AUTHORING_CONTRACT_INVALID';
  e.rule='BPD-018';
  throw e;
 }
}
function validateCoverageCompleteness(proposal,plan){
 const failures=[];
 for(const link of plan.coverage_matrix){
  const rows=proposal.coverage.filter(r=>r.operation===link.operation);
  if(rows.length!==1){failures.push(`COVERAGE_OPERATION_COUNT_INVALID:${link.operation}`);continue;}
  const row=rows[0],stage=proposal.project_stages.find(s=>s.stage_id===row.stage_id),ref=row.evidence_ref;
  const actionOk=row.stage_id===link.stage_id&&!!row.action_quote?.trim()&&!!stage?.student_operation?.includes(row.action_quote);
  let evidenceText='';
  if(stage&&ref?.field==='expected_output'&&ref.index===null)evidenceText=stage.expected_output;
  else if(stage&&ref?.field==='acceptance_criteria'&&Number.isInteger(ref.index)&&ref.index>=0&&ref.index<stage.acceptance_criteria.length)evidenceText=stage.acceptance_criteria[ref.index];
  if(!actionOk||!evidenceText?.trim()){
   if(row.stage_id!==link.stage_id||!stage)failures.push(`COVERAGE_STAGE_MISMATCH:${link.operation}`);
   if(!row.action_quote?.trim()||!stage?.student_operation?.includes(row.action_quote))failures.push(`ACTION_QUOTE_NOT_LITERAL:${link.operation}`);
   if(!evidenceText?.trim()){
    if(!['expected_output','acceptance_criteria'].includes(ref?.field))failures.push(`EVIDENCE_REF_FIELD_INVALID:${link.operation}`);
    else if(ref.field==='expected_output'?ref.index!==null:!Number.isInteger(ref.index)||ref.index<0||!stage||ref.index>=stage.acceptance_criteria.length)failures.push(`EVIDENCE_REF_INDEX_INVALID:${link.operation}`);
    else failures.push(`EVIDENCE_REF_EMPTY:${link.operation}`);
   }
  }
 }
 if(failures.length){
  const e=Error(`BPD-019 ${[...new Set(failures)].join('; ')}`);
  e.code='CONSTRUCTION_REJECTED';e.rule='BPD-019';throw e;
 }
}
export function compileAuthoring(proposal,src,plan,{blueprint_id,revision=1,projectComposition=null}={}){
 if(!blueprint_id||![1,2].includes(revision))throw Error('AUTHORING_ENVELOPE_REQUIRED');
 for(const [name,key] of [['TeacherConstraintsV1','constraints'],['CurriculumSnapshotV1','curriculum'],['MethodologyDecisionV1','methodology']])assertContract(name,src[key]);
 if(hash(plan)!==hash(constructionPlan(src)))throw Error('AUTHORING_SOURCE_PLAN_MISMATCH');
 validateAuthoring(proposal,authoringSchema(src,plan));
 assertCompositionOutcomeAuthoring(proposal,projectComposition,revision);
 const normalizedProposal=normalizeCoverageReferences(proposal,plan);
 validateRequiredResources(normalizedProposal,src);
 validateCoverageCompleteness(normalizedProposal,plan);
 validateFunctionalProfiles(normalizedProposal);
 const b=structuredClone(normalizedProposal),coverage=b.coverage;delete b.coverage;
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
 return {blueprint:built.blueprint,record:{authoring_version:AUTHORING_VERSION,proposal_hash:hash(proposal),raw_proposal:structuredClone(proposal),normalized_proposal_hash:hash(normalizedProposal),construction:built.record}};
}
