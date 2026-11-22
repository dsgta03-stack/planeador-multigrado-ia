import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPipelineSourcesFromProductionRequest} from '../source-adapter.mjs';
import {runRouterPipelineShadow} from '../router-shadow.mjs';
import {createSupabaseCurriculumLookup} from '../supabase-curriculum.mjs';

function body(){return {
  grados:[1,3],
  pdas:[{pda_id:'p1',grade:1,field:'legacy',content:'legacy',pda:'legacy'},{pda_id:'p3',grade:3,field:'legacy',content:'legacy',pda:'legacy'}],
  contexto:'Escuela multigrado rural.',situacion_problema:'Mejorar acuerdos de convivencia.',sesiones:3,minutos:90,
  recursos:'RECURSO LEGACY NO AUTORIZADO',
  methodology_selection:'proyectos_comunitarios',methodology_recommendation:{recommended_id:'proyectos_comunitarios'}
};}
function tc(){return {students_by_grade:{1:8,3:6},reading_profile:'Lectura diferenciada.',writing_profile:'Escritura diferenciada.',autonomy_profile:'Autonomía diferenciada.',connectivity:'Sin internet estable.',available_resources:['cuadernos'],supports:['modelado docente'],teacher_explicit_constraints:['No usar dispositivos.']};}
function authoritative(){return {provenance:'db:test',pdas:[{pda_id:'p1',grade:1,field:'DHC',content_official:'C1',pda_official:'P1',verification_status:'Verificado'},{pda_id:'p3',grade:3,field:'DHC',content_official:'C3',pda_official:'P3',verification_status:'Verificado'}],ltg:[]};}

test('missing explicit teacher constraints fails closed before curriculum lookup',async()=>{
  let curriculumCalls=0;
  const out=await buildPipelineSourcesFromProductionRequest(body(),{curriculumLookup:async()=>{curriculumCalls++;return authoritative();}});
  assert.equal(out.status,'NEEDS_TEACHER_INPUT');
  assert.equal(curriculumCalls,0);
  assert.ok(out.missing_teacher_fields.includes('available_resources'));
  assert.ok(out.missing_teacher_fields.includes('reading_profile'));
});

test('legacy recursos never becomes available_resources',async()=>{
  const b=body();b.teacher_constraints=tc();
  const out=await buildPipelineSourcesFromProductionRequest(b,{curriculumLookup:async()=>authoritative()});
  assert.equal(out.status,'READY_FOR_PIPELINE');
  assert.deepEqual(out.sources.constraints.available_resources,['cuadernos']);
  assert.equal(out.analysis.normalized.legacy_resource_text,'RECURSO LEGACY NO AUTORIZADO');
  assert.ok(!out.sources.constraints.available_resources.includes('RECURSO LEGACY NO AUTORIZADO'));
});

test('no NOT_PROVIDED or UNKNOWN defaults are injected for omitted teacher fields',async()=>{
  const b=body();b.teacher_constraints={...tc()};delete b.teacher_constraints.reading_profile;delete b.teacher_constraints.connectivity;
  const out=await buildPipelineSourcesFromProductionRequest(b,{curriculumLookup:async()=>authoritative()});
  assert.equal(out.status,'NEEDS_TEACHER_INPUT');
  assert.deepEqual(out.missing_teacher_fields.filter(x=>['reading_profile','connectivity'].includes(x)),['reading_profile','connectivity']);
  assert.equal(out.analysis.normalized.teacher_constraints.reading_profile,null);
  assert.equal(out.analysis.normalized.teacher_constraints.connectivity,null);
});

test('router does not invoke pipeline when teacher input is incomplete',async()=>{
  let curriculumCalls=0,pipelineCalls=0;
  const result=await runRouterPipelineShadow({body:body(),curriculumLookup:async()=>{curriculumCalls++;return authoritative();},pipelineRunner:async()=>{pipelineCalls++;return {status:'READY_FOR_TEACHER'};}});
  assert.equal(result.status,'NEEDS_TEACHER_INPUT');
  assert.equal(curriculumCalls,0);
  assert.equal(pipelineCalls,0);
  assert.equal(result.eligible,false);
});

test('router preserves pipeline rejection status and does not promote it',async()=>{
  const b=body();b.teacher_constraints=tc();
  const result=await runRouterPipelineShadow({body:b,curriculumLookup:async()=>authoritative(),pipelineRunner:async()=>({pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'SESSION_GRAPH_REJECTED',blueprint_approval:{approved_blueprint_hash:'b'.repeat(64)},session_approval:null,repair_count:1})});
  assert.equal(result.status,'SESSION_GRAPH_REJECTED');
  assert.equal(result.graph_hash,null);
  assert.equal(result.repair_count,1);
});

