import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherProjectionHash} from '../../pipeline-v1/projection.mjs';
import {buildTeacherPresentationEnvelope,assertRenderablePresentationEnvelope} from '../presentation-gateway.mjs';

function readyFixture(){
 const projectionBody={
  projection_version:'TEACHER_PLAN_PROJECTION_V1',status:'READY_FOR_TEACHER',
  source:{blueprint_id:'bp1',blueprint_revision:1,approved_blueprint_hash:'a'.repeat(64),graph_id:'g1',graph_revision:1,approved_graph_hash:'b'.repeat(64)},
  project:{problem_frame:{original_problem:'Problema',pedagogical_focus:'Foco'},guiding_question:{question:'¿Pregunta?'},methodology:{selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']},final_outcome:{name:'Producto',description:'Descripción',purpose:'Propósito',audience_or_beneficiary:'Grupo',use_or_destination:'Aula'},pda_analysis:[{pda_id:'p1',grade:1,official_text:'PDA oficial'}],grade_contributions:[{grade:1,pda_ids:['p1']}],project_stages:[{stage_id:'s1'}],ltg_strategy:{mode:'NONE',selections:[]}},
  sessions:[{session_number:1,stage_ids:['s1'],project_state_before:'Antes',session_project_goal:'Meta',required_learning:['Aprendizaje'],pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],input_artifact_ids:['input_context'],expected_output_artifact_ids:['artifact_1'],expected_partial_product:'Producto parcial',acceptance_criteria:['Criterio'],project_state_after:'Después',terminal:true,next_session_dependency:null,total_minutes:30,activities:[{order:1,title:'Actividad',contribution_mode:'DIRECT',contribution_rationale:'Razón',common_student_action:'Acción',grade_participation:[],teacher_role:'Acompaña',minutes:30,resources:[],supports:[],input_refs:[],output:'Producto parcial',contributes_to_artifact_ids:['artifact_1'],methodology_operations:['IDENTIFICACION'],functional_requirement_ids:[],ltg_activity_ids:[],evidence:'Evidencia',assessment_criteria:['Criterio']}]}],
  traceability:{pda:{},methodology:{},artifacts:{},functional_requirements:{}}
 };
 const teacher_plan={...projectionBody,projection_hash:teacherProjectionHash(projectionBody)};
 return {pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'READY_FOR_TEACHER',repair_count:0,teacher_plan};
}

test('ready pipeline yields one projection-bound view and snapshot',()=>{
 const pipelineResult=readyFixture();
 const envelope=buildTeacherPresentationEnvelope({
  pipelineResult,
  teacherContextBinding:{projection_hash:pipelineResult.teacher_plan.projection_hash,constraints_hash:'c'.repeat(64),teacher_context:{school:'Escuela'}},
  pipelineEvidence:{request_id:'req-1',model:'gemini-3.5-flash-lite'},
  createdAt:'2026-09-26T19:30:00.000Z'
 });
 assert.equal(envelope.renderable,true);
 assert.equal(envelope.status,'READY_FOR_TEACHER');
 assert.equal(envelope.teacher_plan_view.source.projection_hash,pipelineResult.teacher_plan.projection_hash);
 assert.equal(envelope.final_snapshot.source.view_hash,envelope.teacher_plan_view.view_hash);
 assert.equal(assertRenderablePresentationEnvelope(envelope),true);
});

test('rejected pipeline remains fail-closed and creates no view or snapshot',()=>{
 const envelope=buildTeacherPresentationEnvelope({pipelineResult:{pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'SESSION_GRAPH_REJECTED',repair_count:1}});
 assert.equal(envelope.renderable,false);
 assert.equal(envelope.teacher_plan_view,null);
 assert.equal(envelope.final_snapshot,null);
 assert.throws(()=>assertRenderablePresentationEnvelope(envelope),/PRESENTATION_GATEWAY_NOT_RENDERABLE/);
});

test('outer READY state with tampered projection still remains fail-closed',()=>{
 const pipelineResult=readyFixture();
 pipelineResult.teacher_plan={...pipelineResult.teacher_plan,projection_hash:'0'.repeat(64)};
 const envelope=buildTeacherPresentationEnvelope({pipelineResult});
 assert.equal(envelope.renderable,false);
 assert.equal(envelope.projection_valid,false);
 assert.equal(envelope.teacher_plan_view,null);
 assert.equal(envelope.final_snapshot,null);
});
