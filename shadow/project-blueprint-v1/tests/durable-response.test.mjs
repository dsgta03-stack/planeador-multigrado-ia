import test from 'node:test';
import assert from 'node:assert/strict';
import {persistProviderResponse} from '../edge/durable-response.mjs';
import {evidenceStore,EVIDENCE_BUCKET} from '../edge/evidence-store.mjs';
const payload=(text,finishReason='STOP')=>JSON.stringify({candidates:[{content:{parts:[{text}]},finishReason}],usageMetadata:{promptTokenCount:7,candidatesTokenCount:11,totalTokenCount:18}});
const base={task:'GENERATE',model:'gemini-3.5-flash-lite',http_status:200,latency_ms:15,max_output_tokens:65536,diagnostic:true};
test('valid provider response persisted BEFORE envelope and candidate parsing; later Gate cannot remove it',async()=>{
 const saved=new Map(),order=[];
 const r=await persistProviderResponse(payload('{"valid":true}'),{...base,persist:async(k,v)=>{order.push(k);saved.set(k,v)},parseEnvelope:raw=>{assert(saved.has('received'));assert.equal(saved.get('received').parse_result,'NOT_ATTEMPTED');order.push('parse');return JSON.parse(raw)}});
 assert.equal(r.body.output.valid,true);assert.deepEqual(order,['received','parse','parsed']);
 assert.throws(()=>{throw Error('LATER_GATE_ERROR')});assert(saved.has('received'));assert.equal(saved.get('parsed').totalTokenCount,18);assert.equal(saved.get('parsed').parse_result,'VALID');
});
test('invalid JSON and MAX_TOKENS retain full candidate, finish, tokens and parse error',async()=>{
 for(const finish of ['STOP','MAX_TOKENS']){const saved={};const text='{"broken":';const r=await persistProviderResponse(payload(text,finish),{...base,persist:async(k,v)=>{saved[k]=v}});
 assert.equal(saved.parsed.candidate_text,text);assert.equal(saved.parsed.text_length,text.length);assert.equal(saved.parsed.finish_reason,finish);assert(saved.parsed.parse_error);assert.equal(saved.parsed.promptTokenCount,7);assert.equal(r.body.code,finish==='STOP'?'PROVIDER_OUTPUT_INVALID_JSON':'BLUEPRINT_OUTPUT_BLOAT');assert(!r.body.output);assert(!('repair_count' in saved.parsed));}
});
test('persist failure prevents parser; no reconstruction or content retry',async()=>{
 let parsed=false;await assert.rejects(()=>persistProviderResponse(payload('{}'),{...base,persist:async()=>{throw Error('DISK_ERROR')},parseEnvelope:()=>{parsed=true}}),/DISK_ERROR/);assert.equal(parsed,false);
});
test('secrets absent from received and parsed durable evidence',async()=>{
 const saved=[],secrets=['api-private-secret-123','shadow-private-token-456','service-role-private-789'];
 await persistProviderResponse(payload(JSON.stringify({text:secrets.join(' ')})),{...base,secrets,persist:async(k,v)=>saved.push(v)});
 for(const secret of secrets)assert(!JSON.stringify(saved).includes(secret));assert(JSON.stringify(saved).includes('[REDACTED]'));
});
test('private storage only, immutable path and no secrets serialized into stored body',async()=>{
 const requests=[];const store=evidenceStore({url:'https://test.invalid',serviceKey:'service-secret',secrets:['shadow-secret'],fetchImpl:async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({public:false}),{status:200})}});
 await store.setup();await store.put('synthetic-request-123','received',{raw:'service-secret shadow-secret'});
 const call=requests.at(-1);assert(call.url.includes(EVIDENCE_BUCKET));assert(!call.options.body.includes('service-secret'));assert(!call.options.body.includes('shadow-secret'));assert.equal(call.options.method,'POST');assert(!call.options.headers['x-upsert']);
 await assert.rejects(()=>store.put('../production','received',{}),/INVALID_EVIDENCE_ID/);
});
