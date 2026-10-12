import {executableFixture} from '../../session-graph-v1/tests/executable-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../../project-blueprint-v1/contracts.mjs';
import {SGS} from '../../session-graph-v1/catalog.mjs';
import {runShadowPipeline} from '../pipeline.mjs';
import {projectTeacherPlan} from '../projection.mjs';
import {repairTargetsFromContext} from '../session-provider.mjs';

function fixture(){
 const constraints={constraints_hash:'a'.repeat(64),grades:[1,3],minutes_per_session:90,available_resources:['papel','lapiz'],supports:['modelado','pares']};
 const curriculum={snapshot_hash:'b'.repeat(64),pdas:[{pda_id:'p1',grade:1},{pda_id:'p3',grade:3}]};
 const methodology={methodology_decision_id:'m1',selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION','PLANIFICACION','INTEGRACION']};
 const blueprint={schema_version:'PROJECT_BLUEPRINT_V1',blueprint_id:'bp1',revision:2,status:'DRAFT',source:{constraints_hash:constraints.constraints_hash,curriculum_snapshot_hash:curriculum.snapshot_hash,methodology_decision_id:'m1'},problem_frame:{original_problem:'convivencia',pedagogical_focus:'acuerdos',context_relevance:'escuela',why_project_is_needed:'mejorar convivencia',scope:['aula'],out_of_scope:[]},methodology:{selected_id:methodology.selected_id,catalog_version:methodology.catalog_version,required_operations:[...methodology.required_operations]},guiding_question:{question:'¿Cómo mejoramos la convivencia?',problem_link:'convivencia',product_link:'muestra',grade_accessibility:'ALL_GRADES'},pda_analysis:[{pda_id:'p1',grade:1,official_text:'p1'},{pda_id:'p3',grade:3,official_text:'p3'}],grade_contributions:[{contribution_id:'grade_1',grade:1,pda_ids:['p1'],project_contribution:'dibujos'},{contribution_id:'grade_3',grade:3,pda_ids:['p3'],project_contribution:'textos'}],final_outcome:{outcome_id:'outcome',name:'Muestra',type:'MUSEUM',description:'muestra común',purpose:'explicar acuerdos',audience_or_beneficiary:'escuela',use_or_destination:'convivencia',functional_profiles:['MUSEUM'],functional_requirements:[{requirement_id:'pieces',stage_ids:['planning'],criterion:'piezas',evidence:'plan'},{requirement_id:'mounting',stage_ids:['intervention'],criterion:'montaje',evidence:'montaje'}],completion_evidence:['muestra'],authenticity_conditions:['común'],required_resources:[]},project_stages:[{stage_id:'planning',order:1,output_artifact_id:'artifact_1'},{stage_id:'intervention',order:2,output_artifact_id:'artifact_2'}],session_progression:[{session_number:1,project_state_before:'sin plan',session_project_goal:'planear',required_learning:['identificar'],pda_focus:['p1','p3'],methodology_operations:['IDENTIFICACION','PLANIFICACION'],input_artifact_ids:['input_context'],expected_output_artifact_ids:['artifact_1'],expected_partial_product:'plan',acceptance_criteria:['plan listo'],project_state_after:'plan listo',terminal:false,next_session_dependency:2},{session_number:2,project_state_before:'plan listo',session_project_goal:'montar',required_learning:['integrar'],pda_focus:['p1','p3'],methodology_operations:['INTEGRACION'],input_artifact_ids:['artifact_1'],expected_output_artifact_ids:['artifact_2'],expected_partial_product:'museo',acceptance_criteria:['montado'],project_state_after:'museo listo',terminal:true,next_session_dependency:null}],ltg_strategy:{mode:'NONE',selections:[]}};
 const h=hash(blueprint);const blueprintEnvelope={status:'APPROVED',blueprint,gate:{gate_version:'BLUEPRINT_GATE_V1',status:'PASS',evaluated_blueprint_hash:h},approved_blueprint_hash:h};
 const proposal={authoring_version:'SESSION_GRAPH_AUTHORING_V1',sessions:[{session_number:1,activities:[{activity_key:'a1',title:'Recuperamos',contribution_mode:'COMPLEMENTARY',contribution_rationale:'prepara el plan',common_student_action:'comparan situaciones',grade_participation:[{grade:1,student_action:'explica',differentiation:'dibuja',pda_mobilization:[{pda_id:'p1',status:'DEVELOPING'}],evidence:'dibujo'},{grade:3,student_action:'indaga',differentiation:'registra',pda_mobilization:[{pda_id:'p3',status:'DEVELOPING'}],evidence:'registro'}],teacher_role:'modela',resources:['papel'],supports:['modelado'],minutes:30,input_refs:['input_context'],output:'hallazgos',contributes_to_artifact_ids:[],methodology_operations:['IDENTIFICACION'],functional_requirement_ids:[],ltg_activity_ids:[],evidence:'registro',assessment_criteria:['distingue situaciones']},{activity_key:'a2',title:'Planificamos',contribution_mode:'DIRECT',contribution_rationale:'construye el artefacto',common_student_action:'deciden el plan',grade_participation:[{grade:1,student_action:'explica y propone',differentiation:'elige dibujo',pda_mobilization:[{pda_id:'p1',status:'WORKED'}],evidence:'propuesta'},{grade:3,student_action:'indaga registra y comparte',differentiation:'escribe',pda_mobilization:[{pda_id:'p3',status:'WORKED'}],evidence:'plan'}],teacher_role:'facilita',resources:['papel','lapiz'],supports:['pares'],minutes:45,input_refs:['a1'],output:'plan escrito',contributes_to_artifact_ids:['artifact_1'],methodology_operations:['PLANIFICACION'],functional_requirement_ids:['pieces'],ltg_activity_ids:[],evidence:'plan',assessment_criteria:['plan construido']}]},{session_number:2,activities:[{activity_key:'b1',title:'Montamos',contribution_mode:'DIRECT',contribution_rationale:'culmina el producto',common_student_action:'integran y montan',grade_participation:[{grade:1,student_action:'explica piezas',differentiation:'apoyo visual',pda_mobilization:[{pda_id:'p1',status:'DEVELOPING'}],evidence:'explicacion'},{grade:3,student_action:'organiza montaje',differentiation:'texto breve',pda_mobilization:[{pda_id:'p3',status:'DEVELOPING'}],evidence:'registro'}],teacher_role:'observa',resources:['papel'],supports:['pares'],minutes:60,input_refs:['artifact_1'],output:'museo montado',contributes_to_artifact_ids:['artifact_2'],methodology_operations:['INTEGRACION'],functional_requirement_ids:['mounting'],ltg_activity_ids:[],evidence:'montaje',assessment_criteria:['producto integrado']}]}]};
 executableFixture(proposal);
 return {sources:{constraints,curriculum,methodology},blueprintEnvelope,proposal};
}
const passReview=async ({request})=>({input_hash:request.input_hash,findings:Object.keys(SGS).map(rule_id=>({rule_id,status:'PASS',scope:'fixture',observed:'ok',expected:SGS[rule_id]}))});
test('WORKED critical repair receives exact audit and cannot retry a second critical failure',async()=>{
 const f=fixture();let repairs=0;
 const critical=async({request})=>{const out=await passCriticalReview({request});const row=out.worked_audits[0];row.status='FAIL';row.component_checks.push({component:'synthetic_missing_component',satisfied:false,exact_quote:''});return out;};
 const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>f.proposal,sessionReview:passReview,sessionCriticalReview:critical,sessionRepair:async ctx=>{
  repairs++;const targets=repairTargetsFromContext(ctx),t=targets.find(t=>t.source==='SESSION_CRITICAL_GATE');assert.equal(t.rule_id,'WORKED');assert.deepEqual(t.missing_components,['synthetic_missing_component']);assert.equal(t.session,1);assert.equal(t.activity_key,'a2');assert.ok(ctx.critical_audit.input_hash);
  return {proposal:structuredClone(f.proposal),worked_critical_repair_diagnostics:[{target_id:t.target_id,session:t.session,activity_key:t.activity_key,grade:t.grade,pda_id:t.pda_id,missing_components_count:1,missing_components:t.missing_components,repair_applied_to_expected_claim:true}]};
 }},options:{graphId:'g-worked-once'}});
 assert.equal(result.status,'SESSION_GRAPH_REJECTED');assert.equal(result.repair_count,1);assert.equal(repairs,1);assert.equal(result.session_critical_gate.status,'FAIL');assert.equal(result.stages.find(s=>s.stage==='SESSION_REPAIR').worked_critical_repair_diagnostics[0].missing_components_count,1);
});
test('pipeline retains compact post-provider repair diagnostics without changing ERROR status',async()=>{
 const f=fixture(),bad=structuredClone(f.proposal);bad.sessions[0].activities[0].contribution_mode='DIRECT';bad.sessions[0].activities[0].contributes_to_artifact_ids=[];
 const diagnostic={target_id:'RT-4',session:3,activity_key:'synthetic_action',grade:5,pda_id:'synthetic_pda',reason:'INDAGA_OFFICIAL_SCOPE'};
 const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>bad,sessionRepair:async()=>{
  const e=Error('SESSION_GRAPH_REPAIR_TARGET: RT-4: INDAGA_OFFICIAL_SCOPE');e.code='SESSION_GRAPH_AUTHORING_INVALID';
  e.repair_local_validation={provider_responded:true,proposal_normalized:true,rejected_at:'validateRepairTargets',candidate_text:'MUST_NOT_LEAK'};
  e.repair_target_diagnostics=[{...diagnostic,student_action:'MUST_NOT_LEAK',official_text:'MUST_NOT_LEAK'}];throw e;
 }}});
 assert.equal(result.status,'SESSION_REPAIR_FAILED');assert.equal(result.stages.find(x=>x.stage==='SESSION_REPAIR').status,'ERROR');
 const error=result.errors.find(x=>x.stage==='SESSION_REPAIR');assert.deepEqual(error.repair_target_diagnostics,[diagnostic]);
 assert.deepEqual(error.repair_local_validation,{provider_responded:true,proposal_normalized:true,rejected_at:'validateRepairTargets'});
 assert.ok(!JSON.stringify(error).includes('MUST_NOT_LEAK'));
});
const passCriticalReview=async ({request})=>({input_hash:request.input_hash,worked_audits:request.claims.worked.map(x=>({activity_id:x.activity_id,grade:x.grade,pda_id:x.pda_id,status:'PASS',component_checks:[{component:'fixture',satisfied:true,exact_quote:x.student_action}],reason:'ok'})),methodology_link_audits:request.claims.methodology_links.map(x=>({operation:x.operation,activity_id:x.activity_id,status:'PASS',exact_quote:x.common_student_action,reason:'ok'})),functional_link_audits:request.claims.functional_links.map(x=>({requirement_id:x.requirement_id,activity_id:x.activity_id,status:'PASS',action_quote:x.common_student_action,evidence_quote:x.evidence,reason:'ok'}))});

