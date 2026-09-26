import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionGraphDrivers} from '../session-provider.mjs';

const endpoint='https://example.supabase.co/functions/v1/plan-project-blueprint-v1-shadow';
const token='x'.repeat(64);

function fixture(){
 const constraints={constraints_hash:'a'.repeat(64),grades:[1],selected_pda_ids:['p1'],minutes_per_session:60,available_resources:['papel'],supports:['modelado']};
 const curriculum={snapshot_hash:'b'.repeat(64),pdas:[{pda_id:'p1',grade:1,pda_official:'Explica una situación y propone un acuerdo para mejorar la convivencia.'}]};
 const methodology={methodology_decision_id:'m1',selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']};
 const blueprint={blueprint_id:'bp1',revision:1,methodology:{required_operations:['IDENTIFICACION']},project_stages:[{stage_id:'s1',output_artifact_id:'artifact_1'}],session_progression:[{session_number:1,pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],expected_output_artifact_ids:['artifact_1']}],final_outcome:{functional_requirements:[{requirement_id:'r1',criterion:'produce un registro',stage_ids:['s1'],evidence:'registro observable'}]},ltg_strategy:{mode:'NONE',selections:[]}};
 const approval={approved_blueprint_hash:'c'.repeat(64)};
 const proposal={authoring_version:'SESSION_GRAPH_AUTHORING_V1',sessions:[{session_number:1,activities:[{activity_key:'a1',title:'Identificamos',contribution_mode:'DIRECT',contribution_rationale:'construye el registro',common_student_action:'identifican situaciones',grade_participation:[{grade:1,student_action:'identifica una situación',differentiation:'apoyo oral',pda_mobilization:[{pda_id:'p1',status:'DEVELOPING'}],evidence:'registro'}],teacher_role:'modela',resources:['papel'],supports:['modelado'],minutes:30,input_refs:[],output:'registro',contributes_to_artifact_ids:['artifact_1'],methodology_operations:['IDENTIFICACION'],functional_requirement_ids:['r1'],ltg_activity_ids:[],evidence:'registro escrito',assessment_criteria:['registra una situación observable']}]}]};
 return {ctx:{sources:{constraints,curriculum,methodology},blueprint,approval},proposal};
}

const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

function assertScalarPolicy(prompt){
 assert.ok(prompt.scalar_text_policy);
 assert.ok(prompt.scalar_text_policy.fields.includes('activity.grade_participation[].student_action'));
 assert.ok(prompt.scalar_text_policy.fields.includes('activity.grade_participation[].evidence'));
 assert.ok(prompt.scalar_text_policy.fields.includes('activity.common_student_action'));
 assert.ok(prompt.scalar_text_policy.fields.includes('activity.output'));
 assert.ok(prompt.scalar_text_policy.fields.includes('activity.assessment_criteria[]'));
 assert.match(prompt.scalar_text_policy.rule,/cadena JSON escalar/i);
 assert.match(prompt.scalar_text_policy.rule,/Nunca devuelvas un objeto ni un arreglo/i);
}

function assertWorkedDefaultPolicy(prompt){
 assert.ok(prompt.pda_status_policy);
 assert.deepEqual(prompt.pda_status_policy.allowed_statuses,['WORKED','DEVELOPING']);
 assert.equal(prompt.pda_status_policy.default_status,'DEVELOPING');
 assert.match(prompt.pda_status_policy.rule,/inicializa TODA movilización como DEVELOPING/i);
 assert.match(prompt.pda_status_policy.rule,/ESA MISMA actividad/i);
 assert.match(prompt.pda_status_policy.rule,/no hereda/i);
 assert.equal(prompt.worked_pda_policy.length,1);
 assert.equal(prompt.worked_pda_policy[0].pda_id,'p1');
 assert.equal(prompt.worked_pda_policy[0].default_status,'DEVELOPING');
 assert.ok(prompt.worked_pda_policy[0].required_local_signals.includes('EXPLAIN_LOCAL_ACTION'));
 assert.ok(prompt.worked_pda_policy[0].required_local_signals.includes('PROPOSE_LOCAL_ACTION'));
 assert.match(prompt.worked_pda_policy[0].rule,/TODOS los required_local_signals/i);
 assert.match(prompt.worked_pda_policy[0].rule,/conserva DEVELOPING/i);
}

test('GENERATE propagates scalar text and fail-closed WORKED policies to provider',async()=>{
 const f=fixture();let sent;
 const fetchImpl=async (_url,init)=>{sent=JSON.parse(init.body);return jsonResponse({provider:'google',finish_reason:'STOP',output:f.proposal})};
 const drivers=createSessionGraphDrivers({endpoint,token,durableEvidence:false,fetchImpl});
 await drivers.sessionAuthor(f.ctx);
 assert.equal(sent.task,'GENERATE');
 assertScalarPolicy(sent.prompt);
 assertWorkedDefaultPolicy(sent.prompt);
 assert.match(sent.system,/scalar_text_policy/i);
 assert.match(sent.system,/objetos ni arreglos/i);
 assert.match(sent.system,/DEVELOPING/i);
 assert.match(sent.system,/required_local_signals/i);
 assert.match(sent.system,/nunca heredes componentes/i);
});

test('REPAIR propagates scalar text policy and re-evaluates PDA status from DEVELOPING',async()=>{
 const f=fixture();let sent;
 const fetchImpl=async (_url,init)=>{sent=JSON.parse(init.body);return jsonResponse({provider:'google',finish_reason:'STOP',output:{status:'PROPOSAL',reason:'corregido',proposal:f.proposal}})};
 const drivers=createSessionGraphDrivers({endpoint,token,durableEvidence:false,fetchImpl});
 await drivers.sessionRepair({...f.ctx,previous_proposal:f.proposal,compile_error:{rule:'SESSION_GRAPH_AUTHORING_INVALID',message:'student_action must be string'}});
 assert.equal(sent.task,'REPAIR');
 assertScalarPolicy(sent.prompt);
 assertWorkedDefaultPolicy(sent.prompt);
 assert.match(sent.system,/scalar_text_policy/i);
 assert.match(sent.system,/DEVELOPING/i);
 assert.match(sent.system,/required_local_signals/i);
 assert.match(sent.prompt.repair_instruction,/student_action/i);
 assert.match(sent.prompt.repair_instruction,/evidence/i);
 assert.match(sent.prompt.repair_instruction,/cadenas JSON escalares/i);
 assert.match(sent.prompt.repair_instruction,/REINICIA el juicio de cada movilización desde DEVELOPING/i);
 assert.match(sent.prompt.repair_instruction,/ESA MISMA actividad/i);
 assert.match(sent.prompt.repair_instruction,/Nunca inventes pasos artificiales sólo para obtener WORKED/i);
});
