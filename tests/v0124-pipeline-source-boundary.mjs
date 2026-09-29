import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPipelineSourcesFromProductionRequest} from '../shadow/router-integration-v1/source-adapter.mjs';
import {runRouterPipelineShadow} from '../shadow/router-integration-v1/router-shadow.mjs';
import {createSupabaseCurriculumLookup} from '../shadow/router-integration-v1/supabase-curriculum.mjs';
import {applyProjectCoherence} from '../lib/v0124/project-coherence.mjs';

const teacherConstraints=()=>({
 students_by_grade:{1:4,3:2},
 reading_profile:'Lectura inicial y funcional.',
 writing_profile:'Escritura emergente y textos breves.',
 autonomy_profile:'Apoyo docente y entre pares.',
 connectivity:'Sin internet.',
 available_resources:['cuadernos'],
 supports:['modelado docente'],
 teacher_explicit_constraints:['Sin compras.']
});

const request=()=>({
 grados:[1,3],
 pdas:[
  {pda_id:'p1',grade:1,pda:'TEXTO LEGACY NO AUTORITATIVO'},
  {pda_id:'p3',grade:3,pda:'OTRO TEXTO LEGACY'}
 ],
 contexto:'Escuela primaria multigrado.',
 situacion_problema:'Mejorar los acuerdos de convivencia.',
 sesiones:3,
 minutos:90,
 recursos:'CÁMARA LEGACY NO AUTORIZADA',
 methodology_selection:'proyectos_comunitarios',
 methodology_recommendation:{recommended_id:'steam'},
 teacher_constraints:teacherConstraints()
});

const authoritative=()=>({
 provenance:'curriculum:test-local',
 pdas:[
  {pda_id:'p1',grade:1,field:'DHC',content_official:'Contenido 1',pda_official:'PDA OFICIAL 1',verification_status:'Verificado'},
  {pda_id:'p3',grade:3,field:'DHC',content_official:'Contenido 3',pda_official:'PDA OFICIAL 3',verification_status:'Verificado'}
 ],
 ltg:[]
});

test('new pipeline rejects zero PDA before curriculum lookup or pipeline execution',async()=>{
 const body=request();body.pdas=[];
 let lookups=0,runs=0;
 const curriculumLookup=async()=>{lookups++;return authoritative()};
 await assert.rejects(
  buildPipelineSourcesFromProductionRequest(body,{curriculumLookup}),
  /LEGACY_REQUEST_MISSING_PDAS/
 );
 const routed=await runRouterPipelineShadow({body,curriculumLookup,pipelineRunner:async()=>{runs++;return {status:'READY_FOR_TEACHER'}}});
 assert.equal(routed.status,'SHADOW_ERROR');
 assert.equal(routed.eligible,false);
 assert.equal(routed.error.code,'ERROR');
 assert.match(routed.error.message,/LEGACY_REQUEST_MISSING_PDAS/);
 assert.equal(lookups,0);
 assert.equal(runs,0);
});

test('incomplete TeacherConstraints require teacher input without curriculum lookup',async()=>{
 const body=request();delete body.teacher_constraints.reading_profile;
 let lookups=0;
 const out=await buildPipelineSourcesFromProductionRequest(body,{curriculumLookup:async()=>{lookups++;return authoritative()}});
 assert.equal(out.status,'NEEDS_TEACHER_INPUT');
 assert.ok(out.missing_teacher_fields.includes('reading_profile'));
 assert.equal(lookups,0);
});

test('official PDA and teacher methodology are authoritative; legacy recursos stay untrusted',async()=>{
 const body=request();let lookups=0;
 const out=await buildPipelineSourcesFromProductionRequest(body,{curriculumLookup:async()=>{lookups++;return authoritative()}});
 assert.equal(lookups,1);
 assert.equal(out.status,'READY_FOR_PIPELINE');
 assert.deepEqual(out.sources.curriculum.pdas.map(p=>p.pda_official),['PDA OFICIAL 1','PDA OFICIAL 3']);
 assert.notEqual(out.sources.curriculum.pdas[0].pda_official,body.pdas[0].pda);
 assert.deepEqual(out.sources.constraints.available_resources,['cuadernos']);
 assert.equal(out.analysis.normalized.legacy_resource_text,body.recursos);
 assert.equal(out.sources.methodology.selected_id,'proyectos_comunitarios');
 assert.equal(out.sources.methodology.recommended_id,'steam');
 assert.equal(out.sources.methodology.selection_source,'TEACHER');
});

test('missing or wrong-grade authoritative PDA blocks source construction',async()=>{
 const body=request();
 await assert.rejects(
  buildPipelineSourcesFromProductionRequest(body,{curriculumLookup:async()=>({...authoritative(),pdas:authoritative().pdas.slice(0,1)})}),
  /AUTHORITATIVE_CURRICULUM_MISSING:p3/
 );
 const wrong=authoritative();wrong.pdas[1].grade=2;
 await assert.rejects(
  buildPipelineSourcesFromProductionRequest(body,{curriculumLookup:async()=>wrong}),
  /AUTHORITATIVE_CURRICULUM_GRADE_MISMATCH:p3/
 );
});

test('curriculum lookup uses only simulated fetch and missing verified PDA remains blocked',async()=>{
 let calls=0;
 const lookup=createSupabaseCurriculumLookup({
  url:'https://example.invalid',publishableKey:'local-test-key',authorization:'Bearer local-test-user',
  fetchImpl:async url=>{
   calls++;
   const rows=String(url).includes('/pda?')?[{...authoritative().pdas[0],active:true}]:[];
   return {ok:true,status:200,json:async()=>rows};
  }
 });
 await assert.rejects(
  buildPipelineSourcesFromProductionRequest(request(),{curriculumLookup:lookup}),
  /AUTHORITATIVE_CURRICULUM_MISSING:p3/
 );
 assert.ok(calls>0);
});

test('legacy Project Coherence retains its existing independent behavior',()=>{
 const legacy={methodology_engine:{integrated_project:{title:'Proyecto legacy',collective_product_or_service:'Mural',grade_contributions:[{grade:1,contribution:'Dibujo',evidence:'Lámina'}]}},sessions:[{session_number:1,purpose:'Crear un mural'}]};
 const out=applyProjectCoherence(legacy);
 assert.equal(out.status,'PASS');
 assert.equal(out.plan.project.version,'PROJECT-COHERENCE-V1');
 assert.equal(out.plan.project.final_product,'Mural');
 assert.equal(out.plan.project_sequence.length,1);
});