test('approved Blueprint -> approved SessionGraph -> deterministic teacher projection',async()=>{const f=fixture();const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>f.proposal,sessionReview:passReview,sessionCriticalReview:passCriticalReview},options:{graphId:'g1'}});assert.equal(result.status,'READY_FOR_TEACHER');assert.equal(result.session_approval.status,'APPROVED');assert.equal(result.session_approval.approved_graph_hash,hash(result.session_graph));assert.equal(result.teacher_plan.source.approved_blueprint_hash,f.blueprintEnvelope.approved_blueprint_hash);assert.equal(result.teacher_plan.source.approved_graph_hash,result.session_approval.approved_graph_hash);assert.equal(result.teacher_plan.sessions[0].activities[1].title,'Planificamos');});
test('downstream author cannot mutate approved Blueprint authority',async()=>{const f=fixture();const before=hash(f.blueprintEnvelope.blueprint);const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async ctx=>{try{ctx.blueprint.guiding_question.question='cambiada';}catch{}return f.proposal},sessionReview:passReview,sessionCriticalReview:passCriticalReview},options:{graphId:'g2'}});assert.equal(result.status,'READY_FOR_TEACHER');assert.equal(hash(result.blueprint),before);assert.equal(result.teacher_plan.project.guiding_question.question,'¿Cómo mejoramos la convivencia?');});
test('semantic failure allows at most one SessionGraph repair',async()=>{const f=fixture();let reviews=0,repairs=0;const review=async ({request})=>{reviews++;return {input_hash:request.input_hash,findings:Object.keys(SGS).map(rule_id=>({rule_id,status:reviews===1&&rule_id==='SGS-005'?'FAIL':'PASS',scope:'fixture',observed:reviews===1?'needs repair':'ok',expected:SGS[rule_id]}))}};const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>f.proposal,sessionReview:review,sessionCriticalReview:passCriticalReview,sessionRepair:async()=>{repairs++;return structuredClone(f.proposal)}},options:{graphId:'g3'}});assert.equal(result.status,'READY_FOR_TEACHER');assert.equal(result.repair_count,1);assert.equal(repairs,1);assert.equal(reviews,2);assert.equal(result.session_graph.revision,2);});
test('second semantic failure stops; no repair loop',async()=>{const f=fixture();let repairs=0;const failReview=async ({request})=>({input_hash:request.input_hash,findings:Object.keys(SGS).map(rule_id=>({rule_id,status:rule_id==='SGS-005'?'FAIL':'PASS',scope:'fixture',observed:'fail',expected:SGS[rule_id]}))});const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>f.proposal,sessionReview:failReview,sessionCriticalReview:passCriticalReview,sessionRepair:async()=>{repairs++;return structuredClone(f.proposal)}},options:{graphId:'g4'}});assert.equal(result.status,'SESSION_GRAPH_REJECTED');assert.equal(result.repair_count,1);assert.equal(repairs,1);});
test('SessionGraph may request Blueprint revision but cannot perform it',async()=>{const f=fixture();const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>({status:'BLUEPRINT_REVISION_REQUIRED',reason:'insufficient session budget'})}});assert.equal(result.status,'BLUEPRINT_REVISION_REQUIRED');assert.equal(result.reason,'insufficient session budget');assert.equal(result.session_graph,null);});
test('general semantic PASS cannot bypass a failing critical claims audit',async()=>{const f=fixture();let repairs=0,criticalCalls=0;const critical=async ({request})=>{criticalCalls++;const out=await passCriticalReview({request});if(criticalCalls===1&&out.methodology_link_audits.length)out.methodology_link_audits[0].status='FAIL';return out};const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>f.proposal,sessionReview:passReview,sessionCriticalReview:critical,sessionRepair:async()=>{repairs++;return structuredClone(f.proposal)}},options:{graphId:'g-critical'}});assert.equal(result.status,'READY_FOR_TEACHER');assert.equal(result.repair_count,1);assert.equal(repairs,1);assert.equal(criticalCalls,2);assert.equal(result.session_critical_gate.status,'PASS');});
test('missing critical reviewer fails closed',async()=>{const f=fixture();const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>f.proposal,sessionReview:passReview},options:{graphId:'g-missing-critical'}});assert.equal(result.status,'SESSION_REVIEW_UNAVAILABLE');assert.equal(result.session_approval,null);});
test('teacher projection rejects a graph approval bound to different bytes',async()=>{const f=fixture();const ready=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>f.proposal,sessionReview:passReview,sessionCriticalReview:passCriticalReview},options:{graphId:'g5'}});const bad={...ready.session_approval,approved_graph_hash:'0'.repeat(64),graph_hash:'0'.repeat(64)};assert.throws(()=>projectTeacherPlan({blueprint:ready.blueprint,blueprintApproval:ready.blueprint_approval,graph:ready.session_graph,graphApproval:bad}),/SESSION_GRAPH_NOT_APPROVED/);});