test('router forwards only exact immutable source artifacts to pipeline',async()=>{
  const b=body();b.teacher_constraints=tc();
  let seen;
  const result=await runRouterPipelineShadow({body:b,curriculumLookup:async()=>authoritative(),pipelineRunner:async sources=>{seen=sources;assert.deepEqual(Object.keys(sources).sort(),['constraints','curriculum','methodology']);assert.ok(Object.isFrozen(sources));assert.ok(Object.isFrozen(sources.constraints));return {pipeline_version:'MULTIPLAN_SHADOW_PIPELINE_V1',status:'READY_FOR_TEACHER',blueprint_approval:{approved_blueprint_hash:'a'.repeat(64)},session_approval:{approved_graph_hash:'c'.repeat(64)},repair_count:0};}});
  assert.ok(seen);
  assert.equal(result.status,'READY_FOR_TEACHER');
  assert.equal(result.blueprint_hash,'a'.repeat(64));
  assert.equal(result.graph_hash,'c'.repeat(64));
});

test('Supabase lookup keeps only active verified authoritative rows and uses user bearer auth',async()=>{
  const calls=[];
  const fetchImpl=async (url,opts)=>{calls.push({url:String(url),opts});const u=String(url);let data=[];
    if(u.includes('/pda?'))data=[{pda_id:'p1',grade:1,field:'DHC',content_official:'C1',pda_official:'P1',verification_status:'Verificado',active:true},{pda_id:'pX',grade:1,field:'X',content_official:'X',pda_official:'X',verification_status:'Pendiente',active:true}];
    else if(u.includes('/project_pda?'))data=[{project_id:'pr1',pda_id:'p1',verification_type:'Verificado',active:true},{project_id:'pr2',pda_id:'p1',verification_type:'Pendiente',active:true}];
    else if(u.includes('/projects_ltg?'))data=[{project_id:'pr1',grade:1,book:'Libro',scenario:'Aula',name:'Proyecto',start_page:10,end_page:12,related_contents:'Contenido relacionado',purpose:'Investigar una situación del entorno.',central_product:'Modelo explicativo.',verification_status:'Verificado',active:true}];
    else if(u.includes('/ltg_project_activities?'))data=[{id:'a1',project_id:'pr1',activity_order:1,page_start:10,page_end:11,activity_type:'indagacion',title:'Exploramos',activity_summary:'Actividad',organization:'Equipos',materials:'Papel y lápiz',guiding_questions:'¿Qué observamos?',evidence_or_record:'Registro de observaciones',product_contribution:'Aporta evidencia al modelo explicativo.',semantic_tags:['indagacion','observacion'],verification_status:'verified'}];
    return {ok:true,status:200,json:async()=>data};
  };
  const lookup=createSupabaseCurriculumLookup({url:'https://example.supabase.co',publishableKey:'pk',authorization:'Bearer user-token',fetchImpl});
  const out=await lookup({pda_ids:['p1'],grades:[1]});
  assert.deepEqual(out.pdas.map(x=>x.pda_id),['p1']);
  assert.deepEqual(out.ltg.map(x=>x.project_id),['pr1']);
  assert.deepEqual(out.ltg[0].verified_pda_links,['p1']);
  assert.deepEqual(out.ltg[0].verified_activities.map(x=>x.activity_id),['a1']);
  assert.equal(out.ltg[0].related_contents,'Contenido relacionado');
  assert.equal(out.ltg[0].purpose,'Investigar una situaci\u00f3n del entorno.');
  assert.equal(out.ltg[0].central_product,'Modelo explicativo.');
  assert.equal(out.ltg[0].verified_activities[0].activity_type,'indagacion');
  assert.equal(out.ltg[0].verified_activities[0].title,'Exploramos');
  assert.equal(out.ltg[0].verified_activities[0].organization,'Equipos');
  assert.equal(out.ltg[0].verified_activities[0].materials,'Papel y l\u00e1piz');
  assert.equal(out.ltg[0].verified_activities[0].guiding_questions,'\u00bfQu\u00e9 observamos?');
  assert.equal(out.ltg[0].verified_activities[0].evidence_or_record,'Registro de observaciones');
  assert.equal(out.ltg[0].verified_activities[0].product_contribution,'Aporta evidencia al modelo explicativo.');
  assert.deepEqual(out.ltg[0].verified_activities[0].semantic_tags,['indagacion','observacion']);
  const projectCall=calls.find(c=>c.url.includes('/projects_ltg?'));
  const activityCall=calls.find(c=>c.url.includes('/ltg_project_activities?'));
  assert.ok(projectCall);
  assert.ok(activityCall);
  const projectSelect=new URL(projectCall.url).searchParams.get('select');
  const activitySelect=new URL(activityCall.url).searchParams.get('select');
  for(const field of ['related_contents','purpose','central_product'])assert.ok(projectSelect.split(',').includes(field));
  for(const field of ['activity_type','title','organization','materials','guiding_questions','evidence_or_record','product_contribution','semantic_tags'])assert.ok(activitySelect.split(',').includes(field));
  assert.ok(calls.every(c=>c.opts.headers.authorization==='Bearer user-token'));
});

test('Supabase lookup rejects unsafe curriculum identifiers before any request',async()=>{
  let calls=0;
  const lookup=createSupabaseCurriculumLookup({url:'https://example.supabase.co',publishableKey:'pk',authorization:'Bearer user-token',fetchImpl:async()=>{calls++;throw Error('should not call');}});
  await assert.rejects(()=>lookup({pda_ids:['p1);drop table pda;--'],grades:[1]}),/UNSAFE_CURRICULUM_ID/);
  assert.equal(calls,0);
});
