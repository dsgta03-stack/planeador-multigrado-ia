import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assessStage7Recovery } from '../decision.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');
const expected = {
  owner_id:'00000000-0000-4000-8000-000000000001',
  run_id:'00000000-0000-4000-8000-000000000002',
  sources:{ constraints:{fixture:'LAB'},curriculum:{fixture:'LAB'},methodology:{fixture:'LAB'} },
  bindings:{blueprint_hash:'a'.repeat(64),graph_hash:'b'.repeat(64),sources_hash:'c'.repeat(64),critical_input_hash:'d'.repeat(64),composition_id:'composition-lab',graph_id:'graph-lab',graph_revision:'1'},
  versions:{checkpoint_version:'LOCAL_REVIEW_CHECKPOINT_V1',code_version:'e'.repeat(64)},
};
const request_id='sessiongraph-review-worked-33333333-3333-4333-8333-333333333333';
const op=Object.freeze({family:'WORKED',request_id,input_hash:expected.bindings.critical_input_hash});
const baseData=()=>({owner:expected.owner_id,project_id:expected.run_id,version:expected.versions.checkpoint_version,code_version:expected.versions.code_version,sources:expected.sources,snapshot:{blueprintEnvelope:{fixture:'LAB'},blueprintApproval:{fixture:'LAB'},graph:{graph_id:'graph-lab',revision:'1'},proposal:{},semantic:{},semanticProvider:{},projectComposition:{composition_id:'composition-lab'},blueprint_hash:expected.bindings.blueprint_hash,graph_hash:expected.bindings.graph_hash},families:{},finished:false});
function makeState(data=baseData()) {
  const envelope={digest:sha(JSON.stringify(data)),data};
  const payload=JSON.stringify(envelope);
  return {revision:1,bindings:structuredClone(expected.bindings),versions:structuredClone(expected.versions),finished:data.finished,resumable:true,payload,payload_sha256:sha(payload)};
}
const run=(state,registeredOperations=[])=>assessStage7Recovery({expected,state,registeredOperations});
const check=(got,wanted)=>{assert.equal(got.status,wanted);assert.equal(got.provider_call_allowed,false)};

test('stage 7 shadow recovery is fail closed with no writes or network',()=>{
  const a=run({revision:0,bindings:expected.bindings,versions:expected.versions,payload:null,payload_sha256:null,finished:false});
  check(a,'CHECKPOINT_REQUIRED');assert.equal(a.next_action,'PERSIST_INITIAL_CHECKPOINT_BEFORE_PROVIDER');
  check(assessStage7Recovery({}),'BLOCKED');
  check(run({...makeState(),revision:0}),'BLOCKED');
});
test('recover valid snapshot only for revalidation, never for immediate generation',()=>{
  const s=makeState();check(run(s),'SNAPSHOT_AVAILABLE');
  assert.equal(run(s).next_action,'REVALIDATE_BLUEPRINT_GRAPH_AND_WORKED_GATES');
});
test('fail closed on hash, JSON, owner and source tampering',()=>{
  const a=makeState();a.payload_sha256='f'.repeat(64);assert.equal(run(a).next_action,'CHECKPOINT_SHA256_INVALID');
  const b=makeState();b.payload='not-json';b.payload_sha256=sha(b.payload);assert.equal(run(b).next_action,'CHECKPOINT_JSON_INVALID');
  const c=baseData();c.owner='OTHER';assert.equal(run(makeState(c)).next_action,'CHECKPOINT_IDENTITY_OR_SOURCE_MISMATCH');
  const d=baseData();d.sources={constraints:{},curriculum:{},methodology:{}};assert.equal(run(makeState(d)).next_action,'CHECKPOINT_IDENTITY_OR_SOURCE_MISMATCH');
  const e=baseData();e.snapshot.graph_hash='f'.repeat(64);assert.equal(run(makeState(e)).next_action,'SNAPSHOT_BINDING_OR_STRUCTURE_INVALID');
});
test('reject same-shape binding drift and missing authenticated proof',()=>{
  const a=makeState();a.bindings.graph_hash='0'.repeat(64);assert.equal(run(a).next_action,'BINDINGS_OR_VERSIONS_CHANGED');
  const b=makeState();b.versions.code_version='0'.repeat(64);assert.equal(run(b).next_action,'BINDINGS_OR_VERSIONS_CHANGED');
  const c=makeState();c.resumable=false;assert.equal(run(c).next_action,'SNAPSHOT_NOT_RESUMABLE');
});
function withWorked(status,extra={}) {
  const d=baseData();d.families.WORKED={focus:'WORKED',code_version:expected.versions.code_version,input_hash:expected.bindings.critical_input_hash,request_id,status,...extra};return d;
}
test('PENDING and acknowledged ACCEPTED never allow automatic provider re-invocation',()=>{
  const pending=run(makeState(withWorked('PENDING')),[op]);check(pending,'UNKNOWN_OUTCOME');
  assert.equal(pending.next_action,'RECONCILE_SAME_REQUEST_ID_NO_AUTOMATIC_RETRY');
  check(run(makeState(withWorked('ACCEPTED')),[op]),'IN_FLIGHT');
});
test('missing, duplicate or mismatched durable operation blocks resume',()=>{
  assert.equal(run(makeState(withWorked('PENDING'))).next_action,'DURABLE_OPERATION_NOT_PROVEN');
  assert.equal(run(makeState(withWorked('PENDING')),[{...op,request_id:'different'}]).next_action,'DURABLE_OPERATION_NOT_PROVEN');
  assert.equal(run(makeState(withWorked('PENDING')),[op,op]).next_action,'DURABLE_OPERATION_NOT_UNIQUE');
});
test('FAILED with confirmed 503 requires new registration, not an automatic retry',()=>{
  const d=run(makeState(withWorked('FAILED',{provider_status:'503'})),[op]);check(d,'RETRY_REGISTRATION_REQUIRED');
  assert.match(d.next_action,/SAME_INPUT_HASH_AND_DATABASE_FENCE/);
  assert.equal(run(makeState(withWorked('FAILED',{provider_status:'401'})),[op]).next_action,'NONRETRYABLE_PROVIDER_FAILURE');
  assert.equal(run(makeState(withWorked('FAILED')),[op]).next_action,'NONRETRYABLE_PROVIDER_FAILURE');
});
test('COMPLETED without verified result is blocked; valid result requires pedagogical revalidation',()=>{
  assert.equal(run(makeState(withWorked('COMPLETED')),[op]).next_action,'COMPLETED_REVIEW_NOT_VERIFIED');
  const d=withWorked('COMPLETED',{result:{rows:[],provider:{request_id,focus:'WORKED'}},result_hash:'f'.repeat(64)});
  check(run(makeState(d),[op]),'SNAPSHOT_AVAILABLE');
});
test('reject impossible finished states and any unexpected family',()=>{
  const d=baseData();d.families.UNKNOWN={};assert.equal(run(makeState(d)).next_action,'UNKNOWN_REVIEW_FAMILY');
  const e=baseData();e.finished=true;assert.equal(run(makeState(e)).next_action,'FINAL_REVIEW_INCOMPLETE');
  const f=makeState();f.finished=true;assert.equal(run(f).next_action,'FINISHED_FLAG_MISMATCH');
});