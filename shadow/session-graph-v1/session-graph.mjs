import {deepFreeze,hash} from '../project-blueprint-v1/contracts.mjs';
import {SESSION_GRAPH_VERSION,SESSION_GRAPH_PROPOSAL_VERSION,BLUEPRINT_APPROVAL_VERSION,CONTRIBUTION_MODES,PDA_MOBILIZATION_STATUSES} from './catalog.mjs';
import {validateSessionGraphAuthoring} from './authoring.mjs';

const fail=(rule,detail)=>{const e=Error(`${rule}: ${detail}`);e.code='SESSION_GRAPH_REJECTED';e.rule=rule;throw e};
const asSet=a=>new Set(a||[]);
const sameSet=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
const nonEmpty=s=>typeof s==='string'&&s.trim().length>0;

export function approvedBlueprintHash(blueprint){return hash(blueprint)}

export function assertApprovedBlueprintSource({blueprint,approval,constraints,curriculum,methodology}){
 if(!blueprint||blueprint.schema_version!=='PROJECT_BLUEPRINT_V1')fail('SGD-001','PROJECT_BLUEPRINT_V1 required');
 const h=approvedBlueprintHash(blueprint);
 if(!approval||approval.approval_version!==BLUEPRINT_APPROVAL_VERSION||approval.status!=='APPROVED'||approval.gate_version!=='BLUEPRINT_GATE_V1'||approval.blueprint_hash!==h||approval.evaluated_blueprint_hash!==h||approval.approved_blueprint_hash!==h)fail('SGD-001','approved hash binding mismatch');
 if(blueprint.source?.constraints_hash!==constraints?.constraints_hash||blueprint.source?.curriculum_snapshot_hash!==curriculum?.snapshot_hash||blueprint.source?.methodology_decision_id!==methodology?.methodology_decision_id)fail('SGD-001','source binding mismatch');
 if(blueprint.methodology?.selected_id!==methodology?.selected_id||blueprint.methodology?.catalog_version!==methodology?.catalog_version||!sameSet(blueprint.methodology?.required_operations||[],methodology?.required_operations||[]))fail('SGD-001','methodology binding mismatch');
 return h;
}

function validateProposalShape(proposal,blueprint){
 if(!proposal||proposal.authoring_version!==SESSION_GRAPH_PROPOSAL_VERSION||!Array.isArray(proposal.sessions))fail('SGD-002','SESSION_GRAPH_AUTHORING_V1 sessions required');
 const expected=blueprint.session_progression.map(x=>x.session_number);
 const actual=proposal.sessions.map(x=>x.session_number);
 if(actual.length!==expected.length||new Set(actual).size!==actual.length||!expected.every(n=>actual.includes(n)))fail('SGD-002','exact session coverage required');
 for(const row of proposal.sessions){
  if(!Array.isArray(row.activities)||row.activities.length===0)fail('SGD-004',`session ${row.session_number} has no activities`);
  const keys=row.activities.map(a=>a.activity_key);
  if(keys.some(k=>!nonEmpty(k))||new Set(keys).size!==keys.length)fail('SGD-004',`session ${row.session_number} activity_key invalid/duplicate`);
 }
}

