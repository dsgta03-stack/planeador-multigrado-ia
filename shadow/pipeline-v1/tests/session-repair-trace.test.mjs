import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../../project-blueprint-v1/contracts.mjs';
import {executableSource} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {createSessionGraphDrivers} from '../session-provider.mjs';
import {runShadowPipeline} from '../pipeline.mjs';
import {emitRepairTrace,startRepairTrace,repairTraceState} from '../session-repair-trace.mjs';

async function capture(fn){
 const old=console.error,rows=[];
 console.error=(prefix,line)=>{if(prefix==='[SESSION_REPAIR_TRACE]')rows.push(JSON.parse(line));};
 try{await fn(rows);}finally{console.error=old;}
 return rows;
}
function fixture(){
 const f=executableSource();f.constraints.grades=[2,3];f.curriculum.pdas[0].grade=2;
 for(const s of f.proposal.sessions)for(const a of s.activities)for(const g of a.grade_participation)if(g.grade===1)g.grade=2;
 return f;
}
test('trace snapshots and diffs do not mutate proposals or source',async()=>{
 const f=fixture(),before=structuredClone(f),trace=startRepairTrace();
 await capture(async rows=>{
  for(const phase of ['before','provider_proposal','normalized_proposal','after_apply'])emitRepairTrace(trace,phase,{proposal:f.proposal,previous:f.proposal,source:f});
  assert.deepEqual(rows.map(r=>r.phase),['before','provider_proposal','normalized_proposal','after_apply']);
  for(const r of rows){assert.equal(r[r.phase].session_1_grade_2.present,true);assert.deepEqual(r[r.phase].session_1_grade_2.missing_focused_pda_ids,[]);}
 });
 assert.deepEqual(f,before);
});
test('allowlisted metadata never prints secrets, prompt text or pedagogical narratives',async()=>{
 const f=fixture(),secret='SECRET_BEARER_do_not_print',text='PRIVATE_PEDAGOGICAL_PROMPT';
 f.proposal.authorization=secret;f.proposal.prompt=text;
 const a=f.proposal.sessions[0].activities[0];a.student_action=text;a.title=text;a.activity_key=secret;
 a.grade_participation[0].student_action=text;a.grade_participation[0].pda_mobilization[0].pda_id=secret;
 const rows=await capture(async()=>emitRepairTrace(startRepairTrace(),'provider_proposal',{proposal:f.proposal,source:f,previous:f.proposal,targets:[{rule_id:secret,missing_requirements:[secret],observed:text}]}));
 const out=JSON.stringify(rows);assert.ok(!out.includes(secret));assert.ok(!out.includes(text));assert.ok(out.includes('id#'));
});
test('normalization or application loss is visible independently of provider state',async()=>{
 const f=fixture(),after=structuredClone(f.proposal),trace=startRepairTrace();
 for(const a of after.sessions[0].activities)a.grade_participation=a.grade_participation.filter(g=>g.grade!==2);
 const rows=await capture(async()=>{
  emitRepairTrace(trace,'provider_proposal',{proposal:f.proposal,source:f});
  emitRepairTrace(trace,'normalized_proposal',{proposal:f.proposal,source:f});
  emitRepairTrace(trace,'after_apply',{proposal:after,previous:f.proposal,source:f});
 });
 assert.equal(rows[0].provider_proposal.session_1_grade_2.present,true);
 assert.equal(rows[1].normalized_proposal.session_1_grade_2.present,true);
 assert.equal(rows[2].after_apply.session_1_grade_2.present,false);
 assert.deepEqual(rows[2].after_apply.session_1_grade_2.missing_focused_pda_ids,['p1']);
 assert.ok(rows[2].changed_fields.activities.every(c=>c.fields.includes('grade_participation')));
});
for(const loss of [false,true])test(`real adapter and global preflight correlated; provider coverage loss=${loss}`,async()=>{
 const f=fixture(),initial=structuredClone(f.proposal);initial.sessions[1].activities[0].execution.grouping='Juntos';
 const raw=structuredClone(f.proposal);
 if(loss)for(const a of raw.sessions[0].activities){a.activity_key='renamed_'+a.activity_key;a.input_refs=a.input_refs.map(r=>r==='a1'?'renamed_a1':r);a.grade_participation.find(g=>g.grade===2).pda_mobilization=[];}
 const original=structuredClone(raw),sources={constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology};
 const driver=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async()=>new Response(JSON.stringify({output:{status:'PROPOSAL',reason:'Synthetic',proposal:raw}}))});
 const h=hash(f.blueprint),envelope={status:'APPROVED',blueprint:f.blueprint,gate:{gate_version:'BLUEPRINT_GATE_V1',status:'PASS',evaluated_blueprint_hash:h},approved_blueprint_hash:h};
 let result;
 const rows=await capture(async()=>{result=await runShadowPipeline({sources,drivers:{blueprintRunner:async()=>envelope,sessionAuthor:async()=>initial,sessionRepair:driver.sessionRepair},options:{graphId:'trace-test'}});});
 assert.deepEqual(rows.map(r=>r.phase),['before','provider_proposal','normalized_proposal','after_apply','global_validation']);
 assert.equal(new Set(rows.map(r=>r.trace_id)).size,1);assert.ok(rows.every(r=>r.attempt===2));
 assert.equal(rows[0].before.session_1_grade_2.present,true);assert.deepEqual(rows[0].before.session_1_grade_2.missing_focused_pda_ids,[]);
 for(const r of rows.slice(1,4))assert.deepEqual(r[r.phase].session_1_grade_2.missing_focused_pda_ids,loss?['p1']:[]);
 assert.equal(rows[0].repair_target[0].field,'execution.grouping');
 assert.equal(rows[4].global_validation.status,loss?'FAIL':'PASS');
 if(loss){assert.equal(result.status,'SESSION_REPAIR_FAILED');assert.equal(result.repair_count,0);assert.deepEqual(rows[4].global_validation,{status:'FAIL',first_failing_rule:'SGD-014',session:1,grade:2});}
 else {assert.equal(result.stages.find(s=>s.stage==='SESSION_REPAIR').status,'REPAIRED');assert.equal(result.repair_count,1);assert.ok(rows[4].compiled_graph);}
 assert.deepEqual(raw,original);
});
test('bounded valid JSON declares truncation and retains watched state',async()=>{
 const f=fixture();f.proposal.sessions=Array.from({length:100},(_,i)=>({...structuredClone(f.proposal.sessions[0]),session_number:i+1}));
 const rows=await capture(async()=>emitRepairTrace(startRepairTrace(),'before',{proposal:f.proposal,source:f}));
 assert.ok(JSON.stringify(rows[0]).length<=18000);assert.ok(rows[0].before.omitted_sessions>0);assert.equal(rows[0].before.session_1_grade_2.present,true);
});
test('logging exceptions cannot change repair result; snapshot declares no semantic certification',()=>{
 const old=console.error;console.error=()=>{throw Error('logger unavailable');};
 try{assert.doesNotThrow(()=>emitRepairTrace(startRepairTrace(),'before',{proposal:fixture().proposal}));}finally{console.error=old;}
 assert.equal(repairTraceState(fixture().proposal,fixture()).session_1_grade_2.semantic_validity,'NOT_EVALUATED');
});
test('local rejection records that global validation was not reached',async()=>{
 const f=fixture();f.proposal.sessions[1].activities[0].execution.grouping='Juntos';
 const sources={constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology};
 const driver=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async()=>new Response(JSON.stringify({output:{status:'PROPOSAL',proposal:f.proposal}}))});
 const rows=await capture(async()=>{
  await assert.rejects(driver.sessionRepair({sources,blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: $.sessions[1].b1: SGD-017 teacher executability missing execution.grouping'}}),/SESSION_GRAPH_REPAIR_TARGET/);
 });
 assert.equal(rows.at(-1).global_validation.status,'NOT_REACHED');
});
test('an already absent grade remains explicitly absent in before',async()=>{
 const f=fixture();for(const a of f.proposal.sessions[0].activities)a.grade_participation=a.grade_participation.filter(g=>g.grade!==2);
 const rows=await capture(async()=>emitRepairTrace(startRepairTrace(),'before',{proposal:f.proposal,source:f}));
 assert.equal(rows[0].before.session_1_grade_2.present,false);
 assert.deepEqual(rows[0].before.session_1_grade_2.missing_focused_pda_ids,['p1']);
});
