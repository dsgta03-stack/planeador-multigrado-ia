import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertProviderExecutionPolicy,PROVIDER_EXECUTION_MODES} from '../execution-policy.mjs';
import {callProvider} from '../provider.mjs';
import {constructionPlan} from '../construction.mjs';

const allow=({env,executionMode})=>assertProviderExecutionPolicy({env,executionMode});
const flags={MULTIPLAN_CERTIFIED_R2_ENABLED:'1',MULTIPLAN_CERTIFIED_R2_PROVIDER_ENABLED:'1'};
const endpoint='https://example.invalid/plan-project-blueprint-v1-shadow';
const token='synthetic-test-credential';

test('the two explicit modes retain shadow production refusal and require both certified flags',()=>{
 assert.deepEqual(PROVIDER_EXECUTION_MODES,['SHADOW','CERTIFIED_R2']);
 assert.equal(allow({env:{MULTIPLAN_SHADOW_RUN:'1',NODE_ENV:'test'},executionMode:'SHADOW'}),'SHADOW');
 assert.throws(()=>allow({env:{MULTIPLAN_SHADOW_RUN:'1',NODE_ENV:'production'},executionMode:'SHADOW'}),/SHADOW_RUN_NOT_EXPLICIT_OR_PRODUCTION/);
 for(const env of [{NODE_ENV:'production'},{...flags,MULTIPLAN_CERTIFIED_R2_ENABLED:'0'},{...flags,MULTIPLAN_CERTIFIED_R2_PROVIDER_ENABLED:'0'}])
  assert.throws(()=>allow({env,executionMode:'CERTIFIED_R2'}),/CERTIFIED_R2_PROVIDER_NOT_EXPLICIT/);
 assert.equal(allow({env:{...flags,NODE_ENV:'production'},executionMode:'CERTIFIED_R2'}),'CERTIFIED_R2');
 assert.throws(()=>allow({env:flags,executionMode:'ANOTHER_MODE'}),/PROVIDER_EXECUTION_MODE_UNSUPPORTED/);
 assert.throws(()=>allow({env:{...flags,MULTIPLAN_SHADOW_RUN:'1',NODE_ENV:'production'},executionMode:'SHADOW'}),/SHADOW_RUN_NOT_EXPLICIT_OR_PRODUCTION/);
 for(const bad of ['true','yes','01',true,1])for(const key of Object.keys(flags))
  assert.throws(()=>allow({env:{...flags,[key]:bad},executionMode:'CERTIFIED_R2'}),/CERTIFIED_R2_PROVIDER_NOT_EXPLICIT/);
});

test('authorization failure precedes fetch, schema, request limiter and provider quota',async()=>{
 let calls=0;
 const fetchImpl=()=>{calls++;throw Error('NETWORK_MUST_NOT_RUN');};
 const previous=Object.fromEntries(['MULTIPLAN_SHADOW_RUN','MULTIPLAN_CERTIFIED_R2_ENABLED','MULTIPLAN_CERTIFIED_R2_PROVIDER_ENABLED'].map(key=>[key,process.env[key]]));
 try{
  for(const key of Object.keys(previous))delete process.env[key];
  await assert.rejects(callProvider('GENERATE',{}, {endpoint,token,fetchImpl}),/SHADOW_RUN_NOT_EXPLICIT_OR_PRODUCTION/);
  process.env.MULTIPLAN_CERTIFIED_R2_ENABLED='1';
  await assert.rejects(callProvider('GENERATE',{}, {endpoint,token,executionMode:'CERTIFIED_R2',fetchImpl}),/CERTIFIED_R2_PROVIDER_NOT_EXPLICIT/);
  process.env.MULTIPLAN_CERTIFIED_R2_PROVIDER_ENABLED='1';
  await assert.rejects(callProvider('GENERATE',{}, {endpoint:'https://example.invalid/other',token,executionMode:'CERTIFIED_R2',fetchImpl}),/ISOLATED_SHADOW_ENDPOINT_REQUIRED/);
  assert.equal(calls,0);
 }finally{for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;}
 const source=readFileSync(new URL('../provider.mjs',import.meta.url),'utf8');
 assert.ok(source.indexOf('assertProviderExecutionPolicy({env:process.env,executionMode})')<source.indexOf('assertProviderSchema(response_schema)'));
 assert.ok(source.indexOf('assertProviderExecutionPolicy({env:process.env,executionMode})')<source.indexOf('await limitShadowRequest('));
});

test('allowed SHADOW and CERTIFIED_R2 send semantically identical provider requests',async()=>{
 assert.notEqual(process.env.NODE_ENV,'production'); // No test changes NODE_ENV.
 const fixture=JSON.parse(readFileSync(new URL('../fixtures/PB-001.json',import.meta.url))).input;
 const sources={constraints:fixture.constraints,curriculum:fixture.curriculum,methodology:fixture.methodology};
 const plan=constructionPlan(sources),captured=[];
 const options={endpoint,token,identity:'test-shadow-identity',model:'gemini-3.5-flash-lite',constructionPlan:plan,authoringCompact:true,durableEvidence:false,
  fetchImpl:async(url,request)=>{captured.push({url,request:JSON.parse(request.body)});return {ok:true,status:200,json:async()=>({output:{synthetic:true},usage:{totalTokenCount:1}})};}};
 const keys=['MULTIPLAN_SHADOW_RUN','MULTIPLAN_CERTIFIED_R2_ENABLED','MULTIPLAN_CERTIFIED_R2_PROVIDER_ENABLED'];
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{
  process.env.MULTIPLAN_SHADOW_RUN='1';
  const shadow=await callProvider('GENERATE',sources,{...options,executionMode:'SHADOW'});
  process.env.MULTIPLAN_CERTIFIED_R2_ENABLED='1';process.env.MULTIPLAN_CERTIFIED_R2_PROVIDER_ENABLED='1';
  const certified=await callProvider('GENERATE',sources,{...options,executionMode:'CERTIFIED_R2'});
  assert.equal(shadow.telemetry.input_hash,certified.telemetry.input_hash);
 }finally{for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;}
 assert.equal(captured.length,2);
 assert.equal(captured[0].url,endpoint);
 assert.deepEqual(captured[0],captured[1]);
 for(const key of ['task','prompt_version','model','system','prompt','input','response_schema'])assert.deepEqual(captured[0].request[key],captured[1].request[key]);
 const sent=JSON.stringify(captured[1].request);
 for(const forbidden of ['executionMode','CERTIFIED_R2','MULTIPLAN_CERTIFIED_R2_ENABLED','MULTIPLAN_CERTIFIED_R2_PROVIDER_ENABLED'])
  assert.ok(!sent.includes(forbidden),forbidden);
});
