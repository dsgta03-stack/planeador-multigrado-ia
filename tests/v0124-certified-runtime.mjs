import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCertifiedPipelineRunner,CERTIFIED_RUNTIME_VERSION} from '../lib/v0124/certified-runtime.mjs';
import {runShadowPipeline} from '../shadow/pipeline-v1/pipeline.mjs';

const endpoint='https://example.invalid/functions/v1/plan-project-blueprint-v1-shadow';
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
  {endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow'},
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
   createProjectCompositionProvider({invoke}){order.push('composition-provider');assert.equal(typeof invoke,'function');return async()=>({composition:{schema_version:'PROJECT_COMPOSITION_V1'},provider:{provider_version:'fixture'}});},
  async runShadowPipeline(input){order.push('pipeline');assert.strictEqual(input.sources,sourceRef);assert.deepEqual(Object.keys(input.sources).sort(),['constraints','curriculum','methodology']);assert.strictEqual(input.options.blueprintOptions.constructionPlan.derived_from,sourceRef);assert.equal(input.options.maxSessionRepairs,1);assert.equal(input.options.blueprintOptions.authoringCompact,true);assert.equal(input.options.blueprintOptions.durableEvidence,true);assert.equal(input.options.blueprintOptions.executionMode,'CERTIFIED_R2');assert.equal(input.options.blueprintOptions.model,'gemini-3.5-flash-lite');assert.equal(input.options.blueprintOptions.endpoint,endpoint);assert.equal(typeof input.drivers.projectCompositionProvider,'function');assert.equal(input.drivers.sessionCriticalReview,drivers.sessionCriticalReview);assert.strictEqual(input.drivers.sessionReview,drivers.sessionReview);return {status:'BLUEPRINT_NOT_APPROVED',errors:[]};}
 };
 const runner=createCertifiedPipelineRunner({...config,factories});
 const result=await runner(sources,{authorization:'Bearer request-secret'});
 assert.deepEqual(order,['construction','split','composition-provider','pipeline']);
 assert.equal(result.status,'BLUEPRINT_NOT_APPROVED');
 assert.equal(result.runtime.runner_version,CERTIFIED_RUNTIME_VERSION);
 assert.deepEqual(result.runtime.session_provider.critical_review.focuses,['WORKED','METHODOLOGY','FUNCTIONAL']);
 assert.throws(()=>result.runtime.runner_version='changed',TypeError);
 await assert.rejects(()=>runner({...sources,extra:true}),/EXACT_SOURCE/);
 assert.deepEqual(order,['construction','split','composition-provider','pipeline']);
});

test('provider failure remains a pipeline failure; diagnostics and errors redact credentials',async()=>{
 const factories={
  constructionPlan:()=>({}),
  createProjectCompositionProvider:()=>async()=>({composition:{schema_version:'PROJECT_COMPOSITION_V1',composition_id:'fixture-composition',base:{origin:'AI_ORIGINAL',project_id:null},enrichments:[]},provider:{provider_version:'fixture'}}),
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
  createProjectCompositionProvider:()=>async()=>({composition:{schema_version:'PROJECT_COMPOSITION_V1',composition_id:'fixture-composition',base:{origin:'AI_ORIGINAL',project_id:null},enrichments:[]},provider:{provider_version:'fixture'}}),
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
 assert.match(source,/import \{createProjectCompositionProvider,PROJECT_COMPOSITION_PROMPT_VERSION\}/);
 for(const forbidden of ['project-coherence.mjs','ui.mjs','history-fidelity.mjs','review-cache.mjs','docx-export.mjs','live-shadow.mjs'])
  assert.ok(!source.includes(forbidden),forbidden);
});

test('certified project composition invoke preserves request contract and transport identity',async()=>{
 let captured=null;
 let capturedInvoke=null;

 const fetchImpl=async(url,init)=>{
  captured={url,init,body:JSON.parse(init.body)};
  return new Response(JSON.stringify({
   output:{proposal_version:'PROJECT_COMPOSITION_PROPOSAL_V1'},
   request_id:'composition-request-1',
   model:'gemini-3.5-flash-lite'
  }),{status:200,headers:{'content-type':'application/json'}});
 };

 const factories={
  constructionPlan:()=>({}),
  createSessionGraphDriversSplitCritical:()=>({
   sessionAuthor:async()=>{},
   sessionRepair:async()=>{},
   sessionReview:async()=>{},
   sessionCriticalReview:async()=>{},
   diagnostics:()=>({})
  }),
  createProjectCompositionProvider({invoke}){
   capturedInvoke=invoke;
   return async()=>({
    composition:{
     schema_version:'PROJECT_COMPOSITION_V1',
     composition_id:'fixture',
     base:{origin:'AI_ORIGINAL',project_id:null},
     enrichments:[]
    },
    provider:{provider_version:'fixture'}
   });
  },
  async runShadowPipeline(){
   const request={
    task:'GENERATE',
    prompt_version:'PROJECT_COMPOSITION_PROMPT_V1',
    system:'composition system',
    prompt:{instruction:'compose'},
    input:{value:'fixture'},
    response_schema:{type:'object'},
    input_hash:'a'.repeat(64)
   };

   const result=await capturedInvoke(request);

   assert.equal(result.request_id,'composition-request-1');
   assert.equal(result.model,'gemini-3.5-flash-lite');

   return {status:'BLUEPRINT_NOT_APPROVED',errors:[]};
  }
 };

 const runner=createCertifiedPipelineRunner({
  endpoint,
  token,
  identity:'shadow-integration',
  fetchImpl,
  sleep:async()=>{},
  factories
 });

 const result=await runner(sources);

 assert.equal(result.status,'BLUEPRINT_NOT_APPROVED');

 assert.equal(
  captured.url,
  endpoint
 );

 assert.equal(
  captured.init.method,
  'POST'
 );

 assert.equal(
  captured.init.headers.authorization,
  `Bearer ${token}`
 );

 assert.equal(
  captured.init.headers['x-shadow-identity'],
  'shadow-integration'
 );

 assert.deepEqual(
  captured.body,
  {
   task:'GENERATE',
   prompt_version:'PROJECT_COMPOSITION_PROMPT_V1',
   model:'gemini-3.5-flash-lite',
   system:'composition system',
   prompt:{instruction:'compose'},
   input:{value:'fixture'},
   response_schema:{type:'object'},
   input_hash:'a'.repeat(64)
  }
 );
});