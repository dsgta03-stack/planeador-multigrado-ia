import {executableFixture} from '../../session-graph-v1/tests/executable-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionGraphDrivers} from '../session-provider.mjs';
import {validateSessionGraphAuthoring} from '../../session-graph-v1/authoring.mjs';

const endpoint='https://example.supabase.co/functions/v1/plan-project-blueprint-v1-shadow';
const token='x'.repeat(64);
const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

function fixture(){
 const constraints={constraints_hash:'a'.repeat(64),grades:[1],selected_pda_ids:['p1'],minutes_per_session:60,available_resources:['papel'],supports:['modelado']};
 const curriculum={snapshot_hash:'b'.repeat(64),pdas:[{pda_id:'p1',grade:1,pda_official:'Explica una situación y propone un acuerdo para mejorar la convivencia.'}]};
 const methodology={methodology_decision_id:'m1',selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']};
 const blueprint={blueprint_id:'bp1',revision:1,methodology:{required_operations:['IDENTIFICACION']},project_stages:[{stage_id:'s1',output_artifact_id:'artifact_1'}],session_progression:[{session_number:1,pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],expected_output_artifact_ids:['artifact_1']}],final_outcome:{functional_requirements:[{requirement_id:'r1',criterion:'produce un registro',stage_ids:['s1'],evidence:'registro observable'}]},ltg_strategy:{mode:'NONE',selections:[]}};
 const approval={approved_blueprint_hash:'c'.repeat(64)};
 const proposal={authoring_version:'SESSION_GRAPH_AUTHORING_V1',sessions:[{session_number:1,activities:[{activity_key:'a1',title:'Identificamos',contribution_mode:'DIRECT',contribution_rationale:'construye el registro',common_student_action:'identifican situaciones',grade_participation:[{grade:1,student_action:'identifica una situación',differentiation:'apoyo oral',pda_mobilization:[{pda_id:'p1',status:'WORKED'}],evidence:'registro'}],teacher_role:'modela',resources:['papel'],supports:['modelado'],minutes:30,input_refs:[],output:'registro',contributes_to_artifact_ids:['artifact_1'],methodology_operations:['IDENTIFICACION'],functional_requirement_ids:['r1'],ltg_activity_ids:[],evidence:'registro escrito',assessment_criteria:['registra una situación observable']}]}]};
 executableFixture(proposal);
 return {ctx:{sources:{constraints,curriculum,methodology},blueprint,approval},proposal};
}

test('GENERATE defers strict authoring preflight to compile so the pipeline can spend its single repair',async()=>{
 const f=fixture();
 const fetchImpl=async()=>jsonResponse({provider:'google',finish_reason:'STOP',output:f.proposal});
 const drivers=createSessionGraphDrivers({endpoint,token,durableEvidence:false,fetchImpl});
 const result=await drivers.sessionAuthor(f.ctx);
 assert.equal(result.proposal.sessions[0].activities[0].grade_participation[0].pda_mobilization[0].status,'WORKED');
 const source={...f.ctx.sources,blueprint:f.ctx.blueprint,approval:f.ctx.approval};
 assert.throws(()=>validateSessionGraphAuthoring(result.proposal,source),/PROPONE_LOCAL_ACTION/);
 assert.equal(drivers.diagnostics().logical_calls,1);
});
