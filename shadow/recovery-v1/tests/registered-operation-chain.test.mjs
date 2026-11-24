import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assessStage7Recovery } from '../decision.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const expected={owner_id:'00000000-0000-4000-8000-000000000001',run_id:'00000000-0000-4000-8000-000000000002',
  sources:{constraints:{fixture:'LAB'},curriculum:{fixture:'LAB'},methodology:{fixture:'LAB'}},
  bindings:{blueprint_hash:'a'.repeat(64),graph_hash:'b'.repeat(64),sources_hash:'c'.repeat(64),critical_input_hash:'d'.repeat(64),composition_id:'compose-lab',graph_id:'graph-lab',graph_revision:'1'},
  versions:{checkpoint_version:'LOCAL_REVIEW_CHECKPOINT_V1',code_version:'e'.repeat(64)}};
const prior='sessiongraph-review-worked-33333333-3333-4333-8333-333333333333';
const current='sessiongraph-review-worked-44444444-4444-4444-8444-444444444444';
const alternate='sessiongraph-review-worked-55555555-5555-4555-8555-555555555555';
function reg(id,revision,supersedes=null){return {request_id:id,family:'WORKED',code_version:expected.versions.code_version,
  input_hash:expected.bindings.critical_input_hash,registered_revision:revision,supersedes};}
function state(requestId=current,status='PENDING'){
  const d={owner:expected.owner_id,project_id:expected.run_id,version:expected.versions.checkpoint_version,
    code_version:expected.versions.code_version,sources:expected.sources,
    snapshot:{blueprintEnvelope:{},blueprintApproval:{},graph:{graph_id:expected.bindings.graph_id,revision:expected.bindings.graph_revision},
      proposal:{},semantic:{},semanticProvider:{},projectComposition:{composition_id:expected.bindings.composition_id},
      blueprint_hash:expected.bindings.blueprint_hash,graph_hash:expected.bindings.graph_hash},
    families:{WORKED:{focus:'WORKED',code_version:expected.versions.code_version,
      input_hash:expected.bindings.critical_input_hash,request_id:requestId,status}},finished:false};
  if(status==='COMPLETED'){
    d.families.WORKED.result={rows:[],provider:{request_id:requestId,focus:'WORKED'}};
    d.families.WORKED.result_hash='f'.repeat(64);
  }
  const payload=JSON.stringify({digest:sha(JSON.stringify(d)),data:d});
  return {revision:2,bindings:expected.bindings,versions:expected.versions,
    payload,payload_sha256:sha(payload),finished:false,resumable:true};
}
const evaluate=(ops,checkpoint=state())=>assessStage7Recovery({expected,state:checkpoint,registeredOperations:ops});
const assertBlocked=(got,reason)=>{assert.equal(got.status,'BLOCKED');assert.equal(got.next_action,reason);assert.equal(got.provider_call_allowed,false)};

test('confirmed 503 followed by newly registered PENDING safely retains superseded history',()=>{
  const r=evaluate([reg(prior,1),reg(current,2,prior)]);
  assert.equal(r.status,'UNKNOWN_OUTCOME');assert.equal(r.next_action,'RECONCILE_SAME_REQUEST_ID_NO_AUTOMATIC_RETRY');
  assert.equal(r.provider_call_allowed,false);
});
test('completed retry chain may reach curricular revalidation only, never provider dispatch',()=>{
  const r=evaluate([reg(prior,1),reg(current,2,prior)],state(current,'COMPLETED'));
  assert.equal(r.status,'SNAPSHOT_AVAILABLE');assert.equal(r.provider_call_allowed,false);
});
test('forking an earlier operation into two different request IDs is rejected',()=>{
  const r=evaluate([reg(prior,1),reg(current,2,prior),reg(alternate,2,prior)]);
  assertBlocked(r,'DURABLE_OPERATION_HISTORY_INVALID');
});
test('missing superseded ancestor or disconnected cycle are rejected',()=>{
  const missing=evaluate([reg(current,2,prior)]);
  assertBlocked(missing,'DURABLE_OPERATION_HISTORY_INVALID');
  const cycle=evaluate([reg(prior,1,current),reg(current,2,prior)]);
  assertBlocked(cycle,'DURABLE_OPERATION_HISTORY_INVALID');
});
test('retry must preserve code_version and critical input hash',()=>{
  const changedCode=reg(current,2,prior);changedCode.code_version='0'.repeat(64);
  assertBlocked(evaluate([reg(prior,1),changedCode]),'DURABLE_OPERATION_HISTORY_INVALID');
  const changedInput=reg(current,2,prior);changedInput.input_hash='0'.repeat(64);
  assertBlocked(evaluate([reg(prior,1),changedInput]),'DURABLE_OPERATION_HISTORY_INVALID');
});
test('registered revisions must increase along the chain',()=>{
  assertBlocked(evaluate([reg(prior,2),reg(current,2,prior)]),'DURABLE_OPERATION_HISTORY_INVALID');
  assertBlocked(evaluate([reg(prior,3),reg(current,2,prior)]),'DURABLE_OPERATION_HISTORY_INVALID');
});
test('duplicate request IDs never count as separate durable registration',()=>{
  const r=evaluate([reg(current,2),reg(current,2)]);
  assertBlocked(r,'DURABLE_OPERATION_NOT_UNIQUE');
});
