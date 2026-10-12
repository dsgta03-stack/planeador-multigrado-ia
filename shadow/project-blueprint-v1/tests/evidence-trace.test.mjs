import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash} from '../contracts.mjs';
import {buildBlueprintEvidenceTrace,assertBlueprintEvidenceTrace,publicBlueprintEvidenceTrace,createBlueprintEvidenceTransport} from '../evidence-trace.mjs';
import {blueprintTraceStore} from '../../../supabase/functions/plan-project-blueprint-v1-shadow/blueprint-trace-store.mjs';
import {generateShadow} from '../shadow.mjs';
import {BPS} from '../catalog.mjs';
const input=JSON.parse(readFileSync(new URL('../fixtures/PB-010.json',import.meta.url))).input;
function fixture(revision=1){
 const blueprint={...structuredClone(input.blueprint),blueprint_id:'blueprint-trace-00001',revision};
 const p=input.curriculum.pdas[0],s=blueprint.project_stages[0];
 const semantic={audit:{audit_version:'LOCAL_EVIDENCE_V1',pda_checks:[{pda_id:p.pda_id,grade:p.grade,stage_ids:[s.stage_id],operation_quote:s.student_operation,artifact_ids:[s.output_artifact_id],evidence_reason:'PRIVATE_EVIDENCE_REASON',bps004:'PASS',bps005:'FAIL'}]},findings:[],telemetry:{calls:[{review_focus:'PDA',input_hash:'pda-input-hash',output_hash:'pda-output-hash',attempts:[{request_id:'pda-request-0000001'}]}]}};
 return {blueprint,semantic,sources:input,composition:{composition_id:'composition-trace-00001'},authorTelemetry:{input_hash:'author-input-hash',output_hash:'author-output-hash',attempts:[{request_id:revision===1?'generate-request-00001':'repair-request-000001'}]},timestamp:'2026-10-12T00:00:00.000Z'};
}
function memoryStore(){const data=new Map();return {data,async setup(){},async put(id,part,value){const key=id+'/'+part+'.json';if(data.has(key))throw Error('IMMUTABLE');data.set(key,structuredClone(value));},async get(id,part){return data.get(id+'/'+part+'.json');},async list(id){return [...data.keys()].filter(k=>k.startsWith(id+'/')).map(k=>({name:k.slice(id.length+1)}));}};}
test('trace binds composition, revision, request IDs, original reviewer statuses and exact private objects',()=>{
 const f=fixture(),before=structuredClone(f),trace=buildBlueprintEvidenceTrace(f),p=trace.pda_evidence_index[0];
 assert.deepEqual(f,before);assert.equal(trace.run_id,null);assert.equal(trace.run_authority,'blueprint_id');assert.equal(trace.composition_id,f.composition.composition_id);assert.equal(trace.blueprint_revision,1);assert.equal(trace.evaluated_blueprint_hash,hash(f.blueprint));assert.equal(trace.semantic_audit_hash,hash(f.semantic.audit));assert.equal(trace.correlations[0].request_id,'generate-request-00001');assert.equal(trace.correlations[1].request_id,'pda-request-0000001');assert.equal(trace.correlations[1].provider_task,'PDA_REVIEW');
 assert.deepEqual(p.stage_ids,f.semantic.audit.pda_checks[0].stage_ids);assert.equal(p.operation_quote,f.blueprint.project_stages[0].student_operation);assert.equal(p.quote_valid,true);assert.deepEqual(p.reviewer_status,{bps004:'PASS',bps005:'FAIL'});assert.equal(p.student_operation_hashes[0].hash,hash(p.operation_quote));assert.equal(p.evidence_reason_hash,hash('PRIVATE_EVIDENCE_REASON'));assert.equal(assertBlueprintEvidenceTrace(trace),trace);assert.throws(()=>{trace.blueprint.revision=9},TypeError);
});
test('quote index records invalid quote; public summary excludes narrative, official text, quotes and prompts',()=>{
 const f=fixture();f.semantic.audit.pda_checks[0].operation_quote='NOT_LITERAL_QUOTE';const trace=buildBlueprintEvidenceTrace(f),publicText=JSON.stringify(publicBlueprintEvidenceTrace(trace));assert.equal(trace.pda_evidence_index[0].quote_valid,false);for(const secret of ['NOT_LITERAL_QUOTE','PRIVATE_EVIDENCE_REASON',f.blueprint.project_stages[0].student_operation,input.curriculum.pdas[0].pda_official])assert.equal(publicText.includes(secret),false);assert.equal(publicText.includes('prompt'),false);
});
test('recover by composition/run/blueprint preserves two immutable revisions and distinct GENERATE/REPAIR',async()=>{
 const store=memoryStore(),repo=blueprintTraceStore(store);
 for(const revision of [1,2])await repo.write(buildBlueprintEvidenceTrace({...fixture(revision),run_id:'existing-run-0000001'}));
 for(const locator of [{composition_id:'composition-trace-00001'},{run_id:'existing-run-0000001'},{blueprint_id:'blueprint-trace-00001'}]){const traces=await repo.recover(locator);assert.deepEqual(traces.map(t=>t.blueprint_revision),[1,2]);assert.deepEqual(traces.map(t=>t.correlations[0].provider_task),['BLUEPRINT_GENERATE','BLUEPRINT_REPAIR']);traces.forEach(assertBlueprintEvidenceTrace);}
 await assert.rejects(repo.write(buildBlueprintEvidenceTrace(fixture())),/IMMUTABLE/);
});
test('changed Blueprint changes hash; recovery rejects mutated private bytes',async()=>{
 const original=buildBlueprintEvidenceTrace(fixture()),f=fixture();f.blueprint.project_stages[0].student_operation+=' Another operation.';assert.notEqual(buildBlueprintEvidenceTrace(f).evaluated_blueprint_hash,original.evaluated_blueprint_hash);
 const tampered=structuredClone(original);tampered.blueprint.project_stages[0].student_operation='mutated';assert.throws(()=>assertBlueprintEvidenceTrace(tampered),/HASH_MISMATCH/);
 const client=createBlueprintEvidenceTransport({endpoint:'https://example.invalid/trace',token:'unused',fetchImpl:async()=>new Response(JSON.stringify({traces:[tampered]}))});await assert.rejects(client.recover({composition_id:original.composition_id}),/HASH_MISMATCH/);
});
test('same simulated inputs and responses preserve gates; storage failure never changes approval',async()=>{
 const sources={constraints:input.constraints,curriculum:input.curriculum,methodology:input.methodology};let saved,logs=[];const old=console.error;
 const provider=async task=>task==='REVIEW'?{output:{findings:Object.keys(BPS).map(rule_id=>({rule_id,status:'PASS',severity:'CRITICAL',scope:'synthetic',observed:'ok',expected:BPS[rule_id]}))},telemetry:{task:'REVIEW'}}:{output:structuredClone(input.blueprint),telemetry:{task,attempts:[{request_id:'generate-request-00001'}]}};
 const baseline=await generateShadow(sources,{},provider);let persisted,failed;
 try{console.error=(...args)=>logs.push(args.join(' '));persisted=await generateShadow(sources,{blueprintEvidenceStore:{async write(trace){saved=trace;}}},provider);failed=await generateShadow(sources,{blueprintEvidenceStore:{async write(){throw Error('SECRET_STORAGE_ERROR')}}},provider);}finally{console.error=old;}
 for(const result of [persisted,failed]){assert.equal(result.status,baseline.status);assert.deepEqual(result.gate.deterministic_findings,baseline.gate.deterministic_findings);assert.deepEqual(result.gate.semantic_findings,baseline.gate.semantic_findings);}
 assert.equal(saved.evaluated_blueprint_hash,persisted.gate.evaluated_blueprint_hash);assert.equal(logs.some(l=>l.includes('SECRET_STORAGE_ERROR')),false);assert.equal(logs.some(l=>l.includes('"persistence_status":"FAILED"')),true);assert.equal(logs.some(l=>l.includes(input.blueprint.project_stages[0].student_operation)),false);
});
