import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BPS} from '../../project-blueprint-v1/catalog.mjs';
import {sourceBinding} from '../../project-blueprint-v1/contracts.mjs';
import {generateShadow} from '../../project-blueprint-v1/shadow.mjs';
import {SGS} from '../../session-graph-v1/catalog.mjs';
import {runShadowPipeline} from '../../pipeline-v1/pipeline.mjs';
import {createSupabaseCurriculumLookup} from '../supabase-curriculum.mjs';
import {runRouterPipelineShadow} from '../router-shadow.mjs';

const FIXTURE=JSON.parse(readFileSync(new URL('../../project-blueprint-v1/fixtures/PB-010.json',import.meta.url),'utf8'));
const PDA1='F3-DHC-1-010',PDA3='F4-DHC-3-001';

// Captured 2026-09-24 from the authoritative Supabase curriculum store.
// This is curriculum-only data; no user records are embedded in this test.
const SUPABASE_ROWS=Object.freeze({
 pda:[
  {pda_id:PDA1,grade:1,field:'De lo Humano y lo Comunitario',content_official:'Construcción del proyecto de vida.',pda_official:'Explica situaciones cotidianas que se presentan en la escuela y la casa, con la intención de proponer acuerdos que generen una mejor convivencia.',verification_status:'Verificado',active:true},
  {pda_id:PDA3,grade:3,field:'De lo Humano y lo Comunitario',content_official:'La comunidad como el espacio en el que se vive y se encuentra la escuela.',pda_official:'Indaga acerca de ideas, conocimientos, prácticas culturales, formas de organización y acuerdos familiares, escolares y comunitarios, para compartir su importancia en la socialización.',verification_status:'Verificado',active:true}
 ],
 project_pda:[{project_id:'F3-LTG-1-ESC-007',pda_id:PDA1,verification_type:'Verificado',active:true}],
 projects_ltg:[{project_id:'F3-LTG-1-ESC-007',grade:1,book:'Proyectos Escolares',scenario:'Escolar',name:'Frases y expresiones de cortesía',start_page:'82',end_page:'91',verification_status:'Verificado',active:true}],
 ltg_project_activities:[
  {id:1692,project_id:'F3-LTG-1-ESC-007',activity_order:1,page_start:82,page_end:86,activity_summary:'Momento «Identificamos y recuperamos» del proyecto «Frases y expresiones de cortesía», delimitado conforme a los encabezados y páginas impresas del Libro de Texto Gratuito.',verification_status:'verified'},
  {id:1693,project_id:'F3-LTG-1-ESC-007',activity_order:2,page_start:86,page_end:87,activity_summary:'Momento «Planificamos» del proyecto «Frases y expresiones de cortesía», delimitado conforme a los encabezados y páginas impresas del Libro de Texto Gratuito.',verification_status:'verified'},
  {id:1694,project_id:'F3-LTG-1-ESC-007',activity_order:3,page_start:87,page_end:87,activity_summary:'Momento «Nos acercamos» del proyecto «Frases y expresiones de cortesía», delimitado conforme a los encabezados y páginas impresas del Libro de Texto Gratuito.',verification_status:'verified'},
  {id:1695,project_id:'F3-LTG-1-ESC-007',activity_order:4,page_start:87,page_end:90,activity_summary:'Momento «Vamos y volvemos / Reorientamos» del proyecto «Frases y expresiones de cortesía», delimitado conforme a los encabezados y páginas impresas del Libro de Texto Gratuito.',verification_status:'verified'},
  {id:1696,project_id:'F3-LTG-1-ESC-007',activity_order:5,page_start:90,page_end:91,activity_summary:'Momento «Difundimos y consideramos» del proyecto «Frases y expresiones de cortesía», delimitado conforme a los encabezados y páginas impresas del Libro de Texto Gratuito.',verification_status:'verified'},
  {id:1697,project_id:'F3-LTG-1-ESC-007',activity_order:6,page_start:91,page_end:91,activity_summary:'Momento «Avanzamos» del proyecto «Frases y expresiones de cortesía», delimitado conforme a los encabezados y páginas impresas del Libro de Texto Gratuito.',verification_status:'verified'}
 ]
});

