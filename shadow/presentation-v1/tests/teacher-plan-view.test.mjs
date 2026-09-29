import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherProjectionHash} from '../../pipeline-v1/projection.mjs';
import {pipelinePresentationState,toTeacherPlanView,assertTeacherPlanView,teacherPlanViewHash,PIPELINE_UI_STATES} from '../teacher-plan-view.mjs';

function projectionFixture(){
 const body={
  projection_version:'TEACHER_PLAN_PROJECTION_V1',
  status:'READY_FOR_TEACHER',
  source:{blueprint_id:'bp1',blueprint_revision:1,approved_blueprint_hash:'a'.repeat(64),graph_id:'g1',graph_revision:1,approved_graph_hash:'b'.repeat(64)},
  project:{
   problem_frame:{original_problem:'Problema real',pedagogical_focus:'Foco',context_relevance:'Contexto',why_project_is_needed:'Necesidad',scope:['alcance'],out_of_scope:[]},
   guiding_question:{question:'¿Cómo mejoramos?',problem_link:'problema',product_link:'producto',grade_accessibility:'ALL_GRADES'},
   methodology:{selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']},
   final_outcome:{outcome_id:'out1',name:'Museo',type:'MUSEUM',description:'Museo escolar',purpose:'Compartir aprendizajes',audience_or_beneficiary:'Grupo',use_or_destination:'Aula',functional_profiles:['MUSEUM'],functional_requirements:[],completion_evidence:['museo'],authenticity_conditions:['real'],required_resources:[]},
   pda_analysis:[{pda_id:'p1',grade:1,official_text:'Texto oficial'}],
   grade_contributions:[{contribution_id:'grade_1',grade:1,pda_ids:['p1'],project_contribution:'Dibujo'}],
   project_stages:[{stage_id:'s1',output_artifact_id:'artifact_1'}],
   ltg_strategy:{mode:'NONE',selections:[],reason:'No aplica'}
  },
  sessions:[{
   session_number:1,stage_ids:['s1'],project_state_before:'Inicio',session_project_goal:'Meta',required_learning:['Aprendizaje'],pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],input_artifact_ids:['input_context'],expected_output_artifact_ids:['artifact_1'],expected_partial_product:'Producto parcial',acceptance_criteria:['Criterio'],project_state_after:'Cierre',terminal:true,next_session_dependency:null,total_minutes:30,
   activities:[{order:1,title:'Actividad',contribution_mode:'DIRECT',contribution_rationale:'Produce el artefacto',common_student_action:'Identifica una situación',grade_participation:[{grade:1,student_action:'Explica una situación',differentiation:'Apoyo oral',pda_mobilization:[{pda_id:'p1',status:'DEVELOPING'}],evidence:'Registro'}],teacher_role:'Modela',minutes:30,resources:[],supports:[],input_refs:['input_context'],output:'Producto',contributes_to_artifact_ids:['artifact_1'],methodology_operations:['IDENTIFICACION'],functional_requirement_ids:[],ltg_activity_ids:[],evidence:'Registro',assessment_criteria:['Identifica una situación']}]
  }],
  traceability:{pda:{p1:[{activity_id:'a1',grade:1,status:'DEVELOPING'}]},methodology:{IDENTIFICACION:['a1']},artifacts:{artifact_1:['a1']},functional_requirements:{}}
 };
 return {...body,projection_hash:teacherProjectionHash(body)};
}

function readyPipeline(){return {pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'READY_FOR_TEACHER',repair_count:0,teacher_plan:projectionFixture()};}

test('only a valid READY_FOR_TEACHER projection is renderable',()=>{
 const state=pipelinePresentationState(readyPipeline());
 assert.equal(state.status,'READY_FOR_TEACHER');
 assert.equal(state.renderable,true);
 assert.equal(state.projection_valid,true);
});

test('rejected or unavailable pipeline states are fail-closed and never render a plan',()=>{
 for(const status of ['SESSION_GRAPH_REJECTED','SESSION_REVIEW_UNAVAILABLE','SESSION_GRAPH_CONTRACT_REJECTED','SESSION_AUTHORING_FAILED','BLUEPRINT_NOT_APPROVED','NEEDS_TEACHER_INPUT']){
  const state=pipelinePresentationState({pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status,repair_count:0,teacher_plan:projectionFixture()});
  assert.equal(state.renderable,false,status);
  assert.notEqual(state.descriptor.kind,'ready',status);
 }
});

test('tampered TeacherPlanProjection remains non-renderable even when outer status says ready',()=>{
 const pipeline=readyPipeline();
 pipeline.teacher_plan.sessions[0].session_project_goal='TAMPERED';
 const state=pipelinePresentationState(pipeline);
 assert.equal(state.renderable,false);
 assert.equal(state.projection_valid,false);
 assert.match(state.projection_error,/TEACHER_PROJECTION_TAMPERED/);
 assert.throws(()=>toTeacherPlanView({pipelineResult:pipeline}),/TEACHER_PLAN_NOT_RENDERABLE/);
});

test('view adapter preserves approved semantics without generating fallback pedagogy',()=>{
 const pipeline=readyPipeline();
 const view=toTeacherPlanView({pipelineResult:pipeline});
 assert.equal(view.project.name,pipeline.teacher_plan.project.final_outcome.name);
 assert.equal(view.project.guiding_question,pipeline.teacher_plan.project.guiding_question.question);
 assert.deepEqual(view.project.pda_analysis,pipeline.teacher_plan.project.pda_analysis);
 assert.deepEqual(view.project.grade_contributions,pipeline.teacher_plan.project.grade_contributions);
 assert.deepEqual(view.sessions[0].activities,pipeline.teacher_plan.sessions[0].activities);
 assert.equal(view.sessions[0].expected_partial_product,pipeline.teacher_plan.sessions[0].expected_partial_product);
 assert.equal(view.source.projection_hash,pipeline.teacher_plan.projection_hash);
 assert.equal(view.source.constraints_hash,null);
 assert.equal(view.teacher_context,null);
 assertTeacherPlanView(view);
 assert.equal(view.view_hash,teacherPlanViewHash(view));
});

test('teacher context metadata must be explicitly bound to the same projection hash',()=>{
 const pipeline=readyPipeline();
 const binding={projection_hash:pipeline.teacher_plan.projection_hash,constraints_hash:'c'.repeat(64),teacher_context:{school:'Escuela',group:'Multigrado'}};
 const view=toTeacherPlanView({pipelineResult:pipeline,teacherContextBinding:binding});
 assert.equal(view.source.constraints_hash,'c'.repeat(64));
 assert.deepEqual(view.teacher_context,binding.teacher_context);
 assert.throws(()=>toTeacherPlanView({pipelineResult:pipeline,teacherContextBinding:{...binding,projection_hash:'d'.repeat(64)}}),/TEACHER_CONTEXT_PROJECTION_HASH_MISMATCH/);
});

test('all known UI states are explicit and only READY_FOR_TEACHER is success',()=>{
 assert.equal(PIPELINE_UI_STATES.READY_FOR_TEACHER.kind,'ready');
 for(const [status,descriptor] of Object.entries(PIPELINE_UI_STATES))if(status!=='READY_FOR_TEACHER')assert.notEqual(descriptor.kind,'ready',status);
});