test('project composition runs before Blueprint and is preserved in pipeline result',async()=>{
 const f=fixture(),calls=[];
 const composition={
  schema_version:'PROJECT_COMPOSITION_V1',
  composition_id:'pc-pipeline-1',
  source:{},
  methodology:{},
  base:{origin:'AI_ORIGINAL',project_id:null},
  enrichments:[],
  references:[],
  grade_coverage:[],
  final_outcome:{},
  cohesion:{},
  rejected_options:[],
  ai_original_required:true
 };
 const providerMeta={provider_version:'test-composition-provider'};
 const result=await runShadowPipeline({
  sources:f.sources,
  drivers:{
   projectCompositionProvider:async(sources,pool)=>{
    calls.push('COMPOSITION');
    assert.deepEqual(sources,f.sources);
    assert.ok(pool);
    return {composition,provider:providerMeta};
   },
   blueprintRunner:async(sources,{blueprintOptions})=>{
    calls.push('BLUEPRINT');
    assert.deepEqual(blueprintOptions.projectComposition,composition);
    return f.blueprintEnvelope;
   },
   sessionAuthor:async()=>f.proposal,
   sessionReview:passReview,
   sessionCriticalReview:passCriticalReview
  },
  options:{graphId:'g-composition'}
 });
 assert.deepEqual(calls,['COMPOSITION','BLUEPRINT']);
 assert.equal(result.status,'READY_FOR_TEACHER');
 assert.deepEqual(result.project_composition,composition);
 assert.deepEqual(result.project_composition_provider,providerMeta);
 assert.equal(result.stages.some(x=>x.stage==='PROJECT_COMPOSITION'&&x.status==='COMPOSED'),true);
});

