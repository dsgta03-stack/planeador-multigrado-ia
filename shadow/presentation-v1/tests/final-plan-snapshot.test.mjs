import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherProjectionHash} from '../../pipeline-v1/projection.mjs';
import {toTeacherPlanView,teacherPlanViewHash} from '../teacher-plan-view.mjs';
import {createFinalPlanSnapshot,assertFinalPlanSnapshot,restoreTeacherPlanView,finalPlanSnapshotHash} from '../final-plan-snapshot.mjs';

function pipelineFixture(){
 const projectionBody={
  projection_version:'TEACHER_PLAN_PROJECTION_V1',status:'READY_FOR_TEACHER',
  source:{blueprint_id:'bp1',blueprint_revision:1,approved_blueprint_hash:'a'.repeat(64),graph_id:'g1',graph_revision:1,approved_graph_hash:'b'.repeat(64)},
  project:{problem_frame:{original_problem:'Problema',pedagogical_focus:'Foco'},guiding_question:{question:'¿Pregunta?'},methodology:{selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']},final_outcome:{name:'Producto',description:'Descripción',purpose:'Propósito',audience_or_beneficiary:'Grupo',use_or_destination:'Aula'},pda_analysis:[{pda_id:'p1',grade:1,official_text:'PDA oficial'}],grade_contributions:[{grade:1,pda_ids:['p1']}],project_stages:[{stage_id:'s1'}],ltg_strategy:{mode:'NONE',selections:[]}},
  sessions:[{session_number:1,stage_ids:['s1'],project_state_before:'Antes',session_project_goal:'Meta',required_learning:['Aprendizaje'],pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],input_artifact_ids:['input_context'],expected_output_artifact_ids:['artifact_1'],expected_partial_product:'Producto parcial',acceptance_criteria:['Criterio'],project_state_after:'Después',terminal:true,next_session_dependency:null,total_minutes:30,activities:[{order:1,title:'Actividad'}]}],
  traceability:{pda:{},methodology:{},artifacts:{},functional_requirements:{}}
 };
 const teacher_plan={...projectionBody,projection_hash:teacherProjectionHash(projectionBody)};
 return {pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'READY_FOR_TEACHER',repair_count:0,teacher_plan};
}

function viewFixture(){
 const pipeline=pipelineFixture();
 return toTeacherPlanView({pipelineResult:pipeline,teacherContextBinding:{projection_hash:pipeline.teacher_plan.projection_hash,constraints_hash:'c'.repeat(64),teacher_context:{school:'Escuela',group:'1 y 3'}}});
}

test('snapshot persists exact validated view and restores without rerunning AI',()=>{
 const view=viewFixture();
 const snapshot=createFinalPlanSnapshot({view,createdAt:'2026-09-26T05:00:00.000Z',pipelineEvidence:{run_id:'run-1',model:'gemini-3.5-flash-lite'}});
 assertFinalPlanSnapshot(snapshot);
 assert.equal(snapshot.snapshot_hash,finalPlanSnapshotHash(snapshot));
 assert.equal(snapshot.source.projection_hash,view.source.projection_hash);
 assert.equal(snapshot.source.view_hash,view.view_hash);
 assert.equal(snapshot.source.constraints_hash,'c'.repeat(64));
 assert.deepEqual(restoreTeacherPlanView(snapshot),view);
});

test('tampering with stored plan semantics invalidates the snapshot',()=>{
 const snapshot=structuredClone(createFinalPlanSnapshot({view:viewFixture(),createdAt:'2026-09-26T05:00:00.000Z'}));
 snapshot.plan_view.sessions[0].session_project_goal='CAMBIO NO AUTORIZADO';
 assert.throws(()=>assertFinalPlanSnapshot(snapshot),/FINAL_PLAN_SNAPSHOT_TAMPERED/);
});

test('tampering only the duplicated source binding is also detected',()=>{
 const snapshot=structuredClone(createFinalPlanSnapshot({view:viewFixture(),createdAt:'2026-09-26T05:00:00.000Z'}));
 snapshot.source.approved_graph_hash='d'.repeat(64);
 snapshot.snapshot_hash=finalPlanSnapshotHash(snapshot);
 assert.throws(()=>assertFinalPlanSnapshot(snapshot),/FINAL_PLAN_SNAPSHOT_SOURCE_BINDING_MISMATCH/);
});

test('snapshot rejects unbound teacher context',()=>{
 const view=structuredClone(viewFixture());
 view.source.constraints_hash=null;
 view.view_hash=teacherPlanViewHash(view);
 assert.throws(()=>createFinalPlanSnapshot({view,createdAt:'2026-09-26T05:00:00.000Z'}),/FINAL_PLAN_SNAPSHOT_CONTEXT_BINDING_REQUIRED/);
});