export function compileSessionGraph(proposal,source,{graph_id,revision=1}={}){
 if(!graph_id||!Number.isInteger(revision)||revision<1)fail('SGD-001','graph envelope required');
 const {blueprint,approval,constraints,curriculum}=source;
 const blueprintHash=assertApprovedBlueprintSource(source);
 validateSessionGraphAuthoring(proposal,source);
 validateProposalShape(proposal,blueprint);
 const pdaById=new Map((curriculum.pdas||[]).map(p=>[p.pda_id,p]));
 const availableResources=asSet(constraints.available_resources);
 const availableSupports=asSet(constraints.supports);
 const finalReqs=new Map((blueprint.final_outcome.functional_requirements||[]).map(r=>[r.requirement_id,r]));
 const authorizedLtgActivities=new Set((blueprint.ltg_strategy.selections||[]).flatMap(x=>x.activity_ids||[]));
 const stagesByArtifact=new Map(blueprint.project_stages.map(s=>[s.output_artifact_id,s]));
 const compiledSessions=[];

 for(const bSession of blueprint.session_progression){
  const authored=proposal.sessions.find(s=>s.session_number===bSession.session_number);
  const stageIds=bSession.expected_output_artifact_ids.map(id=>stagesByArtifact.get(id)?.stage_id).filter(Boolean);
  const expectedArtifacts=asSet(bSession.expected_output_artifact_ids);
  const sessionInputs=asSet(bSession.input_artifact_ids);
  const sessionMethods=asSet(bSession.methodology_operations);
  const sessionPdas=asSet(bSession.pda_focus);
  const activities=[];
  const localKeys=new Map();
  for(let i=0;i<authored.activities.length;i++){
   const a=authored.activities[i];
   if(!CONTRIBUTION_MODES.includes(a.contribution_mode)||!nonEmpty(a.contribution_rationale)||!nonEmpty(a.title)||!nonEmpty(a.common_student_action)||!nonEmpty(a.teacher_role)||!nonEmpty(a.output)||!nonEmpty(a.evidence)||!Array.isArray(a.assessment_criteria)||!a.assessment_criteria.length||a.assessment_criteria.some(x=>!nonEmpty(x)))fail('SGD-011',`activity ${a.activity_key} incomplete`);
   if(!Number.isInteger(a.minutes)||a.minutes<=0)fail('SGD-005',`activity ${a.activity_key} minutes`);
   if(!Array.isArray(a.grade_participation)||a.grade_participation.length===0)fail('SGD-007',`activity ${a.activity_key} grade participation required`);
   if(!Array.isArray(a.resources)||a.resources.some(x=>!availableResources.has(x)))fail('SGD-006',`activity ${a.activity_key} unauthorized resource`);
   if(!Array.isArray(a.supports)||a.supports.some(x=>!availableSupports.has(x)))fail('SGD-006',`activity ${a.activity_key} unauthorized support`);
   if(!Array.isArray(a.methodology_operations)||a.methodology_operations.some(op=>!sessionMethods.has(op)))fail('SGD-008',`activity ${a.activity_key} foreign methodology operation`);
   if(!Array.isArray(a.contributes_to_artifact_ids)||a.contributes_to_artifact_ids.some(id=>!expectedArtifacts.has(id)))fail('SGD-010',`activity ${a.activity_key} foreign artifact contribution`);
   if(a.contribution_mode==='DIRECT'&&!a.contributes_to_artifact_ids.length)fail('SGD-010',`direct activity ${a.activity_key} must contribute to expected artifact`);
   if(a.contribution_mode==='COMPLEMENTARY'&&a.contributes_to_artifact_ids.length)fail('SGD-010',`complementary activity ${a.activity_key} cannot claim expected artifact`);
   if(!Array.isArray(a.functional_requirement_ids)||a.functional_requirement_ids.some(id=>!finalReqs.has(id)||!finalReqs.get(id).stage_ids.some(stage=>stageIds.includes(stage))))fail('SGD-012',`activity ${a.activity_key} invalid functional requirement link`);
   if(!Array.isArray(a.ltg_activity_ids)||a.ltg_activity_ids.some(id=>!authorizedLtgActivities.has(id)))fail('SGD-013',`activity ${a.activity_key} unauthorized LTG activity`);
   if(blueprint.ltg_strategy.mode==='NONE'&&a.ltg_activity_ids.length)fail('SGD-013',`activity ${a.activity_key} LTG forbidden in NONE mode`);
   const gradeSeen=new Set();
   const gradeParticipation=a.grade_participation.map(g=>{
    if(!constraints.grades.includes(g.grade)||gradeSeen.has(g.grade)||!nonEmpty(g.student_action)||!nonEmpty(g.differentiation)||!nonEmpty(g.evidence)||!Array.isArray(g.pda_mobilization))fail('SGD-007',`activity ${a.activity_key} grade row invalid`);
    gradeSeen.add(g.grade);
    for(const m of g.pda_mobilization){
     const p=pdaById.get(m.pda_id);
     if(!p||p.grade!==g.grade||!sessionPdas.has(m.pda_id)||!PDA_MOBILIZATION_STATUSES.includes(m.status))fail('SGD-007',`activity ${a.activity_key} invalid PDA mobilization`);
    }
    return structuredClone(g);
   });
   const activityId=`session_${bSession.session_number}_activity_${i+1}`;
   const outputRef=`activity_output_${bSession.session_number}_${i+1}`;
   const resolvedInputs=[];
   if(!Array.isArray(a.input_refs))fail('SGD-009',`activity ${a.activity_key} input_refs required`);
   for(const ref of a.input_refs){
    if(sessionInputs.has(ref)){resolvedInputs.push(ref);continue}
    const prior=localKeys.get(ref);
    if(!prior)fail('SGD-009',`activity ${a.activity_key} input ${ref} is not prior/session input`);
    resolvedInputs.push(prior.output_ref);
   }
   const row={
    activity_id:activityId,order:i+1,title:a.title,contribution_mode:a.contribution_mode,contribution_rationale:a.contribution_rationale,
    common_student_action:a.common_student_action,grade_participation:gradeParticipation,teacher_role:a.teacher_role,
    resources:[...a.resources],supports:[...a.supports],minutes:a.minutes,input_refs:resolvedInputs,output:a.output,output_ref:outputRef,
    contributes_to_artifact_ids:[...a.contributes_to_artifact_ids],methodology_operations:[...a.methodology_operations],
    functional_requirement_ids:[...a.functional_requirement_ids],ltg_activity_ids:[...a.ltg_activity_ids],evidence:a.evidence,assessment_criteria:[...a.assessment_criteria]
   };
   activities.push(row);localKeys.set(a.activity_key,row);
  }
  compiledSessions.push({
   session_id:`session_${bSession.session_number}`,session_number:bSession.session_number,stage_ids:stageIds,
   project_state_before:bSession.project_state_before,session_project_goal:bSession.session_project_goal,required_learning:structuredClone(bSession.required_learning),
   pda_focus:[...bSession.pda_focus],methodology_operations:[...bSession.methodology_operations],input_artifact_ids:[...bSession.input_artifact_ids],
   expected_output_artifact_ids:[...bSession.expected_output_artifact_ids],expected_partial_product:bSession.expected_partial_product,
   blueprint_acceptance_criteria:structuredClone(bSession.acceptance_criteria),project_state_after:bSession.project_state_after,terminal:bSession.terminal,
   next_session_dependency:bSession.next_session_dependency,activities
  });
 }
 const graph={schema_version:SESSION_GRAPH_VERSION,graph_id,revision,status:'DRAFT',source_blueprint:{blueprint_id:blueprint.blueprint_id,blueprint_revision:blueprint.revision,blueprint_hash:blueprintHash,approved_blueprint_hash:approval.approved_blueprint_hash,gate_version:approval.gate_version},sessions:compiledSessions,traceability:deriveTraceability(compiledSessions,blueprint),gate_result:null};
 validateCompiledSessionGraph(graph,source);
 return deepFreeze({graph,record:{authoring_version:SESSION_GRAPH_PROPOSAL_VERSION,proposal_hash:hash(proposal),compiled_graph_hash:hash(graph),raw_proposal:structuredClone(proposal)}});
}

