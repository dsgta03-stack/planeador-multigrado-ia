import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCertifiedPlanRoute,buildCertifiedPlanHttpResponse,CERTIFIED_PLAN_HTTP_STATUS} from '../lib/v0124/certified-plan-route.mjs';
import {buildPipelineSourcesFromProductionRequest} from '../shadow/router-integration-v1/source-adapter.mjs';
import {teacherProjectionHash} from '../shadow/pipeline-v1/projection.mjs';
import {buildTeacherPresentationEnvelope} from '../shadow/presentation-v1/presentation-gateway.mjs';
import {toV0124TeacherProjectionView,certifiedTeacherViewModelHash,assertV0124TeacherProjectionView} from '../lib/v0124/teacher-projection-view.mjs';

const request=()=>({
 grados:[1],pdas:[{pda_id:'p1',grade:1,pda:'texto no autoritativo'}],
 contexto:'Escuela multigrado.',situacion_problema:'Comprender acuerdos.',
 sesiones:1,minutos:30,metodologia:'proyectos_comunitarios',
 teacher_constraints:{students_by_grade:{1:4},reading_profile:'Lectura inicial.',writing_profile:'Dibujo y dictado.',autonomy_profile:'Apoyo docente.',connectivity:'Sin internet.',available_resources:['cuadernos'],supports:['modelado docente'],teacher_explicit_constraints:['Sin compras.']}
});
const authoritative=()=>({provenance:'curriculum:local',pdas:[{pda_id:'p1',grade:1,field:'DHC',content_official:'Contenido',pda_official:'PDA oficial',verification_status:'Verificado'}],ltg:[]});
const lookup=async()=>authoritative();
const createdAt='2026-09-28T19:30:00.000Z';