function completeRequest(){return {
 grados:[1,3],
 pdas:[
  {pda_id:PDA1,grade:1,field:'LEGACY NO AUTORITATIVO',content:'LEGACY NO AUTORITATIVO',pda:'LEGACY NO AUTORITATIVO'},
  {pda_id:PDA3,grade:3,field:'LEGACY NO AUTORITATIVO',content:'LEGACY NO AUTORITATIVO',pda:'LEGACY NO AUTORITATIVO'}
 ],
 contexto:FIXTURE.input.constraints.original_context,
 situacion_problema:FIXTURE.input.constraints.original_problem,
 sesiones:3,
 minutos:90,
 recursos:'LEGACY_RESOURCE_MUST_NOT_BECOME_AUTHORIZED',
 methodology_selection:'abp',
 teacher_constraints:{
  students_by_grade:{1:5,3:5},
  reading_profile:'Lectura inicial en primero; tercero lee textos breves con apoyo.',
  writing_profile:'Primero usa dibujos y dictado; tercero registros breves.',
  autonomy_profile:'Baja; requiere consignas visuales y apoyo entre pares.',
  connectivity:'SIN_INTERNET',
  available_resources:['papel reutilizado','lápices','colores','mesas','aula','patio techado'],
  supports:['modelado docente','apoyo entre pares'],
  teacher_explicit_constraints:['Sin salir de la escuela','No pedir compras']
 }
};}

function fakeSupabase(){
 const calls=[];
 const fetchImpl=async(input,init={})=>{
  const u=input instanceof URL?input:new URL(String(input));
  const table=u.pathname.split('/').filter(Boolean).at(-1);
  calls.push({table,url:u.toString(),authorization:init.headers?.authorization,apikey:init.headers?.apikey});
  const data=SUPABASE_ROWS[table];
  return {ok:Array.isArray(data),status:Array.isArray(data)?200:404,json:async()=>structuredClone(data??{error:'not found'})};
 };
 const curriculumLookup=createSupabaseCurriculumLookup({url:'https://shadow-test.supabase.co',publishableKey:'shadow-publishable',authorization:'Bearer shadow-user-token',fetchImpl});
 return {calls,curriculumLookup};
}

const telemetry=task=>({task,provider:'deterministic-shadow-e2e',model:'fixture-bound',prompt_version:'ROUTER_E2E_REAL_REQUEST_V1'});
async function blueprintProvider(task,input){
 if(task==='GENERATE'||task==='REPAIR'){
  const blueprint=structuredClone(FIXTURE.input.blueprint);
  blueprint.source=sourceBinding(input);
  blueprint.problem_frame.original_problem=input.constraints.original_problem;
  blueprint.methodology={selected_id:input.methodology.selected_id,catalog_version:input.methodology.catalog_version,required_operations:[...input.methodology.required_operations]};
  return {output:blueprint,telemetry:telemetry(task)};
 }
 if(task==='REVIEW')return {output:{findings:Object.entries(BPS).map(([rule_id,expected])=>({rule_id,severity:'CRITICAL',status:'PASS',scope:'shadow_e2e_real_request',observed:'Bound deterministic reviewer accepted the unchanged certified semantic fixture.',expected}))},telemetry:telemetry(task)};
 throw Error(`UNEXPECTED_BLUEPRINT_TASK:${task}`);
}
const blueprintRunner=async sources=>generateShadow(sources,{},blueprintProvider);

