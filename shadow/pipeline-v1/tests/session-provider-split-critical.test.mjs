import test from 'node:test';
import assert from 'node:assert/strict';
import {createSplitCriticalReview,SESSION_CRITICAL_REVIEW_MODE} from '../session-provider-split-critical.mjs';

const endpoint='https://example.supabase.co/functions/v1/plan-multiplan-pipeline-v1-shadow';
const token='x'.repeat(64);
const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

const requestFixture=()=>({
 audit_version:'SESSION_CRITICAL_CLAIMS_AUDIT_V1',
 input_hash:'critical-hash',
 instruction:'strict literal audit',
 claims:{
  worked:[{activity_id:'a1',grade:1,pda_id:'p1',student_action:'explica y propone',official_pda:'explica y propone'}],
  methodology_links:[{activity_id:'a2',operation:'DIFUSION',common_student_action:'presenta al grupo',grade_actions:[],output:'presentación',evidence:'registro'}],
  functional_links:[{activity_id:'a3',requirement_id:'mounting',common_student_action:'monta las piezas',grade_actions:[],output:'museo montado',evidence:'piezas montadas'}]
 },
 output_contract:{worked_audits:'one per worked',methodology_link_audits:'one per method',functional_link_audits:'one per functional'}
});

const input={constraints:{},curriculum:{},methodology:{},blueprint:{},graph:{}};

test('split critical review performs three focused calls and merges exact-hash audit',async()=>{
 const sent=[];
 const fetchImpl=async(_url,init)=>{
  const body=JSON.parse(init.body);sent.push(body);
  const focus=body.prompt.review_focus;
  if(focus==='WORKED')return jsonResponse({provider:'google',finish_reason:'STOP',output:{input_hash:'critical-hash',worked_audits:[{activity_id:'a1',grade:1,pda_id:'p1',status:'PASS',component_checks:[{component:'all',satisfied:true,exact_quote:'explica y propone'}],reason:'literal'}]}});
  if(focus==='METHODOLOGY')return jsonResponse({provider:'google',finish_reason:'STOP',output:{input_hash:'critical-hash',methodology_link_audits:[{operation:'DIFUSION',activity_id:'a2',status:'PASS',exact_quote:'presenta al grupo',reason:'literal'}]}});
  if(focus==='FUNCTIONAL')return jsonResponse({provider:'google',finish_reason:'STOP',output:{input_hash:'critical-hash',functional_link_audits:[{requirement_id:'mounting',activity_id:'a3',status:'PASS',action_quote:'monta las piezas',evidence_quote:'piezas montadas',reason:'literal'}]}});
  throw Error(`unexpected focus ${focus}`);
 };
 const driver=createSplitCriticalReview({endpoint,token,durableEvidence:false,minIntervalMs:0,fetchImpl});
 const result=await driver.sessionCriticalReview({input,request:requestFixture()});
 assert.equal(sent.length,3);
 assert.deepEqual(sent.map(x=>x.prompt.review_focus),['WORKED','METHODOLOGY','FUNCTIONAL']);
 assert.ok(sent.every(x=>x.input_hash==='critical-hash'));
 assert.ok(sent.every(x=>['constraints','curriculum','methodology','blueprint','graph'].every(k=>k in x.input)));
 assert.ok(sent.every(x=>!('claims' in x.input)));
 assert.deepEqual(sent.map(x=>Object.keys(x.prompt.claims)),[['worked'],['methodology_links'],['functional_links']]);
 assert.ok(sent.every(x=>x.prompt.instruction!=='strict literal audit'));
 assert.ok(sent[0].prompt.instruction.includes('SOLO los claims WORKED'));
 assert.ok(sent[1].prompt.instruction.includes('SOLO los claims METHODOLOGY'));
 assert.ok(sent[1].prompt.instruction.includes('claim.semantics.required'));
 assert.ok(sent[1].prompt.instruction.includes('COMPRENSION_Y_PRODUCCION'));
 assert.ok(sent[1].prompt.instruction.includes('no exijas explicar+proponer'));
 assert.ok(sent[2].prompt.instruction.includes('SOLO los claims FUNCTIONAL'));
 assert.ok(sent.every(x=>x.prompt.quote_policy.includes('CONTIGUA')&&x.prompt.quote_policy.includes('EXACTA')));
 assert.deepEqual(sent[0].response_schema.required,['input_hash','worked_audits']);
 assert.deepEqual(sent[1].response_schema.required,['input_hash','methodology_link_audits']);
 assert.deepEqual(sent[2].response_schema.required,['input_hash','functional_link_audits']);
 assert.equal(result.audit.input_hash,'critical-hash');
 assert.equal(result.audit.worked_audits.length,1);
 assert.equal(result.audit.methodology_link_audits.length,1);
 assert.equal(result.audit.functional_link_audits.length,1);
 assert.equal(result.provider.mode,SESSION_CRITICAL_REVIEW_MODE);
 assert.equal(result.provider.requests.length,3);
 assert.equal(driver.diagnostics().logical_calls,3);
 assert.equal(driver.diagnostics().min_interval_ms,0);
});

test('split critical review fails closed if any partial audit changes input hash',async()=>{
 let calls=0;
 const fetchImpl=async(_url,init)=>{
  calls++;
  const body=JSON.parse(init.body),focus=body.prompt.review_focus;
  if(focus==='WORKED')return jsonResponse({output:{input_hash:'critical-hash',worked_audits:[]}});
  if(focus==='METHODOLOGY')return jsonResponse({output:{input_hash:'wrong-hash',methodology_link_audits:[]}});
  return jsonResponse({output:{input_hash:'critical-hash',functional_link_audits:[]}});
 };
 const driver=createSplitCriticalReview({endpoint,token,durableEvidence:false,minIntervalMs:0,fetchImpl});
 await assert.rejects(()=>driver.sessionCriticalReview({input,request:{...requestFixture(),claims:{worked:[],methodology_links:[],functional_links:[]}}}),/SESSION_CRITICAL_METHODOLOGY_INPUT_HASH_MISMATCH/);
 assert.equal(calls,2);
});
