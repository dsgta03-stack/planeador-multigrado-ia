import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runCertifiedV0124Pipeline} from '../lib/v0124/certified-pipeline.mjs';
import {buildPipelineSourcesFromProductionRequest} from '../shadow/router-integration-v1/source-adapter.mjs';
import {teacherProjectionHash} from '../shadow/pipeline-v1/projection.mjs';
import {assertRenderablePresentationEnvelope} from '../shadow/presentation-v1/presentation-gateway.mjs';
import {applyProjectCoherence} from '../lib/v0124/project-coherence.mjs';

const body=()=>({
 grados:[1],pdas:[{pda_id:'p1',grade:1,pda:'Texto legacy'}],
 contexto:'Escuela multigrado.',situacion_problema:'Comprender nuestros acuerdos.',
 sesiones:1,minutos:30,recursos:'Recurso legacy no autorizado',
 methodology_selection:'proyectos_comunitarios',
 teacher_constraints:{students_by_grade:{1:4},reading_profile:'Lectura inicial.',writing_profile:'Dictado y dibujo.',autonomy_profile:'Apoyo docente.',connectivity:'Sin internet.',available_resources:['cuadernos'],supports:['modelado docente'],teacher_explicit_constraints:['Sin compras.']}
});
const curriculum=()=>({provenance:'curriculum:test-local',pdas:[{pda_id:'p1',grade:1,field:'DHC',content_official:'Contenido oficial',pda_official:'PDA oficial',verification_status:'Verificado'}],ltg:[]});
const lookup=async()=>curriculum();
const createdAt='2026-09-28T19:00:00.000Z';

