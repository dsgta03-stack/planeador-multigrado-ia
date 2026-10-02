import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../../project-blueprint-v1/contracts.mjs';
import {compileSessionGraph} from '../../session-graph-v1/session-graph.mjs';
import {sessionGraphGate,sessionSemanticInputHash} from '../../session-graph-v1/gate.mjs';
import {SGS} from '../../session-graph-v1/catalog.mjs';
import {contributionRepairPreflight,validateContributionRepair} from '../session-contribution-repair.mjs';
import {createSessionGraphDrivers} from '../session-provider.mjs';

function fixture(){
 const constraints={constraints_hash:'a'.repeat(64),grades:[1,3],minutes_per_session:60,available_resources:['papel'],supports:['modelado']};
 const curriculum={snapshot_hash:'b'.repeat(64),pdas:[{pda_id:'p1',grade:1,pda_official:'Identifica una situación.'},{pda_id:'p3',grade:3,pda_official:'Identifica una situación.'}]};
 const methodology={methodology_decision_id:'m1',selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION','PLANIFICACION']};
 const blueprint={schema_version:'PROJECT_BLUEPRINT_V1',blueprint_id:'bp',revision:1,source:{constraints_hash:constraints.constraints_hash,curriculum_snapshot_hash:curriculum.snapshot_hash,methodology_decision_id:'m1'},methodology:{...methodology},pda_analysis:[{pda_id:'p1'},{pda_id:'p3'}],grade_contributions:[],final_outcome:{functional_requirements:[]},ltg_strategy:{mode:'NONE',selections:[]},project_stages:[{stage_id:'planning',output_artifact_id:'approved_plan',name:'Plan de acuerdos'}],session_progression:[{session_number:1,project_state_before:'sin plan',session_project_goal:'planificar acuerdos',required_learning:['identificar'],pda_focus:['p1','p3'],methodology_operations:['IDENTIFICACION','PLANIFICACION'],input_artifact_ids:['context'],expected_output_artifact_ids:['approved_plan'],expected_partial_product:'plan de acuerdos escrito',acceptance_criteria:['plan escrito'],project_state_after:'plan listo',terminal:true,next_session_dependency:null}]};
 const h=hash(blueprint),approval={approval_version:'PROJECT_BLUEPRINT_APPROVAL_V1',status:'APPROVED',gate_version:'BLUEPRINT_GATE_V1',blueprint_hash:h,evaluated_blueprint_hash:h,approved_blueprint_hash:h};
 const base={title:'Analizamos',contribution_rationale:'prepara decisiones del plan',common_student_action:'comparan situaciones de convivencia',grade_participation:[1,3].map(grade=>({grade,student_action:'identifica situaciones y compara hallazgos',differentiation:grade===1?'dibuja':'escribe',pda_mobilization:[{pda_id:grade===1?'p1':'p3',status:'DEVELOPING'}],evidence:'registro de situaciones'})),teacher_role:'modela',resources:['papel'],supports:['modelado'],minutes:20,methodology_operations:['IDENTIFICACION'],functional_requirement_ids:[],ltg_activity_ids:[],evidence:'registro escrito',assessment_criteria:['identifica situaciones']};
 const proposal={authoring_version:'SESSION_GRAPH_AUTHORING_V1',sessions:[{session_number:1,activities:[{...base,activity_key:'preparation',contribution_mode:'COMPLEMENTARY',input_refs:['context'],output:'hallazgos para decidir el plan',contributes_to_artifact_ids:[]},{...structuredClone(base),activity_key:'production',title:'Escribimos el plan',contribution_mode:'DIRECT',contribution_rationale:'produce el plan autorizado',common_student_action:'deciden acuerdos a partir de los hallazgos y escriben el plan de acuerdos',methodology_operations:['PLANIFICACION'],input_refs:['preparation'],output:'plan de acuerdos escrito',contributes_to_artifact_ids:['approved_plan']}]}]};
 return {source:{constraints,curriculum,methodology,blueprint,approval},proposal};
}
const ctx=f=>({sources:{constraints:f.source.constraints,curriculum:f.source.curriculum,methodology:f.source.methodology},blueprint:f.source.blueprint,approval:f.source.approval,previous_proposal:f.proposal,compile_error:{rule:'SGD-010',message:'orphan complementary'}});
const endpoint='https://example.supabase.co/functions/v1/plan-project-blueprint-v1-shadow';
const token='x'.repeat(64);
const driversFor=(output,capture=()=>{})=>createSessionGraphDrivers({endpoint,token,durableEvidence:false,fetchImpl:async(_url,init)=>{capture(JSON.parse(init.body));return new Response(JSON.stringify({finish_reason:'STOP',output}),{status:200})}});

test('terminal COMPLEMENTARY is rejected even when reason claims SGD-010 fixed',async()=>{
 const f=fixture(),a=f.proposal.sessions[0].activities[1];a.contribution_mode='COMPLEMENTARY';a.contributes_to_artifact_ids=[];
 const before=structuredClone(f);
 const drivers=driversFor({status:'PROPOSAL',reason:'SGD-010 está corregido',proposal:f.proposal});
 await assert.rejects(()=>drivers.sessionRepair(ctx(f)),/SGD-010 orphan complementary/);
 assert.equal(drivers.diagnostics().logical_calls,1);
 assert.deepEqual(f,before);
});

test('later same-session consumer is accepted with exact proposal bytes',()=>{
 const f=fixture(),before=hash(f.proposal);
 assert.strictEqual(validateContributionRepair(f.proposal,f.source),f.proposal);
 assert.equal(hash(f.proposal),before);
 const preflight=contributionRepairPreflight(ctx(f));
 assert.deepEqual(preflight.sessions[0].activities[0].later_same_session_consumers,['production']);
 assert.equal(preflight.sessions[0].activities[0].orphan_complementary,false);
});

test('consumer in another session cannot rescue a terminal complementary',()=>{
 const f=fixture(),a=f.proposal.sessions[0].activities[1];a.contribution_mode='COMPLEMENTARY';a.contributes_to_artifact_ids=[];
 f.proposal.sessions.push({session_number:2,activities:[{...structuredClone(a),activity_key:'elsewhere',input_refs:['production']}]});
 assert.throws(()=>validateContributionRepair(f.proposal,f.source),/SGD-010/);
 assert.equal(contributionRepairPreflight(ctx(f)).sessions[0].activities[1].orphan_complementary,true);
});

test('prior consumer cannot rescue a terminal complementary',()=>{
 const f=fixture(),activities=f.proposal.sessions[0].activities;
 activities[0].input_refs.push('production');activities[1].contribution_mode='COMPLEMENTARY';activities[1].contributes_to_artifact_ids=[];
 assert.throws(()=>validateContributionRepair(f.proposal,f.source),/SGD-010/);
});

test('DIRECT producing an approved session artifact passes unchanged',()=>{
 const f=fixture();assert.strictEqual(validateContributionRepair(f.proposal,f.source),f.proposal);
 const {graph}=compileSessionGraph(f.proposal,f.source,{graph_id:'valid-direct'});
 assert.deepEqual(graph.sessions[0].activities[1].contributes_to_artifact_ids,['approved_plan']);
});

test('DIRECT cannot use an invented artifact or one outside this session',()=>{
 const f=fixture();f.proposal.sessions[0].activities[1].contributes_to_artifact_ids=['invented'];
 assert.throws(()=>validateContributionRepair(f.proposal,f.source),/artifact outside session|enum/);
 f.source.blueprint.project_stages.push({stage_id:'later',output_artifact_id:'other_session'});
 f.proposal.sessions[0].activities[1].contributes_to_artifact_ids=['other_session'];
 assert.throws(()=>validateContributionRepair(f.proposal,f.source),/artifact outside session/);
});

test('preflight never converts an orphan to DIRECT or invents a consumer',()=>{
 const f=fixture(),a=f.proposal.sessions[0].activities[1];a.contribution_mode='COMPLEMENTARY';a.contributes_to_artifact_ids=[];
 const before=structuredClone(f),p=contributionRepairPreflight(ctx(f));
 assert.equal(p.sessions[0].activities[1].last_in_session,true);
 assert.equal(p.sessions[0].activities[1].orphan_complementary,true);
 assert.deepEqual(p.sessions[0].activities[1].later_same_session_consumers,[]);
 assert.deepEqual(p.sessions[0].allowed_output_artifact_ids,['approved_plan']);
 assert.match(p.rule,/No conviertas automáticamente a DIRECT/);
 assert.deepEqual(f,before);
 assert.throws(()=>{p.sessions[0].activities[1].contribution_mode='DIRECT'},TypeError);
});

test('cosmetic DIRECT with an authorized ID cannot bypass semantic SGS-005',()=>{
 const f=fixture(),a=f.proposal.sessions[0].activities[0];
 a.contribution_mode='DIRECT';a.contributes_to_artifact_ids=['approved_plan'];
 const {graph}=compileSessionGraph(f.proposal,f.source,{graph_id:'false-direct'}),input={...f.source,graph};
 const semantic={input_hash:sessionSemanticInputHash(input),findings:Object.keys(SGS).map(rule_id=>({rule_id,status:rule_id==='SGS-005'?'FAIL':'PASS',scope:'preparation',observed:'Sólo produce hallazgos preparatorios, no el plan aprobado',expected:SGS[rule_id]}))};
 const gate=sessionGraphGate(input,semantic);
 assert.equal(gate.status,'FAIL');
 assert.equal(gate.semantic_findings.find(row=>row.rule_id==='SGS-005').status,'FAIL');
});

test('REPAIR sends a concrete contribution table and emits proposal before explanation',async()=>{
 const f=fixture();let sent;
 const drivers=driversFor({status:'PROPOSAL',reason:'cadena conservada',proposal:f.proposal},body=>sent=body);
 const result=await drivers.sessionRepair(ctx(f));
 assert.deepEqual(result.proposal,f.proposal);
 assert.deepEqual(sent.prompt.contribution_preflight,contributionRepairPreflight(ctx(f)));
 assert.deepEqual(Object.keys(sent.response_schema.properties),['proposal','status','reason']);
 assert.equal(sent.model,'gemini-3.5-flash-lite');
 assert.equal(sent.task,'REPAIR');
 assert.equal(drivers.diagnostics().logical_calls,1);
});