function readyResult(){
 const projection={
  projection_version:'TEACHER_PLAN_PROJECTION_V1',status:'READY_FOR_TEACHER',
  source:{blueprint_id:'bp-1',blueprint_revision:1,approved_blueprint_hash:'a'.repeat(64),graph_id:'g-1',graph_revision:1,approved_graph_hash:'b'.repeat(64)},
  project:{problem_frame:{original_problem:'Comprender acuerdos.',pedagogical_focus:'Convivencia'},guiding_question:{question:'¿Qué acuerdos compartimos?'},methodology:{selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']},final_outcome:{name:'Cartel común',description:'Cartel de acuerdos',purpose:'Compartir acuerdos',audience_or_beneficiary:'Grupo',use_or_destination:'Aula'},pda_analysis:[{pda_id:'p1',grade:1,official_text:'PDA oficial'}],grade_contributions:[{grade:1,pda_ids:['p1']}],project_stages:[{stage_id:'stage-1'}],ltg_strategy:{mode:'NONE',selections:[]}},
  sessions:[{session_number:1,stage_ids:['stage-1'],project_state_before:'Inicio',session_project_goal:'Crear un cartel',required_learning:['Acuerdos'],pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],input_artifact_ids:['pregunta'],expected_output_artifact_ids:['cartel'],expected_partial_product:'Cartel',acceptance_criteria:['Explica un acuerdo'],project_state_after:'Cartel listo',terminal:true,next_session_dependency:null,total_minutes:30,activities:[{order:1,title:'Explicar acuerdo',contribution_mode:'DIRECT',contribution_rationale:'Aporte al cartel',common_student_action:'Explica un acuerdo.',grade_participation:[{grade:1,student_action:'Dibuja y explica un acuerdo.',evidence:'Dibujo comentado'}],teacher_role:'Modela.',minutes:30,resources:['cuadernos'],supports:['dictado'],input_refs:['pregunta'],output:'Cartel',contributes_to_artifact_ids:['cartel'],methodology_operations:['IDENTIFICACION'],functional_requirement_ids:[],ltg_activity_ids:[],evidence:'Explicación',assessment_criteria:['Explica su dibujo']}]}],
  traceability:{pda:{},methodology:{},artifacts:{},functional_requirements:{}}
 };
 return {pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'READY_FOR_TEACHER',repair_count:0,teacher_plan:{...projection,projection_hash:teacherProjectionHash(projection)}};
}
const routeFor=result=>createCertifiedPlanRoute({curriculumLookup:lookup,pipelineRunner:async()=>result});

test('NEEDS_TEACHER_INPUT avoids curriculum and pipeline and has no plan or snapshot',async()=>{
 const input=request();delete input.teacher_constraints.reading_profile;
 let lookupCalls=0,runnerCalls=0;
 const route=createCertifiedPlanRoute({curriculumLookup:async()=>{lookupCalls++;return authoritative()},pipelineRunner:async()=>{runnerCalls++;return readyResult()}});
 const response=await route({body:input,createdAt});
 assert.equal(response.http_status,422);assert.equal(response.body.status,'NEEDS_TEACHER_INPUT');
 assert.equal(response.body.renderable,false);assert.equal(response.body.view_model,null);
 assert.ok(response.body.descriptor.title);assert.equal(lookupCalls,0);assert.equal(runnerCalls,0);
 assert.ok(!Object.hasOwn(response.body,'snapshot'));
});

for(const [status,http] of Object.entries(CERTIFIED_PLAN_HTTP_STATUS).filter(([status])=>status!=='READY_FOR_TEACHER'&&status!=='NEEDS_TEACHER_INPUT')){
 test(`${status} remains non-renderable with logical HTTP ${http}`,async()=>{
  const response=await routeFor({status,repair_count:1,teacher_plan:{private:'partial'}})({body:request(),createdAt});
  assert.equal(response.http_status,http);assert.equal(response.body.status,status);
  assert.equal(response.body.renderable,false);assert.equal(response.body.view_model,null);
  assert.equal(response.body.repair_count,1);assert.ok(response.body.descriptor.kind);
  assert.ok(!Object.hasOwn(response.body,'snapshot'));
 });
}

test('valid READY returns only the certified view-model with all source hashes',async()=>{
 const result=readyResult(),prepared=await buildPipelineSourcesFromProductionRequest(request(),{curriculumLookup:lookup});
 const binding={projection_hash:result.teacher_plan.projection_hash,constraints_hash:prepared.sources.constraints.constraints_hash,teacher_context:{school:'Escuela multigrado.'}};
 const route=routeFor(result);
 const response=await route({body:request(),authorization:'Bearer do-not-return',teacherContextBinding:binding,pipelineEvidence:{prompt:'do-not-return',token:'do-not-return'},createdAt});
 assert.equal(response.http_status,200);assert.deepEqual(Object.keys(response.body),['pipeline_mode','status','renderable','view_model','descriptor','repair_count']);
 assert.equal(response.body.pipeline_mode,'CERTIFIED_R2');assert.equal(response.body.status,'READY_FOR_TEACHER');assert.equal(response.body.renderable,true);
 assert.equal(response.body.view_model.view_model_version,'V0124_CERTIFIED_TEACHER_VIEW_V1');
 assert.equal(assertV0124TeacherProjectionView(response.body.view_model),true);
 assert.equal(response.body.view_model.source.projection_hash,result.teacher_plan.projection_hash);
 assert.equal(response.body.view_model.source.approved_blueprint_hash,'a'.repeat(64));
 assert.equal(response.body.view_model.source.approved_graph_hash,'b'.repeat(64));
 assert.equal(response.body.view_model.source.constraints_hash,binding.constraints_hash);
 assert.equal(response.body.repair_count,0);
 const serialized=JSON.stringify(response.body);assert.ok(!serialized.includes('do-not-return'));
 assert.ok(!Object.hasOwn(response.body,'snapshot'));
});

test('tampered TeacherPlanView in an envelope is rejected even with READY status',()=>{
 const envelope=structuredClone(buildTeacherPresentationEnvelope({pipelineResult:readyResult(),createdAt}));
 envelope.teacher_plan_view.sessions[0].activities[0].common_student_action='Acción alterada';
 const response=buildCertifiedPlanHttpResponse(envelope);
 assert.equal(response.http_status,503);assert.equal(response.body.status,'SHADOW_ERROR');
 assert.equal(response.body.renderable,false);assert.equal(response.body.view_model,null);
});

test('mismatched snapshot source hashes cannot become a READY HTTP response',()=>{
 const envelope=structuredClone(buildTeacherPresentationEnvelope({pipelineResult:readyResult(),createdAt}));
 envelope.final_snapshot.source.approved_graph_hash='f'.repeat(64);
 const response=buildCertifiedPlanHttpResponse(envelope);
 assert.equal(response.http_status,503);assert.equal(response.body.status,'SHADOW_ERROR');
 assert.equal(response.body.renderable,false);assert.equal(response.body.view_model,null);
});

test('tampered view-model is rejected by the HTTP boundary',()=>{
 const envelope=buildTeacherPresentationEnvelope({pipelineResult:readyResult(),createdAt});
 const response=buildCertifiedPlanHttpResponse(envelope,{viewModelFactory:view=>{
  const model=structuredClone(toV0124TeacherProjectionView(view));
  model.sessions[0].activities[0].output='Producto fabricado';
  model.view_model_hash=certifiedTeacherViewModelHash(model);
  return model;
 }});
 assert.equal(response.http_status,503);assert.equal(response.body.status,'SHADOW_ERROR');
 assert.equal(response.body.view_model,null);assert.equal(response.body.renderable,false);
});

test('READY without a valid renderable envelope cannot return 200',()=>{
 for(const envelope of [{status:'READY_FOR_TEACHER',renderable:false},{status:'READY_FOR_TEACHER',renderable:true,teacher_plan_view:null,final_snapshot:null}]){
  const response=buildCertifiedPlanHttpResponse(envelope);
  assert.equal(response.http_status,503);assert.equal(response.body.status,'SHADOW_ERROR');assert.equal(response.body.view_model,null);
 }
});

test('unknown status fails closed without a visible plan',async()=>{
 const response=await routeFor({status:'FUTURE_UNRECOGNIZED',teacher_plan:readyResult().teacher_plan})({body:request(),createdAt});
 assert.equal(response.http_status,500);assert.equal(response.body.status,'FUTURE_UNRECOGNIZED');
 assert.equal(response.body.renderable,false);assert.equal(response.body.view_model,null);
 assert.equal(response.body.descriptor.kind,'error');
});

test('the same inputs produce the same semantic HTTP body',async()=>{
 const route=routeFor(readyResult());
 const args={body:request(),createdAt};
 const first=await route(args),second=await route(args);
 assert.equal(first.http_status,200);assert.deepEqual(first,second);
});

test('HTTP boundary has no legacy or real provider dependency',()=>{
 const source=readFileSync(new URL('../lib/v0124/certified-plan-route.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/project-coherence|history-fidelity|review-cache|docx-export|\.\/ui\.mjs|session-provider|provider\.mjs/);
});
