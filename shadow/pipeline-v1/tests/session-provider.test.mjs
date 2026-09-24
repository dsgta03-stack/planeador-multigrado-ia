import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionGraphDrivers} from '../session-provider.mjs';

const endpoint='https://example.supabase.co/functions/v1/plan-project-blueprint-v1-shadow';
const token='x'.repeat(64);

function fixture(){
 const constraints={constraints_hash:'a'.repeat(64),grades:[1],minutes_per_session:60,available_resources:['papel'],supports:['modelado']};
 const curriculum={snapshot_hash:'b'.repeat(64),pdas:[{pda_id:'p1',grade:1}]};
 const methodology={methodology_decision_id:'m1',selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']};
 const blueprint={blueprint_id:'bp1',revision:1,methodology:{required_operations:['IDENTIFICACION']},project_stages:[{stage_id:'s1',output_artifact_id:'artifact_1'}],session_progression:[{session_number:1,pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],expected_output_artifact_ids:['artifact_1']}],final_outcome:{functional_requirements:[]},ltg_strategy:{mode:'NONE',selections:[]}};
 const approval={approved_blueprint_hash:'c'.repeat(64)};
 const proposal={authoring_version:'SESSION_GRAPH_AUTHORING_V1',sessions:[{session_number:1,activities:[{activity_key:'a1',title:'Identificamos',contribution_mode:'DIRECT',contribution_rationale:'construye el registro',common_student_action:'identifican situaciones',grade_participation:[{grade:1,student_action:'identifica una situación',differentiation:'apoyo oral',pda_mobilization:[{pda_id:'p1',status:'DEVELOPING'}],evidence:'registro'}],teacher_role:'modela',resources:['papel'],supports:['modelado'],minutes:30,input_refs:[],output:'registro',contributes_to_artifact_ids:['artifact_1'],methodology_operations:['IDENTIFICACION'],functional_requirement_ids:[],ltg_activity_ids:[],evidence:'registro escrito',assessment_criteria:['registra una situación observable']}]}]};
 return {ctx:{sources:{constraints,curriculum,methodology},blueprint,approval},proposal};
}

const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('GENERATE keeps approved Blueprint out of protected endpoint input and uses decoder shape',async()=>{
 const f=fixture();let sent;
 const fetchImpl=async (_url,init)=>{sent=JSON.parse(init.body);return jsonResponse({provider:'google',finish_reason:'STOP',output:f.proposal})};
 const drivers=createSessionGraphDrivers({endpoint,token,durableEvidence:false,fetchImpl});
 const result=await drivers.sessionAuthor(f.ctx);
 assert.equal(result.proposal.authoring_version,'SESSION_GRAPH_AUTHORING_V1');
 assert.equal(sent.task,'GENERATE');
 assert.equal('blueprint' in sent.input,false);
 assert.equal(sent.prompt.blueprint.blueprint_id,'bp1');
 assert.equal(JSON.stringify(sent.response_schema).includes('"enum"'),false);
 assert.equal(drivers.diagnostics().logical_calls,1);
});

test('REPAIR preserves Blueprint as immutable context and validates repaired proposal',async()=>{
 const f=fixture();let sent;
 const fetchImpl=async (_url,init)=>{sent=JSON.parse(init.body);return jsonResponse({provider:'google',finish_reason:'STOP',output:{status:'PROPOSAL',reason:'microarquitectura corregida',proposal:f.proposal}})};
 const drivers=createSessionGraphDrivers({endpoint,token,durableEvidence:false,fetchImpl});
 const result=await drivers.sessionRepair({...f.ctx,previous_proposal:f.proposal,compile_error:{rule:'SGD-010',message:'bad contribution'}});
 assert.equal(result.proposal.sessions.length,1);
 assert.equal(sent.task,'REPAIR');
 assert.equal(sent.input.blueprint.blueprint_id,'bp1');
 assert.equal(sent.prompt.previous_proposal.authoring_version,'SESSION_GRAPH_AUTHORING_V1');
 assert.equal(sent.prompt.triggering_rules[0].rule,'SGD-010');
 assert.deepEqual(sent.response_schema.required,['status','reason','proposal']);
});