test('project composition failure stops before Blueprint',async()=>{
 const f=fixture();
 let blueprintCalled=false;
 const result=await runShadowPipeline({
  sources:f.sources,
  drivers:{
   projectCompositionProvider:async()=>{
    throw Error('composition failed');
   },
   blueprintRunner:async()=>{
    blueprintCalled=true;
    return f.blueprintEnvelope;
   }
  }
 });
 assert.equal(result.status,'PROJECT_COMPOSITION_STAGE_FAILED');
 assert.equal(blueprintCalled,false);
 assert.equal(result.blueprint,null);
 assert.equal(result.stages.at(-1).stage,'PROJECT_COMPOSITION');
 assert.equal(result.stages.at(-1).status,'ERROR');
});
test('blueprint failure preserves completed project composition trace',async()=>{
 const composition={
  schema_version:'PROJECT_COMPOSITION_V1',
  composition_id:'composition-fixture',
  base:{
   origin:'AI_ORIGINAL',
   project_id:null
  },
  enrichments:[]
 };

 const providerMeta={
  provider_version:'fixture-provider',
  prompt_version:'fixture-prompt',
  input_hash:'a'.repeat(64)
 };

 const result=await runShadowPipeline({
  sources:fixture().sources,
  drivers:{
   projectCompositionProvider:async()=>({
    composition,
    provider:providerMeta
   }),
   blueprintRunner:async()=>{
    throw Error('BLUEPRINT_PROVIDER_DOWN');
   }
  }
 });

 assert.equal(
  result.status,
  'BLUEPRINT_STAGE_FAILED'
 );

 assert.deepEqual(
  result.project_composition,
  composition
 );

 assert.deepEqual(
  result.project_composition_provider,
  providerMeta
 );

 assert.deepEqual(
  result.stages.map(x=>x.stage),
  [
   'PROJECT_COMPOSITION_CANDIDATES',
   'PROJECT_COMPOSITION',
   'PROJECT_BLUEPRINT'
  ]
 );

 assert.equal(
  result.stages.at(-1).status,
  'ERROR'
 );

 assert.equal(
  result.errors.at(-1).stage,
  'PROJECT_BLUEPRINT'
 );

 assert.match(
  result.errors.at(-1).message,
  /BLUEPRINT_PROVIDER_DOWN/
 );
});

