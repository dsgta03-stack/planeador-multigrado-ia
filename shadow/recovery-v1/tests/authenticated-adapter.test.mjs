import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  createSupabaseSessionVerifier, createStage7AuthenticatedAdapter,
  inspectStage7BeforePipeline,
} from '../authenticated-adapter.mjs';

const h = s => createHash('sha256').update(s, 'utf8').digest('hex');
const owner = 'a670dbd7-74bf-4b59-896b-6d7e52547f50';
const rival = '80772b10-e460-4632-90e3-a4f183fcc2c4';
const runId = '753bb3ce-770a-44c8-b2b2-d8ddd6c1f434';
const attemptId = '6527b87b-67c3-42ab-a9c2-fde41051d79c';
const sources = Object.freeze({ constraints: { fixture: 'LAB' }, curriculum: { fixture: 'LAB' }, methodology: { fixture: 'LAB' } });
const bindings = Object.freeze({ blueprint_hash: 'a'.repeat(64), graph_hash: 'b'.repeat(64), sources_hash: 'c'.repeat(64), critical_input_hash: 'd'.repeat(64), composition_id: 'COMPOSITION', graph_id: 'GRAPH', graph_revision: '1' });
const versions = Object.freeze({ checkpoint_version: 'LOCAL_REVIEW_CHECKPOINT_V1', code_version: 'e'.repeat(64) });
const token = 't'.repeat(64);
const canonicalContext = () => ({run_id:runId,attempt_id:attemptId,run_owner_id:owner,attempt_owner_id:owner,
  sources,bindings,versions,attempt_sources:sources,attempt_bindings:bindings,attempt_versions:versions});
const snapshot = () => ({blueprintEnvelope:{},blueprintApproval:{},graph:{graph_id:'GRAPH',revision:'1'},
  proposal:{},semantic:{},semanticProvider:{},projectComposition:{composition_id:'COMPOSITION'},
  blueprint_hash:bindings.blueprint_hash,graph_hash:bindings.graph_hash});
const payload = (families={}) => {
  const data = {owner,project_id:runId,version:versions.checkpoint_version,code_version:versions.code_version,
    sources,snapshot:snapshot(),families,finished:false};
  const value = JSON.stringify({digest:h(JSON.stringify(data)),data});
  return value;
};
const readyState = (families={}) => {
  const value=payload(families);
  return {revision:1,bindings,versions,payload:value,payload_sha256:h(value),resumable:true,finished:false};
};
const pendingId='sessiongraph-review-worked-11111111-1111-4111-8111-111111111111';
const pendingFamily=()=>({WORKED:{focus:'WORKED',code_version:versions.code_version,input_hash:bindings.critical_input_hash,request_id:pendingId,status:'PENDING'}});
const pendingOperation=()=>[{family:'WORKED',request_id:pendingId,input_hash:bindings.critical_input_hash}];

function harness({verifiedOwner=owner,context=canonicalContext(),state=readyState(),operations=[],breakAt=null}={}) {
  const counts={auth:0,context:0,state:0,operations:0,provider:0};
  const log=[];
  const gate=kind=>{counts[kind]++;if(breakAt===kind) throw Error('simulated unavailable')};
  const adapter=createStage7AuthenticatedAdapter({
    verifySession: async ({accessToken})=>{gate('auth');assert.equal(accessToken,token);return verifiedOwner},
    readCanonicalContext:async scope=>{gate('context');log.push(['context',scope]);return context},
    readState:async scope=>{gate('state');log.push(['state',scope]);return state},
    readOperations:async scope=>{gate('operations');log.push(['operations',scope]);return operations},
  });
  return {adapter,counts,log};
}
const inspect=h=>inspectStage7BeforePipeline({adapter:h.adapter,accessToken:token,runId,attemptId});
const nonGenerating=result=>{assert.equal(result.provider_call_allowed,false);assert.ok(!JSON.stringify(result).includes(token));};