function readyResult(){
 const projection={
  projection_version:'TEACHER_PLAN_PROJECTION_V1',status:'READY_FOR_TEACHER',
  source:{blueprint_id:'bp1',blueprint_revision:1,approved_blueprint_hash:'a'.repeat(64),graph_id:'g1',graph_revision:1,approved_graph_hash:'b'.repeat(64)},
  project:{
   problem_frame:{original_problem:'Comprender nuestros acuerdos.',pedagogical_focus:'Convivencia'},
   guiding_question:{question:'¿Cómo nos organizamos?'},
   methodology:{selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION']},
   final_outcome:{name:'Cartel de acuerdos',description:'Cartel común',purpose:'Explicar acuerdos',audience_or_beneficiary:'Grupo',use_or_destination:'Aula'},
   pda_analysis:[{pda_id:'p1',grade:1,official_text:'PDA oficial'}],
   grade_contributions:[{grade:1,pda_ids:['p1']}],project_stages:[{stage_id:'s1'}],ltg_strategy:{mode:'NONE',selections:[]}
  },
  sessions:[{session_number:1,stage_ids:['s1'],project_state_before:'Inicio',session_project_goal:'Crear el cartel',required_learning:['Acuerdos'],pda_focus:['p1'],methodology_operations:['IDENTIFICACION'],input_artifact_ids:['contexto'],expected_output_artifact_ids:['cartel'],expected_partial_product:'Cartel',acceptance_criteria:['Explica un acuerdo'],project_state_after:'Cartel listo',terminal:true,next_session_dependency:null,total_minutes:30,activities:[]}],
  traceability:{pda:{},methodology:{},artifacts:{},functional_requirements:{}}
 };
 return {pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'READY_FOR_TEACHER',repair_count:0,teacher_plan:{...projection,projection_hash:teacherProjectionHash(projection)}};
}

test('A: incomplete teacher input stops before lookup and runner',async()=>{
 const input=body();delete input.teacher_constraints.reading_profile;
 let lookupCalls=0,runnerCalls=0;
 const out=await runCertifiedV0124Pipeline({body:input,curriculumLookup:async()=>{lookupCalls++;return curriculum()},pipelineRunner:async()=>{runnerCalls++;return readyResult()},createdAt});
 assert.equal(out.status,'NEEDS_TEACHER_INPUT');
 assert.ok(out.missing_teacher_fields.includes('reading_profile'));
 assert.equal(lookupCalls,0);assert.equal(runnerCalls,0);
 assert.equal(out.renderable,false);assert.equal(out.teacher_plan_view,null);assert.equal(out.final_snapshot,null);
});

for(const status of ['BLUEPRINT_NOT_APPROVED','SESSION_GRAPH_REJECTED','SESSION_REVIEW_UNAVAILABLE']){
 test(`B-D: ${status} is preserved without a teacher plan`,async()=>{
  const result={pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status,repair_count:0,teacher_plan:{unexpected:'partial'}};
  let seen;
  const out=await runCertifiedV0124Pipeline({body:body(),curriculumLookup:lookup,pipelineRunner:async(sources,options)=>{seen={sources,options};return result},authorization:'Bearer local-test',createdAt});
  assert.deepEqual(Object.keys(seen.sources).sort(),['constraints','curriculum','methodology']);
  assert.ok(Object.isFrozen(seen.sources));
  assert.equal(seen.options.authorization,'Bearer local-test');
  assert.equal(out.status,status);assert.equal(out.renderable,false);
  assert.equal(out.teacher_plan_view,null);assert.equal(out.final_snapshot,null);
 });
}

test('E: valid READY goes through the gateway with projection and approval hashes intact',async()=>{
 const input=body(),result=readyResult();
 const prepared=await buildPipelineSourcesFromProductionRequest(input,{curriculumLookup:lookup});
 const binding={projection_hash:result.teacher_plan.projection_hash,constraints_hash:prepared.sources.constraints.constraints_hash,teacher_context:{school:'Escuela multigrado.'}};
 const evidence={request_id:'local-test-request',model:'stub'};
 const out=await runCertifiedV0124Pipeline({body:input,curriculumLookup:lookup,pipelineRunner:async sources=>{
  assert.deepEqual(Object.keys(sources).sort(),['constraints','curriculum','methodology']);
  assert.deepEqual(sources.constraints.selected_pda_ids,['p1']);
  return result;
 },teacherContextBinding:binding,pipelineEvidence:evidence,createdAt});
 assert.equal(out.status,'READY_FOR_TEACHER');assert.equal(out.renderable,true);
 assert.equal(assertRenderablePresentationEnvelope(out),true);
 assert.equal(out.teacher_plan_view.source.projection_hash,result.teacher_plan.projection_hash);
 assert.equal(out.final_snapshot.source.projection_hash,result.teacher_plan.projection_hash);
 assert.equal(out.teacher_plan_view.source.approved_blueprint_hash,'a'.repeat(64));
 assert.equal(out.final_snapshot.source.approved_graph_hash,'b'.repeat(64));
 assert.deepEqual(out.final_snapshot.pipeline_evidence,evidence);
});

test('F: tampered projection never produces a visible plan',async()=>{
 const result=readyResult();result.teacher_plan.projection_hash='0'.repeat(64);
 const out=await runCertifiedV0124Pipeline({body:body(),curriculumLookup:lookup,pipelineRunner:async()=>result,createdAt});
 assert.equal(out.renderable,false);assert.equal(out.teacher_plan_view,null);assert.equal(out.final_snapshot,null);
 assert.equal(out.status,'SHADOW_ERROR');assert.equal(out.error.code,'TEACHER_PROJECTION_INVALID');
});

test('binding to different TeacherConstraints fails closed',async()=>{
 const result=readyResult();
 const binding={projection_hash:result.teacher_plan.projection_hash,constraints_hash:'c'.repeat(64),teacher_context:{school:'Otra escuela'}};
 const out=await runCertifiedV0124Pipeline({body:body(),curriculumLookup:lookup,pipelineRunner:async()=>result,teacherContextBinding:binding,createdAt});
 assert.equal(out.status,'SHADOW_ERROR');assert.equal(out.renderable,false);
 assert.equal(out.teacher_plan_view,null);assert.equal(out.final_snapshot,null);
 assert.equal(out.error.code,'TEACHER_CONTEXT_CONSTRAINTS_HASH_MISMATCH');
});

test('G: new boundary has no Project Coherence dependency and legacy behavior is intact',()=>{
 const source=readFileSync(new URL('../lib/v0124/certified-pipeline.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/project-coherence|applyProjectCoherence/);
 const legacy={methodology_engine:{integrated_project:{title:'Legacy',collective_product_or_service:'Mural',grade_contributions:[{grade:1,contribution:'Dibujo',evidence:'Lámina'}]}},sessions:[{session_number:1,purpose:'Hacer un mural'}]};
 const out=applyProjectCoherence(legacy);
 assert.equal(out.status,'PASS');assert.equal(out.plan.project.version,'PROJECT-COHERENCE-V1');
});