function actionFor(pdaId,worked){
 if(pdaId===PDA1)return worked?'Explica una situación concreta de convivencia del aula y propone el acuerdo «escuchar sin interrumpir» para mejorarla.':'Explica una situación de convivencia y prepara una propuesta de acuerdo.';
 if(pdaId===PDA3)return worked?'Consulta al docente y recuerdos del grupo, contrasta dos explicaciones, registra coincidencias y diferencias y comparte por qué el acuerdo es importante para aprender a convivir con otros.':'Recupera información del grupo y desarrolla un registro sobre acuerdos escolares.';
 return 'Desarrolla el desempeño curricular indicado para su grado.';
}
function proposalFromBlueprint(blueprint){
 const stagesByArtifact=new Map(blueprint.project_stages.map(s=>[s.output_artifact_id,s]));
 return {authoring_version:'SESSION_GRAPH_AUTHORING_V1',sessions:blueprint.session_progression.map((session,index)=>{
  const stageIds=session.expected_output_artifact_ids.map(id=>stagesByArtifact.get(id)?.stage_id).filter(Boolean);
  const requirementIds=blueprint.final_outcome.functional_requirements.filter(r=>r.stage_ids.some(id=>stageIds.includes(id))).map(r=>r.requirement_id);
  const worked=index===1;
  const pdaRows=blueprint.pda_analysis.filter(p=>session.pda_focus.includes(p.pda_id));
  return {session_number:session.session_number,activities:[{
   activity_key:`session_${session.session_number}_direct`,
   title:`Actividad integrada de la sesión ${session.session_number}`,
   contribution_mode:'DIRECT',
   contribution_rationale:'Produce directamente el artefacto esperado de esta sesión sin cambiar el Blueprint aprobado.',
   common_student_action:worked?'Indagan, explican, proponen y registran acuerdos del grupo para construir el producto común.':'Desarrollan el avance previsto del proyecto y producen el artefacto esperado de la sesión.',
   grade_participation:pdaRows.map(p=>({grade:p.grade,student_action:actionFor(p.pda_id,worked),differentiation:p.grade===1?'Representación oral y visual con modelado docente.':'Registro breve, contraste y explicación con apoyo entre pares.',pda_mobilization:[{pda_id:p.pda_id,status:worked?'WORKED':'DEVELOPING'}],evidence:worked?'Registro y explicación observable del desempeño completo.':'Registro de avance del desempeño.'})),
   teacher_role:'Modela la consigna, verifica las fuentes autorizadas y acompaña sin sustituir la acción del alumnado.',
   resources:['papel reutilizado','lápices'],
   supports:['modelado docente','apoyo entre pares'],
   minutes:45,
   input_refs:[session.input_artifact_ids[0]],
   output:`Artefacto de sesión ${session.session_number} construido por el grupo.`,
   contributes_to_artifact_ids:[...session.expected_output_artifact_ids],
   methodology_operations:[...session.methodology_operations],
   functional_requirement_ids:requirementIds,
   ltg_activity_ids:[],
   evidence:`Evidencia observable del artefacto ${session.expected_output_artifact_ids.join(', ')}.`,
   assessment_criteria:['El artefacto esperado existe y las acciones del alumnado son observables y trazables.']
  }]};
 })};
}

const passSessionReview=async({request})=>({input_hash:request.input_hash,findings:Object.entries(SGS).map(([rule_id,expected])=>({rule_id,status:'PASS',scope:'shadow_e2e_real_request',observed:'Bound deterministic reviewer accepted the compiled graph.',expected}))});
const passCriticalReview=async({request})=>({
 input_hash:request.input_hash,
 worked_audits:request.claims.worked.map(x=>({activity_id:x.activity_id,grade:x.grade,pda_id:x.pda_id,status:'PASS',component_checks:[{component:'complete_local_action',satisfied:true,exact_quote:x.student_action}],reason:'The same activity contains the complete claimed student action.'})),
 methodology_link_audits:request.claims.methodology_links.map(x=>({operation:x.operation,activity_id:x.activity_id,status:'PASS',exact_quote:x.common_student_action,reason:'The operation is attached to this local student action.'})),
 functional_link_audits:request.claims.functional_links.map(x=>({requirement_id:x.requirement_id,activity_id:x.activity_id,status:'PASS',action_quote:x.common_student_action,evidence_quote:x.evidence,reason:'The requirement is executed in an authorized stage and leaves local evidence.'}))
});
function pipelineRunner({reject=false,capture}={}){
 return async sources=>{
  capture?.(structuredClone(sources));
  const sessionReview=reject?async({request})=>({input_hash:request.input_hash,findings:Object.entries(SGS).map(([rule_id,expected])=>({rule_id,status:rule_id==='SGS-005'?'FAIL':'PASS',scope:'shadow_e2e_rejection',observed:rule_id==='SGS-005'?'Pedagogical rejection intentionally preserved for E2E boundary test.':'ok',expected}))}):passSessionReview;
  return runShadowPipeline({sources,drivers:{blueprintRunner,sessionAuthor:async({blueprint})=>proposalFromBlueprint(blueprint),sessionReview,sessionCriticalReview:passCriticalReview,sessionRepair:reject?async({blueprint})=>proposalFromBlueprint(blueprint):undefined},options:{graphId:reject?'router-e2e-rejected':'router-e2e-positive'}});
 };
}