for(const mode of ['empty','absent','filtered','valid-renamed','valid-moved','developing','worked','transversal'])test('global post-repair preflight '+mode,async()=>{
 const f=fixture(),bad=structuredClone(f.proposal);
 bad.sessions[0].activities[0].contribution_mode='DIRECT';bad.sessions[0].activities[0].contributes_to_artifact_ids=[];
 const repaired=structuredClone(f.proposal),session=repaired.sessions[0];
 for(const a of session.activities){
  a.activity_key='new_'+a.activity_key;
  a.input_refs=a.input_refs.map(r=>f.proposal.sessions[0].activities.some(x=>x.activity_key===r)?'new_'+r:r);
  if(['empty','filtered'].includes(mode))for(const g of a.grade_participation)if(g.grade===3)g.pda_mobilization=mode==='empty'?[]:[{pda_id:'foreign',status:'DEVELOPING'}];
  if(mode==='absent')a.grade_participation=a.grade_participation.filter(g=>g.grade!==3);
  if(mode==='developing')for(const g of a.grade_participation)for(const m of g.pda_mobilization)m.status='DEVELOPING';
 }
 if(mode==='valid-moved'){
  const rows=session.activities.map(a=>a.grade_participation.find(g=>g.grade===3));
  rows[1].pda_mobilization=[{pda_id:'p3',status:'DEVELOPING'}];rows[0].pda_mobilization=[];
 }
 if(mode==='transversal'){
  f.blueprintEnvelope.blueprint.session_progression[0].pda_focus=['p1'];
  const h=hash(f.blueprintEnvelope.blueprint);f.blueprintEnvelope.approved_blueprint_hash=h;f.blueprintEnvelope.gate.evaluated_blueprint_hash=h;
  for(const a of session.activities)for(const g of a.grade_participation)if(g.grade===3)g.pda_mobilization=[];
 }
 const result=await runShadowPipeline({sources:f.sources,drivers:{blueprintRunner:async()=>f.blueprintEnvelope,sessionAuthor:async()=>bad,sessionRepair:async()=>repaired,sessionReview:passReview,sessionCriticalReview:passCriticalReview},options:{graphId:'post-repair-fixture'}});
 if(['empty','absent','filtered'].includes(mode)){
  assert.equal(result.status,'SESSION_REPAIR_FAILED');
  assert.equal(result.stages.find(s=>s.stage==='SESSION_REPAIR').status,'ERROR');
  assert.equal(result.stages.some(s=>s.stage==='SESSION_COMPILE'&&s.attempt===2),false);
  const e=result.errors.find(e=>e.stage==='SESSION_REPAIR');assert.equal(e.rule,'SGD-014');
  assert.deepEqual(e.global_post_repair_validation,{provider_responded:true,proposal_normalized:true,rejected_at:'GLOBAL_POST_REPAIR_VALIDATION',rule:'SGD-014',session:1,grade:3,attempt:2});
 }else {assert.equal(result.status,'READY_FOR_TEACHER');assert.equal(result.stages.find(s=>s.stage==='SESSION_REPAIR').status,'REPAIRED');}
});
