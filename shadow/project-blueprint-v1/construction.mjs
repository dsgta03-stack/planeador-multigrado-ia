import {deepFreeze,hash} from './contracts.mjs';
import {COMMUNITY_GROUPS} from './catalog.mjs';
export const CONSTRUCTION_VERSION='BLUEPRINT_CONSTRUCTION_V1';
const genericSessionGroups=(operations,requestedSessions)=>{
 const groups=[];
 for(let i=0;i<requestedSessions;i++){
  const start=Math.floor(i*operations.length/requestedSessions);
  const end=Math.floor((i+1)*operations.length/requestedSessions);
  groups.push({stage_id:`session_${i+1}`,session_number:i+1,operations:operations.slice(start,end)});
 }
 return groups;
};
const fail=(rule,detail)=>{const e=Error(`${rule}: ${detail}`);e.code='CONSTRUCTION_REJECTED';e.rule=rule;throw e};
export function constructionPlan(src){
 const {constraints:c,curriculum:k,methodology:m}=src;
 if(!Number.isInteger(c.requested_sessions)||c.requested_sessions<1)fail('CONSTRUCTION_SCOPE','requested_sessions must be a positive integer');
 if(!Array.isArray(m.required_operations)||!m.required_operations.length)fail('CONSTRUCTION_SCOPE','methodology requires at least one operation');
 const bindings=c.selected_pda_ids.map(id=>{const p=k.pdas.find(p=>p.pda_id===id);if(!p||!c.grades.includes(p.grade))fail('BPD-002',id);return {pda_id:id,grade:p.grade,official_text:p.pda_official}});
 // Official purpose-based phases, never proportional assignment of operation indices.
 const groups=m.selected_id==='proyectos_comunitarios'&&c.requested_sessions===3?[
  {stage_id:'planning',session_number:1,operations:COMMUNITY_GROUPS.PLANEACION},
  {stage_id:'production',session_number:2,operations:COMMUNITY_GROUPS.ACCION},
  {stage_id:'intervention',session_number:3,operations:COMMUNITY_GROUPS.INTERVENCION},
 ]:m.selected_id==='proyectos_comunitarios'&&c.requested_sessions===1?
  [{stage_id:'integrated',session_number:1,operations:m.required_operations}]:
  genericSessionGroups(m.required_operations,c.requested_sessions);
 const stages=groups.map((g,i)=>({...g,order:i+1,output_artifact_id:`artifact_${g.stage_id}`,required_inputs:i?[`artifact_${groups[i-1].stage_id}`]:['input_context','input_curriculum'],consumed_by:i+1<groups.length?[groups[i+1].stage_id]:['outcome_01'],max_minutes:c.minutes_per_session}));
 const operations=stages.flatMap(s=>s.operations);
 if(m.required_operations.some(op=>!operations.includes(op))||operations.some(op=>!m.required_operations.includes(op)))fail('BPD-019','catalog coverage');
 return deepFreeze({version:CONSTRUCTION_VERSION,pda_bindings:bindings,grade_bindings:c.grades.map(grade=>({grade,pda_ids:bindings.filter(p=>p.grade===grade).map(p=>p.pda_id)})),outcome_id:'outcome_01',stages,coverage_matrix:stages.flatMap(s=>s.operations.map(operation=>({operation,stage_id:s.stage_id,session_number:s.session_number,output_artifact_id:s.output_artifact_id,student_operation:'REQUIRED_FROM_MODEL: exact observable action quote',evidence:'REQUIRED_FROM_MODEL: exact output or acceptance criterion quote'}))),artifact_dag:stages.map(s=>({artifact_id:s.output_artifact_id,produced_by_stage:s.stage_id,produced_in_session:s.session_number,valid_consumers:s.consumed_by})),budget:{requested_sessions:c.requested_sessions,session_minutes:c.minutes_per_session,total_minutes:c.requested_sessions*c.minutes_per_session},instruction:'Design pedagogy within the selected methodology operations and their official sequence. Preserve the certified 1/3-session community grouping when applicable; otherwise distribute ordered operations across the teacher-requested sessions without inventing or reordering operations. Sessions may legitimately contain no new methodology operation when the teacher requests more sessions than the methodology has distinct operations. No one-stage-per-operation requirement. Action must execute every assigned operation with observable evidence. Estimates must be realistic; never compress impossible work to fake feasibility. This is construction metadata, not sessions or a lesson plan.'});
}
export function constructionTransport(schema,plan){
 const s=structuredClone(schema),p=s.properties;
 const omit=(obj,keys)=>{for(const k of keys)delete obj.properties[k];obj.required=obj.required.filter(k=>!keys.includes(k))};
 omit(p.pda_analysis.items,['grade','official_text']);
 p.pda_analysis.items.properties.pda_id.enum=plan.pda_bindings.map(p=>p.pda_id);
 omit(p.grade_contributions.items,['pda_ids','curriculum_mode','integration_destination']);
 p.grade_contributions.items.properties.grade.enum=plan.grade_bindings.map(g=>g.grade);
 omit(p.project_stages.items,['order','required_inputs','methodology_operations','output_artifact_id','consumed_by']);
 p.project_stages.items.properties.stage_id.enum=plan.stages.map(s=>s.stage_id);
 p.project_stages.items.properties.estimated_minutes.minimum=1;
 p.project_stages.items.properties.estimated_minutes.maximum=plan.budget.session_minutes;
 p.project_stages.minItems=plan.stages.length;p.project_stages.maxItems=plan.stages.length;
 omit(p.session_progression.items,['input_artifact_ids','expected_output_artifact_ids','methodology_operations']);
 const fields={operation:{type:'string'},stage_id:{type:'string'},student_operation_quote:{type:'string'},evidence_quote:{type:'string'}};
 p.construction_evidence={type:'array',items:{type:'object',properties:fields,required:Object.keys(fields)}};s.required.push('construction_evidence');
 return s;
}
export function compileConstruction(proposal,plan){
 const b=structuredClone(proposal),proof=b.construction_evidence;delete b.construction_evidence;
 const exactly=(rows,expected,key,rule)=>{if(!Array.isArray(rows)||rows.length!==expected.length||new Set(rows.map(r=>r[key])).size!==expected.length||expected.some(x=>!rows.some(r=>r[key]===x)))fail(rule,`exact ${key} coverage required`)};
 exactly(b.pda_analysis,plan.pda_bindings.map(p=>p.pda_id),'pda_id','BPD-002');
 b.pda_analysis=b.pda_analysis.map(p=>({...p,...plan.pda_bindings.find(x=>x.pda_id===p.pda_id)}));
 exactly(b.grade_contributions,plan.grade_bindings.map(g=>g.grade),'grade','BPD-002');
 for(const g of b.grade_contributions){const binding=plan.grade_bindings.find(x=>x.grade===g.grade);if(g.pda_ids?.some(id=>!binding.pda_ids.includes(id)))fail('BPD-002','cross-grade PDA');Object.assign(g,{pda_ids:[...binding.pda_ids],curriculum_mode:binding.pda_ids.length?'PDA_SELECTED':'TRANSVERSAL_PROJECT',integration_destination:plan.outcome_id})}
 exactly(b.project_stages,plan.stages.map(s=>s.stage_id),'stage_id','BPD-015');
 b.project_stages=plan.stages.map(s=>{const authored=b.project_stages.find(x=>x.stage_id===s.stage_id);return {...authored,order:s.order,required_inputs:[...s.required_inputs],methodology_operations:[...s.operations],output_artifact_id:s.output_artifact_id,consumed_by:[...s.consumed_by]}});
 exactly(b.session_progression,Array.from({length:plan.budget.requested_sessions},(_,i)=>i+1),'session_number','BPD-015');
 for(const row of b.session_progression){const stages=plan.stages.filter(s=>s.session_number===row.session_number);row.expected_output_artifact_ids=stages.map(s=>s.output_artifact_id);row.methodology_operations=[...new Set(stages.flatMap(s=>s.operations))];row.input_artifact_ids=[...new Set(stages.flatMap(s=>s.required_inputs).filter(id=>['input_context','input_curriculum'].includes(id)||plan.artifact_dag.some(a=>a.artifact_id===id&&a.produced_in_session<row.session_number)))];}
 exactly(proof,plan.coverage_matrix.map(x=>x.operation),'operation','BPD-019');
 for(const row of proof){const link=plan.coverage_matrix.find(x=>x.operation===row.operation),s=b.project_stages.find(s=>s.stage_id===row.stage_id);if(row.stage_id!==link.stage_id||!row.student_operation_quote?.trim()||!s?.student_operation.includes(row.student_operation_quote)||!row.evidence_quote?.trim()||![s.expected_output,...s.acceptance_criteria].some(t=>t.includes(row.evidence_quote)))fail('BPD-019',`missing literal action/evidence for ${row.operation}`)}
 b.final_outcome.outcome_id=plan.outcome_id;
 Object.assign(b.feasibility,{requested_sessions:plan.budget.requested_sessions,minutes_per_session:plan.budget.session_minutes,total_available_minutes:plan.budget.total_minutes});
 validateConstruction(b,plan);
 return {blueprint:b,record:{version:plan.version,plan_hash:hash(plan),raw_proposal_hash:hash(proposal),compiled_blueprint_hash:hash(b),raw_proposal:proposal,coverage_evidence:proof}};
}
// Pre-acceptance invariant checks; never change minutes or pedagogical prose.
export function validateConstruction(b,plan){
 for(const p of b.pda_analysis){const official=plan.pda_bindings.find(x=>x.pda_id===p.pda_id);if(!official||p.grade!==official.grade||p.official_text!==official.official_text)fail('BPD-002','official binding mismatch')}
 for(const g of b.grade_contributions)if(g.curriculum_mode==='PDA_SELECTED'&&g.pda_ids.some(id=>!plan.pda_bindings.some(p=>p.pda_id===id&&p.grade===g.grade)))fail('BPD-002','cross-grade PDA');
 const producers=new Map();for(const row of b.session_progression)for(const id of row.expected_output_artifact_ids){if(producers.has(id))fail('BPD-015','duplicate production '+id);producers.set(id,row.session_number)}
 if(new Set(b.project_stages.map(s=>s.output_artifact_id)).size!==b.project_stages.length)fail('BPD-015','duplicate artifact');
 for(const row of b.session_progression)for(const id of row.input_artifact_ids)if(!['input_context','input_curriculum'].includes(id)&&!(producers.has(id)&&producers.get(id)<row.session_number))fail('BPD-015','future or same-session input '+id);
 let total=0;for(const row of b.session_progression){let minutes=0;for(const s of b.project_stages.filter(s=>row.expected_output_artifact_ids.includes(s.output_artifact_id))){if(!Number.isInteger(s.estimated_minutes)||s.estimated_minutes<=0)fail('BPD-TIME','positive integer estimate required');minutes+=s.estimated_minutes;}if(minutes>plan.budget.session_minutes)fail('BPD-TIME','session budget exceeded');total+=minutes;}
 if(total>plan.budget.total_minutes)fail('BPD-TIME','total budget exceeded');
 for(const s of b.project_stages){const row=b.session_progression.find(r=>r.expected_output_artifact_ids.includes(s.output_artifact_id));if(!row)fail('BPD-015','unproduced artifact');for(const op of s.methodology_operations)if(!row.methodology_operations.includes(op))fail('BPD-019','operation/producer mismatch');}
 for(const op of plan.coverage_matrix.map(r=>r.operation))if(!b.project_stages.some(s=>s.methodology_operations.includes(op)))fail('BPD-019','missing operation '+op);
 return true;
}
