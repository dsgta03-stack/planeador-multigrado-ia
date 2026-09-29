import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherProjectionHash} from '../../pipeline-v1/projection.mjs';
import {toTeacherPlanView} from '../teacher-plan-view.mjs';
import {createFinalPlanSnapshot} from '../final-plan-snapshot.mjs';
import {exportSourceFromView,exportSourceFromSnapshot,assertExportSource} from '../export-source.mjs';

function viewFixture(){
 const body={projection_version:'TEACHER_PLAN_PROJECTION_V1',status:'READY_FOR_TEACHER',source:{blueprint_id:'bp1',blueprint_revision:1,approved_blueprint_hash:'a'.repeat(64),graph_id:'g1',graph_revision:1,approved_graph_hash:'b'.repeat(64)},project:{problem_frame:{original_problem:'Problema',pedagogical_focus:'Foco'},guiding_question:{question:'¿Pregunta?'},methodology:{selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']},final_outcome:{name:'Producto',description:'Descripción',purpose:'Propósito',audience_or_beneficiary:'Grupo',use_or_destination:'Aula'},pda_analysis:[{pda_id:'p1',grade:1,official_text:'PDA oficial'}],grade_contributions:[{grade:1,pda_ids:['p1']}],project_stages:[{stage_id:'s1'}],ltg_strategy:{mode:'NONE',selections:[]}},sessions:[{session_number:1,stage_ids:['s1'],project_state_before:'Antes',session_project_goal:'Meta',required_learning:['Aprendizaje'],pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],input_artifact_ids:['input_context'],expected_output_artifact_ids:['artifact_1'],expected_partial_product:'Producto parcial',acceptance_criteria:['Criterio'],project_state_after:'Después',terminal:true,next_session_dependency:null,total_minutes:30,activities:[]}],traceability:{pda:{},methodology:{},artifacts:{},functional_requirements:{}}};
 const teacher_plan={...body,projection_hash:teacherProjectionHash(body)};
 return toTeacherPlanView({pipelineResult:{pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'READY_FOR_TEACHER',repair_count:0,teacher_plan}});
}

test('fresh export source preserves exact validated view binding',()=>{
 const view=viewFixture();
 const source=exportSourceFromView(view);
 assert.equal(source.source_kind,'TEACHER_PLAN_VIEW');
 assert.equal(source.projection_hash,view.source.projection_hash);
 assert.equal(source.view_hash,view.view_hash);
 assert.deepEqual(source.plan_view,view);
 assert.equal(assertExportSource(source),true);
});

test('historical export source restores exact stored validated view',()=>{
 const view=viewFixture();
 const snapshot=createFinalPlanSnapshot({view,createdAt:'2026-09-26T19:40:00.000Z'});
 const source=exportSourceFromSnapshot(snapshot);
 assert.equal(source.source_kind,'FINAL_PLAN_SNAPSHOT');
 assert.equal(source.snapshot_hash,snapshot.snapshot_hash);
 assert.deepEqual(source.plan_view,view);
 assert.equal(assertExportSource(source),true);
});

test('export source rejects a modified view after binding',()=>{
 const source=structuredClone(exportSourceFromView(viewFixture()));
 source.plan_view.project.name='Cambio';
 assert.throws(()=>assertExportSource(source),/TEACHER_PLAN_VIEW_TAMPERED/);
});
