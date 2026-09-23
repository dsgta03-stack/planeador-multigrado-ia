import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blueprintGate,semanticInputHash} from '../gate.mjs';
import {BPS} from '../catalog.mjs';
import {callProvider} from '../provider.mjs';
import {generateShadow} from '../shadow.mjs';
const fixture=id=>JSON.parse(readFileSync(new URL(`../fixtures/${id}.json`,import.meta.url))).input;
test('museum cannot pass with missing explicit circulation requirements even if reviewer overlooks them',()=>{
 const input=fixture('PB-001');
 const semantic={input_hash:semanticInputHash(input),findings:Object.entries(BPS).map(([rule_id,expected])=>({rule_id,expected,status:'PASS',severity:'CRITICAL',scope:'test-double',observed:'Injected false positive for regression only'}))};
 const gate=blueprintGate(input,semantic);
 assert.equal(gate.status,'FAIL');
 assert.equal(gate.semantic_findings.find(x=>x.rule_id==='BPS-003').status,'FAIL');
});
for(const [id,count] of [['PB-021-CINCO-SESIONES',5],['PB-022-MAS-SESIONES-QUE-OPERACIONES',12]]){
 test(`authored ${count}-session architecture covers operations without proportional allocation`,()=>{
  const input=fixture(id),gate=blueprintGate(input);
  assert.equal(input.blueprint.session_progression.length,count);
  assert.deepEqual(gate.deterministic_findings.filter(x=>x.status==='FAIL'),[]);
  assert.equal(gate.status,'NOT_EVALUABLE'); // No fabricated semantic PASS.
 });
}
test('reject stage consumed before its production session even if session inputs omit it',()=>{
 const input=fixture('PB-010'),s=input.blueprint.session_progression;
 [s[0].expected_output_artifact_ids,s[1].expected_output_artifact_ids]=[s[1].expected_output_artifact_ids,s[0].expected_output_artifact_ids];
 s.forEach(x=>{x.input_artifact_ids=['input_context']});
 assert(blueprintGate(input).deterministic_findings.some(x=>x.rule_id==='BPD-015'&&x.status==='FAIL'));
});
test('live provider refuses execution without explicit shadow environment or in production',async()=>{
 const previous={run:process.env.MULTIPLAN_SHADOW_RUN,env:process.env.NODE_ENV};
 try{
  delete process.env.MULTIPLAN_SHADOW_RUN;
  await assert.rejects(callProvider('GENERATE',{}),/SHADOW_RUN_NOT_EXPLICIT_OR_PRODUCTION/);
  process.env.MULTIPLAN_SHADOW_RUN='1';process.env.NODE_ENV='production';
  await assert.rejects(callProvider('GENERATE',{}),/SHADOW_RUN_NOT_EXPLICIT_OR_PRODUCTION/);
 }finally{
  for(const [key,value] of [['MULTIPLAN_SHADOW_RUN',previous.run],['NODE_ENV',previous.env]])if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
test('repair transport error preserves revision one and cannot approve',async()=>{
 const {blueprint,...src}=fixture('PB-010');blueprint.session_progression.at(-1).next_session_dependency=99;
 const provider=async task=>{
  if(task==='GENERATE')return {output:blueprint,telemetry:{task}};
  throw Error('SIMULATED_PROVIDER_UNAVAILABLE');
 };
 const result=await generateShadow(src,{},provider);
 assert.equal(result.status,'NEEDS_REPAIR');assert.equal(result.repair_count,1);
 assert.equal(result.revisions.length,1);assert.equal(result.revisions[0].blueprint.session_progression.at(-1).next_session_dependency,99);
 assert.equal(result.errors[0].task,'REPAIR');assert.equal(result.approved_blueprint_hash,null);
});
test('initial provider outage yields recorded unevaluated result with no invented blueprint',async()=>{
 const {blueprint,...src}=fixture('PB-010');
 const result=await generateShadow(src,{},async()=>{throw Error('SIMULATED_503')});
 assert.equal(result.status,'NEEDS_REPAIR');assert.equal(result.blueprint,null);assert.equal(result.gate,null);
 assert.equal(result.repair_count,0);assert.equal(result.telemetry.length,1);
});
