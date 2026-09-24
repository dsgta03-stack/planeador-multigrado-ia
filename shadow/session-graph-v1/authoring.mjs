import {schemaErrors} from '../project-blueprint-v1/contracts.mjs';
import {SESSION_GRAPH_PROPOSAL_VERSION,CONTRIBUTION_MODES,PDA_MOBILIZATION_STATUSES} from './catalog.mjs';

export const SESSION_GRAPH_AUTHORING_INSTRUCTION=`Convierte el ProjectBlueprint aprobado en actividades ejecutables sin cambiar problema, pregunta, metodología, PDA, producto, etapas, estados, artefactos ni operaciones. Cada actividad debe justificar su contribución al proyecto. DIRECT sólo se usa cuando el output de esa actividad es un componente observable del artefacto esperado de la sesión; que una actividad sea necesaria o que su output se consuma después no basta para llamarla DIRECT. Si el output únicamente prepara una actividad posterior, contribution_mode debe ser COMPLEMENTARY, contributes_to_artifact_ids debe quedar vacío y una actividad posterior de la misma sesión debe consumir su activity_key mediante input_refs. Mantén una cadena input→acción del alumnado→output→evidencia→criterio. Diferencia por grado sin crear proyectos paralelos. Los PDA sólo se movilizan en su grado. WORKED significa que la acción concreta de esa actividad realiza el desempeño cognitivo completo y su finalidad expresada en el PDA oficial; si sólo desarrolla una parte o un prerrequisito usa DEVELOPING; si no moviliza ese PDA deja pda_mobilization vacío. No uses WORKED por continuidad con una actividad anterior. Las operaciones metodológicas deben enlazarse a la actividad que realmente las ejecuta, no a etiquetas ni a una actividad sólo temática. Usa únicamente recursos y apoyos autorizados. Un functional_requirement_id sólo puede enlazarse cuando esa actividad ejecuta concretamente el requisito y produce evidencia pertinente; indagar no equivale a seleccionar, seleccionar no equivale a producir piezas y trasladar no equivale por sí solo a mediar. Los assessment_criteria deben describir algo verificable en la acción, producto o evidencia del alumnado y evitar fórmulas vagas como 'comprende claramente' o 'participa adecuadamente'. No agregues sesiones, presentaciones duplicadas ni prepares una sesión inexistente.`;

export function sessionGraphAuthoringSchema(source){
 const {constraints,curriculum,blueprint}=source;
 const pdaIds=(curriculum.pdas||[]).filter(p=>constraints.grades.includes(p.grade)).map(p=>p.pda_id);
 const ops=blueprint.methodology.required_operations||[];
 const reqIds=(blueprint.final_outcome.functional_requirements||[]).map(r=>r.requirement_id);
 const ltgIds=(blueprint.ltg_strategy.selections||[]).flatMap(x=>x.activity_ids||[]);
 const str=(maxLength=2000)=>({type:'string',minLength:1,maxLength});
 const arr=(items,maxItems=20)=>({type:'array',items,maxItems});
 const mobilization={type:'object',additionalProperties:false,required:['pda_id','status'],properties:{pda_id:{type:'string',enum:pdaIds},status:{type:'string',enum:[...PDA_MOBILIZATION_STATUSES]}}};
 const gradeParticipation={type:'object',additionalProperties:false,required:['grade','student_action','differentiation','pda_mobilization','evidence'],properties:{
  grade:{type:'integer',enum:[...constraints.grades]},student_action:str(2000),differentiation:str(1200),pda_mobilization:arr(mobilization),evidence:str(1600)
 }};
 const activity={type:'object',additionalProperties:false,required:['activity_key','title','contribution_mode','contribution_rationale','common_student_action','grade_participation','teacher_role','resources','supports','minutes','input_refs','output','contributes_to_artifact_ids','methodology_operations','functional_requirement_ids','ltg_activity_ids','evidence','assessment_criteria'],properties:{
  activity_key:str(120),title:str(240),contribution_mode:{type:'string',enum:[...CONTRIBUTION_MODES]},contribution_rationale:str(1200),common_student_action:str(2000),
  grade_participation:{type:'array',minItems:1,maxItems:constraints.grades.length,items:gradeParticipation},teacher_role:str(1200),
  resources:arr({type:'string',enum:[...(constraints.available_resources||[])]}),supports:arr({type:'string',enum:[...(constraints.supports||[])]}),minutes:{type:'integer',minimum:1,maximum:constraints.minutes_per_session},
  input_refs:arr(str(160)),output:str(2000),contributes_to_artifact_ids:arr({type:'string',enum:blueprint.project_stages.map(s=>s.output_artifact_id)}),methodology_operations:arr({type:'string',enum:ops}),
  functional_requirement_ids:arr({type:'string',enum:reqIds}),ltg_activity_ids:arr({type:'string',enum:ltgIds}),evidence:str(2000),assessment_criteria:{type:'array',minItems:1,maxItems:8,items:str(1200)}
 }};
 const session={type:'object',additionalProperties:false,required:['session_number','activities'],properties:{session_number:{type:'integer',enum:blueprint.session_progression.map(s=>s.session_number)},activities:{type:'array',minItems:1,maxItems:8,items:activity}}};
 return {type:'object',additionalProperties:false,required:['authoring_version','sessions'],properties:{authoring_version:{type:'string',enum:[SESSION_GRAPH_PROPOSAL_VERSION]},sessions:{type:'array',minItems:blueprint.session_progression.length,maxItems:blueprint.session_progression.length,items:session}}};
}

export function providerAuthoringShapeSchema(source){return projectShape(sessionGraphAuthoringSchema(source));}
function projectShape(n){const o={};if(n.type!==undefined)o.type=n.type;if(n.properties){o.properties={};for(const [k,v] of Object.entries(n.properties))o.properties[k]=projectShape(v);o.required=[...(n.required||[])];}if(n.items)o.items=projectShape(n.items);return o;}

export function validateSessionGraphAuthoring(proposal,source){
 const schema=sessionGraphAuthoringSchema(source);const errors=schemaErrors(proposal,schema);
 const extra=(v,s,p='$')=>{if(Array.isArray(v)){if(s.maxItems!==undefined&&v.length>s.maxItems)errors.push(`${p}: maxItems`);v.forEach((x,i)=>extra(x,s.items,`${p}[${i}]`));return}if(v&&typeof v==='object'){for(const [k,x] of Object.entries(v))if(s.properties?.[k])extra(x,s.properties[k],`${p}.${k}`);return}if(typeof v==='string'&&s.maxLength!==undefined&&v.length>s.maxLength)errors.push(`${p}: maxLength ${s.maxLength}`);};
 extra(proposal,schema);if(errors.length){const e=Error(`SESSION_GRAPH_AUTHORING_CONTRACT: ${errors.join('; ')}`);e.code='SESSION_GRAPH_AUTHORING_INVALID';throw e}return true;
}