test('REPAIR can request Blueprint revision without rewriting it',async()=>{
 const f=fixture();
 const fetchImpl=async()=>jsonResponse({provider:'google',finish_reason:'STOP',output:{status:'BLUEPRINT_REVISION_REQUIRED',reason:'el presupuesto aprobado no permite ejecutar la etapa',proposal:f.proposal}});
 const drivers=createSessionGraphDrivers({endpoint,token,durableEvidence:false,fetchImpl});
 const result=await drivers.sessionRepair({...f.ctx,previous_proposal:f.proposal,compile_error:{rule:'SGD-005',message:'time'}});
 assert.equal(result.status,'BLUEPRINT_REVISION_REQUIRED');
 assert.match(result.reason,/presupuesto/);
 assert.equal('proposal' in result,false);
});

test('REVIEW sends exact semantic input hash and returns semantic envelope',async()=>{
 const f=fixture();let sent;
 const findings=[{rule_id:'SGS-001',status:'PASS',scope:'x',observed:'ok',expected:'ok'}];
 const fetchImpl=async (_url,init)=>{sent=JSON.parse(init.body);return jsonResponse({provider:'google',finish_reason:'STOP',output:{input_hash:'h1',findings}})};
 const drivers=createSessionGraphDrivers({endpoint,token,durableEvidence:false,fetchImpl});
 const input={...f.ctx.sources,blueprint:f.ctx.blueprint,graph:{schema_version:'SESSION_GRAPH_V1'}};
 const result=await drivers.sessionReview({input,request:{review_version:'SESSION_GRAPH_SEMANTIC_REVIEW_V1',gate_version:'SESSION_GRAPH_GATE_V1',input_hash:'h1',rules:{},context:{},output_contract:{}}});
 assert.equal(result.semantic.input_hash,'h1');
 assert.equal(sent.task,'REVIEW');
 assert.equal(sent.input_hash,'h1');
 assert.equal(sent.input.graph.schema_version,'SESSION_GRAPH_V1');
});

test('durable call polls the same request instead of replaying GENERATE',async()=>{
 const f=fixture();let calls=0,rid=null;
 const fetchImpl=async (_url,init)=>{
  calls++;const body=JSON.parse(init.body);
  if(calls===1){rid=body.request_id;return jsonResponse({status:'ACCEPTED',request_id:rid},202)}
  assert.equal(body.task,'EVIDENCE_READ');assert.equal(body.request_id,rid);
  if(calls===2)return jsonResponse({status:'PENDING'},202);
  return jsonResponse({http_status:200,body:{provider:'google',finish_reason:'STOP',output:f.proposal}});
 };
 const drivers=createSessionGraphDrivers({endpoint,token,durableEvidence:true,pollIntervalMs:0,maxPolls:3,fetchImpl,sleep:async()=>{}});
 const result=await drivers.sessionAuthor(f.ctx);
 assert.equal(result.proposal.sessions.length,1);
 assert.equal(calls,3);
 assert.equal(drivers.diagnostics().logical_calls,1);
});

test('provider 503 is surfaced and is not replayed by adapter',async()=>{
 const f=fixture();let calls=0;
 const fetchImpl=async()=>{calls++;return jsonResponse({code:'PROVIDER_ERROR',provider_status:503,provider_error_status:'UNAVAILABLE',provider_message:'high demand'},502)};
 const drivers=createSessionGraphDrivers({endpoint,token,durableEvidence:false,fetchImpl});
 await assert.rejects(()=>drivers.sessionAuthor(f.ctx),e=>e.code==='PROVIDER_ERROR'&&e.provider_status===503);
 assert.equal(calls,1);
 assert.equal(drivers.diagnostics().logical_calls,1);
});

test('adapter is locked to Gemini 3.5 Flash-Lite',()=>{
 assert.throws(()=>createSessionGraphDrivers({endpoint,token,model:'gemini-3.1-pro-preview'}),/SESSION_PROVIDER_MODEL_LOCKED/);
});