export function deriveTraceability(sessions,blueprint){
 const pda={},methodology={},artifacts={},functional_requirements={};
 for(const s of sessions)for(const a of s.activities){
  for(const g of a.grade_participation)for(const m of g.pda_mobilization)(pda[m.pda_id]??=[]).push({activity_id:a.activity_id,grade:g.grade,status:m.status});
  for(const op of a.methodology_operations)(methodology[op]??=[]).push(a.activity_id);
  for(const id of a.contributes_to_artifact_ids)(artifacts[id]??=[]).push(a.activity_id);
  for(const id of a.functional_requirement_ids)(functional_requirements[id]??=[]).push(a.activity_id);
 }
 for(const p of blueprint.pda_analysis)pda[p.pda_id]??=[];
 for(const op of blueprint.methodology.required_operations)methodology[op]??=[];
 for(const s of blueprint.project_stages)artifacts[s.output_artifact_id]??=[];
 for(const r of blueprint.final_outcome.functional_requirements)functional_requirements[r.requirement_id]??=[];
 return {pda,methodology,artifacts,functional_requirements};
}

export function validateCompiledSessionGraph(graph,source){
 const {blueprint,constraints}=source;
 const h=assertApprovedBlueprintSource(source);
 if(graph.schema_version!==SESSION_GRAPH_VERSION||graph.source_blueprint.blueprint_hash!==h||graph.source_blueprint.approved_blueprint_hash!==h)fail('SGD-001','compiled source hash mismatch');
 if(graph.sessions.length!==blueprint.session_progression.length||graph.sessions.some((s,i)=>s.session_number!==i+1))fail('SGD-002','session sequence mismatch');
 const allActivityIds=new Set();
 for(const s of graph.sessions){
  const b=blueprint.session_progression.find(x=>x.session_number===s.session_number);
  if(!b||s.project_state_before!==b.project_state_before||s.session_project_goal!==b.session_project_goal||s.project_state_after!==b.project_state_after||s.terminal!==b.terminal||s.next_session_dependency!==b.next_session_dependency||!sameSet(s.pda_focus,b.pda_focus)||!sameSet(s.methodology_operations,b.methodology_operations)||!sameSet(s.input_artifact_ids,b.input_artifact_ids)||!sameSet(s.expected_output_artifact_ids,b.expected_output_artifact_ids))fail('SGD-003',`session ${s.session_number} immutable projection mismatch`);
  if(!s.activities.length||s.activities.some((a,i)=>a.order!==i+1||allActivityIds.has(a.activity_id)||(allActivityIds.add(a.activity_id),false)))fail('SGD-004',`session ${s.session_number} activity identity/order`);
  const total=s.activities.reduce((n,a)=>n+a.minutes,0);if(total>constraints.minutes_per_session)fail('SGD-005',`session ${s.session_number} budget exceeded`);
  const methods=new Set(s.activities.flatMap(a=>a.methodology_operations));if(s.methodology_operations.some(op=>!methods.has(op)))fail('SGD-008',`session ${s.session_number} uncovered methodology operation`);
  const outputs=new Set(s.activities.map(a=>a.output_ref));
  for(const [i,a] of s.activities.entries()){
   for(const ref of a.input_refs)if(outputs.has(ref)){const producer=s.activities.findIndex(x=>x.output_ref===ref);if(producer<0||producer>=i)fail('SGD-009',`activity ${a.activity_id} future dependency`)}
   if(a.contribution_mode==='COMPLEMENTARY'&&!s.activities.slice(i+1).some(n=>n.input_refs.includes(a.output_ref)))fail('SGD-010',`orphan complementary ${a.activity_id}`);
   if(a.contribution_mode==='DIRECT'&&!a.contributes_to_artifact_ids.length)fail('SGD-010',`direct activity ${a.activity_id} has no artifact`);
  }
  for(const artifact of s.expected_output_artifact_ids)if(!s.activities.some(a=>a.contribution_mode==='DIRECT'&&a.contributes_to_artifact_ids.includes(artifact)))fail('SGD-010',`session ${s.session_number} expected artifact uncovered`);
  const gradesWithPda=new Set((constraints.grades||[]).filter(g=>s.pda_focus.some(id=>source.curriculum.pdas.some(p=>p.pda_id===id&&p.grade===g))));
  const participating=new Set(s.activities.flatMap(a=>a.grade_participation.filter(g=>g.pda_mobilization.length).map(g=>g.grade)));
  for(const g of gradesWithPda)if(!participating.has(g))fail('SGD-014',`session ${s.session_number} grade ${g} not mobilized`);
 }
 for(const r of blueprint.final_outcome.functional_requirements){const hits=graph.sessions.flatMap(s=>s.activities.map(a=>({s,a}))).filter(x=>x.a.functional_requirement_ids.includes(r.requirement_id)&&r.stage_ids.some(id=>x.s.stage_ids.includes(id)));if(!hits.length)fail('SGD-012',`functional requirement ${r.requirement_id} uncovered`)}
 if(blueprint.ltg_strategy.mode==='NONE'&&graph.sessions.some(s=>s.activities.some(a=>a.ltg_activity_ids.length)))fail('SGD-013','LTG links present in NONE mode');
 const last=graph.sessions.at(-1);if(!last?.terminal||last.next_session_dependency!==null)fail('SGD-015','terminal closure mismatch');
 const derived=deriveTraceability(graph.sessions,blueprint);if(hash(derived)!==hash(graph.traceability))fail('SGD-016','traceability mismatch');
 return true;
}
