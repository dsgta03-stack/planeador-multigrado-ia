import test from 'node:test';
import assert from 'node:assert/strict';
import { createStage7LabBundleReader, createStage7LabRecoveryInspector } from '../lab-bundle-reader.mjs';
const projectRef = 'uttzuegoegquowakyfoh';
const key = 'sb_publishable_fixture';
const accessToken = 's'.repeat(64);
const actorId = 'a670dbd7-74bf-4b59-896b-6d7e52547f50';
const runId = '753bb3ce-770a-44c8-b2b2-d8ddd6c1f434';
const attemptId = '6527b87b-67c3-42ab-a9c2-fde41051d79c';
const sources = {constraints:{fixture:'LAB'},curriculum:{fixture:'LAB'},methodology:{fixture:'LAB'}};
const bindings = {blueprint_hash:'a'.repeat(64),graph_hash:'b'.repeat(64),sources_hash:'c'.repeat(64),critical_input_hash:'d'.repeat(64),composition_id:'C',graph_id:'G',graph_revision:'1'};
const versions = {checkpoint_version:'LOCAL_REVIEW_CHECKPOINT_V1',code_version:'e'.repeat(64)};
function bundle(){return {run_id:runId,attempt_id:attemptId,run_owner_id:actorId,attempt_owner_id:actorId,
  canonical_context_available:false,canonical:null,
  attempt_sources:sources,attempt_bindings:bindings,attempt_versions:versions,
  state:{revision:0,bindings,versions,payload:null,payload_sha256:null,finished:false},registered_operations:[]};}
const scope = {actorId,runId,attemptId,accessToken};
const reply = value => ({ok:true,json:async()=>({ok:true,bundle:value})});
function adapter(reader){return createStage7LabRecoveryInspector({verifySession:async()=>actorId,readTrustedBundle:reader});}

test('uses exact isolated Edge Function endpoint with verified bearer and no secret',async()=>{
  let count=0;const reader=createStage7LabBundleReader({projectRef,publishableKey:key,fetchImpl:async(url,init)=>{
    count++;assert.equal(url,`https://${projectRef}.supabase.co/functions/v1/multiplan-stage7-worker-lab`);
    assert.equal(init.method,'POST');assert.equal(init.headers.apikey,key);
    assert.equal(init.headers.authorization,`Bearer ${accessToken}`);
    assert.deepEqual(JSON.parse(init.body),{action:'read_bundle',run_id:runId,attempt_id:attemptId});
    assert.equal(init.credentials,undefined);return reply(bundle());
  }});
  const got=await reader(scope);assert.equal(count,1);assert.equal(got.attempt_id,attemptId);
});
test('lab fixture has no independent canonical context, MUST fail closed before generation',async()=>{
  const reader=createStage7LabBundleReader({projectRef,publishableKey:key,fetchImpl:async()=>reply(bundle())});
  const got=await adapter(reader).inspect({accessToken,runId,attemptId});
  assert.equal(got.status,'BLOCKED');assert.equal(got.next_action,'CANONICAL_CONTEXT_NOT_PERSISTED');assert.equal(got.provider_call_allowed,false);
});
test('atomic bundle can return CHECKPOINT_REQUIRED only with independently supplied canonical context',async()=>{
  const example=bundle();example.canonical_context_available=true;example.canonical={run_id:runId,attempt_id:attemptId,run_owner_id:actorId,attempt_owner_id:actorId,sources,bindings,versions,attempt_sources:sources,attempt_bindings:bindings,attempt_versions:versions};
  const reader=createStage7LabBundleReader({projectRef,publishableKey:key,fetchImpl:async()=>reply(example)});
  const got=await adapter(reader).inspect({accessToken,runId,attemptId});
  assert.equal(got.status,'CHECKPOINT_REQUIRED');assert.equal(got.provider_call_allowed,false);
});
test('foreign owner and wrong attempt are rejected before interpreting checkpoint',async()=>{
  for(const k of ['run_owner_id','attempt_owner_id','attempt_id','run_id']){
    const value=bundle();value[k]='another';
    const reader=createStage7LabBundleReader({projectRef,publishableKey:key,fetchImpl:async()=>reply(value)});
    const res=await adapter(reader).inspect({accessToken,runId,attemptId});
    assert.equal(res.status,'BLOCKED',k);assert.equal(res.next_action,'DURABLE_RECOVERY_READ_FAILED',k);
  }
});
test('401, 403, 409, 500, 504 all fail closed without retry or model request',async()=>{
  for(const status of [401,403,409,500,504]){
    let calls=0;const reader=createStage7LabBundleReader({projectRef,publishableKey:key,fetchImpl:async()=>{calls++;return {ok:false,status}}});
    const got=await adapter(reader).inspect({accessToken,runId,attemptId});
    assert.equal(calls,1);assert.equal(got.status,'BLOCKED');assert.equal(got.provider_call_allowed,false);
  }
});
test('network failure and invalid JSON response fail closed without retry',async()=>{
  for(const fetchImpl of [async()=>{throw Error('fetch failed')},async()=>({ok:true,json:async()=>{throw Error('bad json')}}),async()=>({ok:true,json:async()=>({ok:true})})]){
    const r=await adapter(createStage7LabBundleReader({projectRef,publishableKey:key,fetchImpl})).inspect({accessToken,runId,attemptId});
    assert.equal(r.status,'BLOCKED');assert.equal(r.provider_call_allowed,false);
  }
});
test('reader rejects invalid identity/scope before network I/O',async()=>{
  let calls=0;const reader=createStage7LabBundleReader({projectRef,publishableKey:key,fetchImpl:async()=>{calls++;return reply(bundle())}});
  for(const value of [{...scope,actorId:'abc'},{...scope,runId:'abc'},{...scope,attemptId:'abc'},{...scope,accessToken:'abc'}])
    await assert.rejects(reader(value),/SCOPE_INVALID/);
  assert.equal(calls,0);
});
test('reader refuses wrong config and untrusted response envelopes',async()=>{
  assert.throws(()=>createStage7LabBundleReader({projectRef:'example.com',publishableKey:key}),/CONFIGURATION_INVALID/);
  for(const bad of [null,[],{...bundle(),registered_operations:{}},{...bundle(),state:null},{...bundle(),canonical_context_available:true,canonical:null}]){
    const reader=createStage7LabBundleReader({projectRef,publishableKey:key,fetchImpl:async()=>reply(bad)});
    await assert.rejects(reader(scope),/INVALID_RESPONSE|BINDING_INVALID/);
  }
});
test('atomic bundle reader is single-call scoped and refuses fabricated canonical copy',async()=>{
  let calls=0;const got=bundle();got.canonical_context_available=false;
  const reader=createStage7LabBundleReader({projectRef,publishableKey:key,fetchImpl:async()=>{calls++;return reply(got)}});
  const value=await adapter(reader).inspect({accessToken,runId,attemptId});
  assert.equal(calls,1);assert.equal(value.next_action,'CANONICAL_CONTEXT_NOT_PERSISTED');
  assert.ok(!JSON.stringify(value).includes(accessToken));
});
