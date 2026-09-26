import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherProjectionHash} from '../../pipeline-v1/projection.mjs';
import {buildWebPresentationResponse,assertWebPresentationResponse} from '../web-response.mjs';

function readyFixture(){
 const body={projection_version:'TEACHER_PLAN_PROJECTION_V1',status:'READY_FOR_TEACHER',source:{blueprint_id:'bp1',blueprint_revision:1,approved_blueprint_hash:'a'.repeat(64),graph_id:'g1',graph_revision:1,approved_graph_hash:'b'.repeat(64)},project:{problem_frame:{original_problem:'Problema',pedagogical_focus:'Foco'},guiding_question:{question:'¿Pregunta?'},methodology:{selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']},final_outcome:{name:'Producto',description:'Descripción',purpose:'Propósito',audience_or_beneficiary:'Grupo',use_or_destination:'Aula'},pda_analysis:[{pda_id:'p1',grade:1,official_text:'PDA oficial'}],grade_contributions:[{grade:1,pda_ids:['p1']}],project_stages:[{stage_id:'s1'}],ltg_strategy:{mode:'NONE',selections:[]}},sessions:[{session_number:1,stage_ids:['s1'],project_state_before:'Antes',session_project_goal:'Meta',required_learning:['Aprendizaje'],pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],input_artifact_ids:['input_context'],expected_output_artifact_ids:['artifact_1'],expected_partial_product:'Producto parcial',acceptance_criteria:['Criterio'],project_state_after:'Después',terminal:true,next_session_dependency:null,total_minutes:30,activities:[]}],traceability:{pda:{},methodology:{},artifacts:{},functional_requirements:{}}};
 const teacher_plan={...body,projection_hash:teacherProjectionHash(body)};
 return {pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'READY_FOR_TEACHER',repair_count:0,teacher_plan};
}

test('ready response is 200 and includes validated plan plus snapshot',()=>{
 const pipelineResult=readyFixture();
 const response=buildWebPresentationResponse({pipelineResult,createdAt:'2026-09-26T20:00:00.000Z'});
 assert.equal(response.http_status,200);
 assert.equal(response.body.renderable,true);
 assert.ok(response.body.plan);
 assert.ok(response.body.snapshot);
 assert.equal(assertWebPresentationResponse(response),true);
});

test('teacher input requirement is 422 and contains no plan',()=>{
 const response=buildWebPresentationResponse({pipelineResult:{pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'NEEDS_TEACHER_INPUT',repair_count:0}});
 assert.equal(response.http_status,422);
 assert.equal(response.body.renderable,false);
 assert.equal(response.body.plan,null);
 assert.equal(response.body.snapshot,null);
 assert.equal(response.body.ui.kind,'teacher_input');
 assert.equal(assertWebPresentationResponse(response),true);
});

test('semantic rejection is 422 and cannot leak partial plan data',()=>{
 const response=buildWebPresentationResponse({pipelineResult:{pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'SESSION_GRAPH_REJECTED',repair_count:1,teacher_plan:{unexpected:'partial'}}});
 assert.equal(response.http_status,422);
 assert.equal(response.body.renderable,false);
 assert.equal(response.body.plan,null);
 assert.equal(response.body.snapshot,null);
 assert.equal(response.body.ui.kind,'rejected');
 assert.equal(assertWebPresentationResponse(response),true);
});

test('provider/review outage is retryable 503 and fail-closed',()=>{
 const response=buildWebPresentationResponse({pipelineResult:{pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'SESSION_REVIEW_UNAVAILABLE',repair_count:0}});
 assert.equal(response.http_status,503);
 assert.equal(response.body.renderable,false);
 assert.equal(response.body.ui.retryable,true);
 assert.equal(response.body.plan,null);
 assert.equal(assertWebPresentationResponse(response),true);
});
