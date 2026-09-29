import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {teacherProjectionHash} from '../shadow/pipeline-v1/projection.mjs';
import {toTeacherPlanView} from '../shadow/presentation-v1/teacher-plan-view.mjs';
import {toV0124TeacherProjectionView,assertV0124TeacherProjectionView,certifiedTeacherViewModelHash,V0124_CERTIFIED_TEACHER_VIEW_VERSION} from '../lib/v0124/teacher-projection-view.mjs';

function validView(){
 const projection={
  projection_version:'TEACHER_PLAN_PROJECTION_V1',status:'READY_FOR_TEACHER',
  source:{blueprint_id:'bp-1',blueprint_revision:2,approved_blueprint_hash:'a'.repeat(64),graph_id:'graph-1',graph_revision:1,approved_graph_hash:'b'.repeat(64)},
  project:{
   problem_frame:{original_problem:'Comprender la convivencia',pedagogical_focus:'Acuerdos del grupo'},
   guiding_question:{question:'¿Cómo compartimos nuestros acuerdos?'},
   methodology:{selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION','DIFUSION']},
   final_outcome:{name:'Cartel común',description:'Cartel de acuerdos explicado por el grupo',purpose:'Comunicar acuerdos',audience_or_beneficiary:'Grupo',use_or_destination:'Aula'},
   pda_analysis:[
    {pda_id:'p1',grade:1,official_text:'PDA oficial primero: explica acuerdos.',central_cognitive_action:'explica'},
    {pda_id:'p3',grade:3,official_text:'PDA oficial tercero: indaga y comunica.',central_cognitive_action:'indaga y comunica'}
   ],
   grade_contributions:[{grade:1,pda_ids:['p1'],contribution:'Ilustración'},{grade:3,pda_ids:['p3'],contribution:'Explicación'}],
   project_stages:[{stage_id:'s1',student_operation:'Indagar acuerdos'},{stage_id:'s2',student_operation:'Comunicar acuerdos'}],
   ltg_strategy:{mode:'NONE',selections:[]}
  },
  sessions:[
   {session_number:1,stage_ids:['s1'],project_state_before:'Pregunta inicial',session_project_goal:'Indagar acuerdos',required_learning:['Fuentes cercanas'],pda_focus:['p1','p3'],methodology_operations:['IDENTIFICACION'],input_artifact_ids:['pregunta'],expected_output_artifact_ids:['fichas'],expected_partial_product:'Fichas de acuerdos',acceptance_criteria:['Registro de fuentes'],project_state_after:'Información registrada',terminal:false,next_session_dependency:'fichas',total_minutes:40,activities:[
    {order:1,title:'Consulta en el aula',contribution_mode:'DIRECT',contribution_rationale:'Ambos grados aportan',common_student_action:'Preguntan y registran acuerdos.',grade_participation:[{grade:1,student_action:'Dibuja un acuerdo y lo explica.',evidence:'Dibujo comentado',pda_mobilization:[{pda_id:'p1',status:'WORKED'}]},{grade:3,student_action:'Consulta, contrasta y comunica un acuerdo.',evidence:'Ficha contrastada',pda_mobilization:[{pda_id:'p3',status:'WORKED'}]}],teacher_role:'Modela la consulta.',minutes:40,resources:['cuadernos'],supports:['dictado'],input_refs:['pregunta'],output:'Fichas de acuerdos',contributes_to_artifact_ids:['fichas'],methodology_operations:['IDENTIFICACION'],functional_requirement_ids:['fr-1'],ltg_activity_ids:[],evidence:'Fichas y dibujos',assessment_criteria:['Cita una fuente']}
   ]},
   {session_number:2,stage_ids:['s2'],project_state_before:'Información registrada',session_project_goal:'Compartir los acuerdos',required_learning:['Comunicación'],pda_focus:['p1','p3'],methodology_operations:['DIFUSION'],input_artifact_ids:['fichas'],expected_output_artifact_ids:['cartel'],expected_partial_product:'Cartel común',acceptance_criteria:['Presentación al grupo'],project_state_after:'Cartel compartido',terminal:true,next_session_dependency:null,total_minutes:30,activities:[
    {order:1,title:'Presentación',contribution_mode:'DIRECT',contribution_rationale:'Aportes integrados',common_student_action:'Presentan el cartel.',grade_participation:[{grade:1,student_action:'Explica su dibujo.',evidence:'Explicación oral'},{grade:3,student_action:'Comunica sus hallazgos.',evidence:'Presentación'}],teacher_role:'Facilita turnos.',minutes:30,resources:['cartel'],supports:['guion'],input_refs:['fichas'],output:'Cartel común',contributes_to_artifact_ids:['cartel'],methodology_operations:['DIFUSION'],functional_requirement_ids:['fr-2'],ltg_activity_ids:[],evidence:'Presentación observada',assessment_criteria:['Explica y escucha']}
   ]}
  ],
  traceability:{pda:{p1:['s1','s2'],p3:['s1','s2']},methodology:{IDENTIFICACION:['s1'],DIFUSION:['s2']},artifacts:{fichas:['cartel']},functional_requirements:{'fr-1':['s1'],'fr-2':['s2']}}
 };
 const result={pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'READY_FOR_TEACHER',teacher_plan:{...projection,projection_hash:teacherProjectionHash(projection)}};
 return toTeacherPlanView({pipelineResult:result,teacherContextBinding:{projection_hash:result.teacher_plan.projection_hash,constraints_hash:'c'.repeat(64),teacher_context:{school:'Escuela multigrado',resources:['cuadernos']}}});
}

test('valid TeacherPlanView maps without semantic loss or reordering',()=>{
 const view=validView(),model=toV0124TeacherProjectionView(view);
 assert.equal(model.view_model_version,V0124_CERTIFIED_TEACHER_VIEW_VERSION);
 assert.equal(assertV0124TeacherProjectionView(model),true);
 assert.equal(model.source.projection_hash,view.source.projection_hash);
 assert.equal(model.source.view_hash,view.view_hash);
 assert.equal(model.source.approved_blueprint_hash,view.source.approved_blueprint_hash);
 assert.equal(model.source.approved_graph_hash,view.source.approved_graph_hash);
 assert.equal(model.source.constraints_hash,view.source.constraints_hash);
 assert.deepEqual(model.project,{name:view.project.name,description:view.project.description,purpose:view.project.purpose,audience_or_beneficiary:view.project.audience_or_beneficiary,use_or_destination:view.project.use_or_destination,guiding_question:view.project.guiding_question,problem_frame:view.project.problem_frame,final_outcome:view.project.final_outcome,grade_contributions:view.project.grade_contributions,project_stages:view.project.project_stages,ltg_strategy:view.project.ltg_strategy});
 assert.deepEqual(model.pda_analysis,view.project.pda_analysis);
 assert.deepEqual(model.pda_analysis.map(x=>[x.pda_id,x.grade,x.official_text]),[['p1',1,'PDA oficial primero: explica acuerdos.'],['p3',3,'PDA oficial tercero: indaga y comunica.']]);
 assert.deepEqual(model.methodology,view.project.methodology);
 assert.deepEqual(model.methodology.required_operations,['IDENTIFICACION','DIFUSION']);
 assert.deepEqual(model.sessions,view.sessions);
 assert.deepEqual(model.sessions.map(x=>x.session_number),[1,2]);
 assert.deepEqual(model.sessions[0].activities[0].grade_participation,view.sessions[0].activities[0].grade_participation);
 assert.deepEqual(model.traceability,view.traceability);
 assert.deepEqual(model.teacher_context,view.teacher_context);
 assert.equal(model.view_model_hash,certifiedTeacherViewModelHash(model));
 assert.ok(Object.isFrozen(model));
 assert.ok(!Object.hasOwn(model.sessions[0],'work_moments'));
 assert.ok(!Object.hasOwn(model.sessions[0],'project_advance'));
 assert.ok(!Object.hasOwn(model.sessions[0],'phase'));
});

test('invalid, legacy, and tampered TeacherPlanView inputs fail closed',()=>{
 assert.throws(()=>toV0124TeacherProjectionView({project:{},sessions:[]}),/TEACHER_PLAN_VIEW_TAMPERED/);
 const altered=structuredClone(validView());altered.sessions[0].activities[0].grade_participation[1].student_action='Texto cambiado';
 assert.throws(()=>toV0124TeacherProjectionView(altered),/TEACHER_PLAN_VIEW_TAMPERED/);
 const missing=structuredClone(validView());delete missing.project.pda_analysis;
 assert.throws(()=>toV0124TeacherProjectionView(missing),/TEACHER_PLAN_VIEW_TAMPERED/);
});

test('tampered view-model fails both its own hash and the original view binding',()=>{
 const model=structuredClone(toV0124TeacherProjectionView(validView()));
 model.sessions[1].activities[0].evidence='Evidencia inventada';
 assert.throws(()=>assertV0124TeacherProjectionView(model),/V0124_CERTIFIED_TEACHER_VIEW_TAMPERED/);
 model.view_model_hash=certifiedTeacherViewModelHash(model);
 assert.throws(()=>assertV0124TeacherProjectionView(model),/TEACHER_PLAN_VIEW_TAMPERED/);
});

test('same validated input yields exactly the same presentation model and hash',()=>{
 const view=validView(),first=toV0124TeacherProjectionView(view),second=toV0124TeacherProjectionView(view);
 assert.deepEqual(first,second);
 assert.equal(first.view_model_hash,second.view_model_hash);
});

test('adapter has no Project Coherence import or invocation',()=>{
 const source=readFileSync(new URL('../lib/v0124/teacher-projection-view.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/project-coherence|applyProjectCoherence|work_moments|project_advance/);
});