test('real-shaped complete request traverses authoritative curriculum and the full approved shadow chain',async()=>{
 const {calls,curriculumLookup}=fakeSupabase();let captured=null;
 const result=await runRouterPipelineShadow({body:completeRequest(),authorization:'Bearer shadow-user-token',curriculumLookup,pipelineRunner:pipelineRunner({capture:x=>captured=x}),sourceRunId:'real-request-positive'});
 assert.equal(result.status,'READY_FOR_TEACHER');
 assert.equal(result.eligible,true);
 assert.match(result.blueprint_hash,/^[a-f0-9]{64}$/);
 assert.match(result.graph_hash,/^[a-f0-9]{64}$/);
 assert.equal(result.pipeline_version,'MULTIPLAN_SHADOW_PIPELINE_V1');
 assert.ok(captured);
 assert.deepEqual(captured.constraints.available_resources,['papel reutilizado','lápices','colores','mesas','aula','patio techado']);
 assert.equal(captured.constraints.available_resources.includes('LEGACY_RESOURCE_MUST_NOT_BECOME_AUTHORIZED'),false);
 assert.equal(JSON.stringify(captured).includes('NOT_PROVIDED'),false);
 assert.equal(JSON.stringify(captured).includes('UNKNOWN'),false);
 assert.equal(captured.curriculum.pdas.find(p=>p.pda_id===PDA1)?.pda_official,SUPABASE_ROWS.pda[0].pda_official);
 assert.notEqual(captured.curriculum.pdas.find(p=>p.pda_id===PDA1)?.pda_official,'LEGACY NO AUTORITATIVO');
 assert.equal(captured.curriculum.ltg[0]?.project_id,'F3-LTG-1-ESC-007');
 assert.equal(captured.curriculum.ltg[0]?.verified_activities.length,6);
 assert.equal(captured.methodology.selected_id,'abp');
 assert.equal(captured.methodology.selection_source,'TEACHER');
 assert.deepEqual(calls.map(x=>x.table),['pda','project_pda','projects_ltg','ltg_project_activities']);
 assert.ok(calls.every(x=>x.authorization==='Bearer shadow-user-token'));
});

test('incomplete real-shaped request stops at NEEDS_TEACHER_INPUT before Supabase or Pipeline',async()=>{
 const body=completeRequest();delete body.teacher_constraints;let curriculumCalls=0,pipelineCalls=0;
 const result=await runRouterPipelineShadow({body,authorization:'Bearer shadow-user-token',curriculumLookup:async()=>{curriculumCalls++;throw Error('MUST_NOT_RUN')},pipelineRunner:async()=>{pipelineCalls++;throw Error('MUST_NOT_RUN')},sourceRunId:'real-request-incomplete'});
 assert.equal(result.status,'NEEDS_TEACHER_INPUT');
 assert.equal(result.eligible,false);
 assert.deepEqual(result.missing_teacher_fields,['students_by_grade','reading_profile','writing_profile','autonomy_profile','connectivity','available_resources','supports','teacher_explicit_constraints']);
 assert.equal(curriculumCalls,0);
 assert.equal(pipelineCalls,0);
});

test('downstream pedagogical rejection remains SESSION_GRAPH_REJECTED through the non-governing router',async()=>{
 const {curriculumLookup}=fakeSupabase();
 const result=await runRouterPipelineShadow({body:completeRequest(),authorization:'Bearer shadow-user-token',curriculumLookup,pipelineRunner:pipelineRunner({reject:true}),sourceRunId:'real-request-rejected'});
 assert.equal(result.status,'SESSION_GRAPH_REJECTED');
 assert.equal(result.eligible,true);
 assert.equal(result.graph_hash,null);
 assert.equal(result.repair_count,1);
 assert.match(result.blueprint_hash,/^[a-f0-9]{64}$/);
});
