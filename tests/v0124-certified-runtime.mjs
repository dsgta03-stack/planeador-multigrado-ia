import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCertifiedPipelineRunner,CERTIFIED_RUNTIME_VERSION} from '../lib/v0124/certified-runtime.mjs';
import {runShadowPipeline} from '../shadow/pipeline-v1/pipeline.mjs';

const endpoint='https://example.invalid/plan-project-blueprint-v1-shadow';
const token='secret-token-'.repeat(4);
const sources=Object.freeze({constraints:{id:'c'},curriculum:{id:'u'},methodology:{id:'m'}});
const config={endpoint,token,identity:'shadow-integration',fetchImpl:()=>{throw Error('UNEXPECTED_NETWORK');},sleep:async()=>{}};

test('construction has no side effects; model, repairs, endpoint, identity and token fail closed',()=>{
 let calls=0;
 const runner=createCertifiedPipelineRunner({...config,fetchImpl:()=>{calls++;}});
 assert.equal(typeof runner,'function');
 assert.equal(calls,0);
 for(const overrides of [
  {model:'gemini-3.1-flash-lite'}, {maxSessionRepairs:2}, {maxSessionRepairs:0},
  {endpoint:'https://example.invalid/other-shadow'},
  {endpoint:'http://example.invalid/plan-project-blueprint-v1-shadow'},
  {endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow?x=1'},
  {endpoint:'https://example.invalid/plan-multiplan-pipeline-v1-shadow'},
  {token:'short'}, {identity:''}, {fetchImpl:null}
 ])assert.throws(()=>createCertifiedPipelineRunner({...config,...overrides}));
 assert.equal(calls,0);
});

test('exact sources, construction, split critical and pipeline run in certified order',async()=>{
 const order=[];
 const drivers={sessionAuthor:async()=>{},sessionRepair:async()=>{},sessionReview:async()=>{},sessionCriticalReview:async()=>{},diagnostics:()=>({mode:'SPLIT_LITERAL_V1',logical_calls_total:4,critical_review:{mode:'SPLIT_LITERAL_V1',focuses:['WORKED','METHODOLOGY','FUNCTIONAL']}})};
 let sourceRef;
 const factories={
  constructionPlan(input){order.push('construction');sourceRef=input;return {derived_from:input};},
  createSessionGraphDriversSplitCritical(options){order.push('split');assert.equal(options.durableEvidence,true);assert.equal(options.model,'gemini-3.5-flash-lite');assert.equal(options.fetchImpl,config.fetchImpl);return drivers;},
  async runShadowPipeline(input){order.push('pipeline');assert.strictEqual(input.sources,sourceRef);assert.deepEqual(Object.keys(input.sources).sort(),['constraints','curriculum','methodology']);assert.strictEqual(input.options.blueprintOptions.constructionPlan.derived_from,sourceRef);assert.equal(input.options.maxSessionRepairs,1);assert.equal(input.options.blueprintOptions.authoringCompact,true);assert.equal(input.options.blueprintOptions.durableEvidence,true);assert.strictEqual(input.drivers.sessionCriticalReview,drivers.sessionCriticalReview);assert.strictEqual(input.drivers.sessionReview,drivers.sessionReview);return {status:'BLUEPRINT_NOT_APPROVED',errors:[]};}
 };
 const runner=createCertifiedPipelineRunner({...config,factories});
 const result=await runner(sources,{authorization:'Bearer request-secret'});
 assert.deepEqual(order,['construction','split','pipeline']);
 assert.equal(result.status,'BLUEPRINT_NOT_APPROVED');
 assert.equal(result.runtime.runner_version,CERTIFIED_RUNTIME_VERSION);
 assert.deepEqual(result.runtime.session_provider.critical_review.focuses,['WORKED','METHODOLOGY','FUNCTIONAL']);
 assert.throws(()=>result.runtime.runner_version='changed',TypeError);
 await assert.rejects(()=>runner({...sources,extra:true}),/EXACT_SOURCE/);
 assert.deepEqual(order,['construction','split','pipeline']);
});

test('provider failure remains a pipeline failure; diagnostics and errors redact credentials',async()=>{
 const factories={
  constructionPlan:()=>({}),
  createSessionGraphDriversSplitCritical:()=>({
   diagnostics:()=>({model:'gemini-3.5-flash-lite',provider_message:`Bearer ${token}`,authorization:`Bearer ${token}`}),
   sessionAuthor:async()=>{},sessionRepair:async()=>{},sessionReview:async()=>{},sessionCriticalReview:async()=>{}
  }),
  runShadowPipeline:input=>runShadowPipeline({...input,drivers:{...input.drivers,blueprintRunner:async()=>{throw Error(`provider unavailable ${token} Bearer request-secret`);}}})
 };
 const result=await createCertifiedPipelineRunner({...config,factories})(sources,{authorization:'Bearer request-secret'});
 assert.equal(result.status,'BLUEPRINT_STAGE_FAILED');
 assert.equal(result.teacher_plan,undefined);
 assert.match(result.errors[0].message,/provider unavailable/);
 assert.equal(result.runtime.session_provider.model,'gemini-3.5-flash-lite');
 const serialized=JSON.stringify(result);
 assert.ok(!serialized.includes(token));
 assert.ok(!serialized.includes('request-secret'));
 assert.ok(!serialized.includes('authorization'));
});

test('an uncaught provider error cannot expose the configured credential',async()=>{
 const factories={
  constructionPlan:()=>({}),
  createSessionGraphDriversSplitCritical:()=>({diagnostics:()=>({})}),
  runShadowPipeline:async()=>{throw Error(`Authorization: Bearer ${token}`);}
 };
 const runner=createCertifiedPipelineRunner({...config,factories});
 await assert.rejects(()=>runner(sources),error=>{
  assert.ok(!error.message.includes(token));
  assert.match(error.message,/\[REDACTED\]/);
  return true;
 });
});

test('runtime has no legacy, UI, history, review cache, DOCX or live runner imports',()=>{
 const source=readFileSync(new URL('../lib/v0124/certified-runtime.mjs',import.meta.url),'utf8');
 assert.match(source,/import \{createSessionGraphDriversSplitCritical\}/);
 for(const forbidden of ['project-coherence.mjs','ui.mjs','history-fidelity.mjs','review-cache.mjs','docx-export.mjs','live-shadow.mjs'])
  assert.ok(!source.includes(forbidden),forbidden);
});