test('verified Auth user and authoritative canonical state -> revalidation, no provider request',async()=>{
  const x=harness(),r=await inspect(x);assert.equal(r.status,'SNAPSHOT_AVAILABLE');nonGenerating(r);
  assert.deepEqual(x.counts,{auth:1,context:1,state:1,operations:1,provider:0});
  for(const [,scope] of x.log)assert.deepEqual(scope,{actorId:owner,runId,attemptId});
});
test('PENDING after ambiguous ACK -> reconcile the same request ID, no re-invocation',async()=>{
  const x=harness({state:readyState(pendingFamily()),operations:pendingOperation()});
  const r=await inspect(x);assert.equal(r.status,'UNKNOWN_OUTCOME');assert.equal(r.next_action,'RECONCILE_SAME_REQUEST_ID_NO_AUTOMATIC_RETRY');nonGenerating(r);
});
test('reject foreign teacher BEFORE fetching recovery rows',async()=>{
  const x=harness({verifiedOwner:rival});const r=await inspect(x);
  assert.equal(r.next_action,'OWNER_OR_CANONICAL_BINDING_MISMATCH');nonGenerating(r);
  assert.deepEqual(x.counts,{auth:1,context:1,state:0,operations:0,provider:0});
});
test('reject canonical/attempt source mismatch without checkpoint read',async()=>{
  const c=canonicalContext();c.attempt_sources={constraints:{other:true},curriculum:{fixture:'LAB'},methodology:{fixture:'LAB'}};
  const x=harness({context:c});assert.equal((await inspect(x)).next_action,'OWNER_OR_CANONICAL_BINDING_MISMATCH');
  assert.equal(x.counts.state,0);
});
test('reject run_id, attempt_id and owner mismatch',async()=>{
  for(const property of ['run_id','attempt_id','run_owner_id','attempt_owner_id']){
    const c=canonicalContext();c[property]='DIFFERENT';const x=harness({context:c});
    assert.equal((await inspect(x)).status,'BLOCKED',property);assert.equal(x.counts.state,0,property);
  }
});
test('do not trust arbitrary actor supplied by browser or derive it from token text',async()=>{
  const x=harness();const result=await x.adapter.inspect({accessToken:token,runId,attemptId,actorId:rival,owner_id:rival});
  assert.equal(result.status,'SNAPSHOT_AVAILABLE');assert.equal(x.log[0][1].actorId,owner);
});
test('missing IDs and missing authentication fail before any DB access',async()=>{
  const x=harness();assert.equal((await x.adapter.inspect({accessToken:token,runId:'BAD',attemptId})).next_action,'INVALID_ID');
  assert.equal((await x.adapter.inspect({runId,attemptId})).next_action,'AUTHENTICATION_REQUIRED');
  assert.deepEqual(x.counts,{auth:0,context:0,state:0,operations:0,provider:0});
});
test('Auth/provider and durable DB read exceptions fail closed',async()=>{
  for(const kind of ['auth','context','state','operations']){
    const x=harness({breakAt:kind});const result=await inspect(x);
    assert.equal(result.status,'BLOCKED',kind);nonGenerating(result);
  }
});
test('altered checkpoint and orphan durable operation are rejected',async()=>{
  const broken=readyState();broken.payload_sha256='f'.repeat(64);
  assert.equal((await inspect(harness({state:broken}))).next_action,'CHECKPOINT_SHA256_INVALID');
  assert.equal((await inspect(harness({operations:pendingOperation()}))).next_action,'ORPHANED_DURABLE_OPERATION');
});
test('revision zero requires durable checkpoint BEFORE any provider operation',async()=>{
  const state={revision:0,bindings,versions,payload:null,payload_sha256:null,finished:false};
  const r=await inspect(harness({state}));assert.equal(r.status,'CHECKPOINT_REQUIRED');nonGenerating(r);
});
test('Supabase verifier consults fixed Auth API, never trusts an unsigned decoded token',async()=>{
  let calls=0;
  const verify=createSupabaseSessionVerifier({projectRef:'uttzuegoegquowakyfoh',publishableKey:'publishable-fixture',fetchImpl:async (url,options)=>{
    calls++;assert.equal(url,'https://uttzuegoegquowakyfoh.supabase.co/auth/v1/user');assert.equal(options.headers.authorization,`Bearer ${token}`);
    return {ok:true,json:async()=>({id:owner,aud:'authenticated'})};
  }});
  assert.equal(await verify({accessToken:token}),owner);assert.equal(calls,1);
  assert.equal(await verify({accessToken:'short'}),null);assert.equal(calls,1);
});
test('Supabase verifier rejects untrusted audience, server failures and network errors',async()=>{
  for(const fetchImpl of [
    async()=>({ok:true,json:async()=>({id:owner,aud:'anon'})}),
    async()=>({ok:false,status:503}),
    async()=>{throw Error('timeout')},
  ]){
    const verify=createSupabaseSessionVerifier({projectRef:'uttzuegoegquowakyfoh',publishableKey:'public-fixture',fetchImpl});
    assert.equal(await verify({accessToken:token}),null);
  }
  assert.throws(()=>createSupabaseSessionVerifier({projectRef:'https://example.invalid',publishableKey:'key'}),/INVALID_SUPABASE_AUTH_CONFIGURATION/);
});
test('misconfiguration fails at construction, never silently allows a provider call',()=>{
  assert.throws(()=>createStage7AuthenticatedAdapter({verifySession:async()=>owner}),/STAGE7_TRUSTED_READERS_REQUIRED/);
});