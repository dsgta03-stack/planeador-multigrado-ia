import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCandidate,MAX_CANDIDATE_CHARS} from '../edge/provider-output.mjs';
import {transportSchema} from '../transport-schema.mjs';
import {assertContract,schemaErrors,schemaFor,hash} from '../contracts.mjs';
import {blueprintGate} from '../gate.mjs';
import {callProvider} from '../provider.mjs';
import {generateShadow} from '../shadow.mjs';
const input=JSON.parse(readFileSync(new URL('../fixtures/PB-010.json',import.meta.url)));
const {blueprint,...sources}=input.input;
const response=text=>({candidates:[{content:{parts:[{text}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:4,totalTokenCount:14}});
const meta={model:'gemini-3.5-flash-lite',latency_ms:12};
test('200 valid JSON parses exactly, with finish reason and usage',()=>{
 const p=parseCandidate(response(JSON.stringify(blueprint)),meta);
 assert.equal(p.http_status,200);assert.deepEqual(p.body.output,blueprint);assert.equal(p.body.finish_reason,'STOP');assert.equal(p.body.usage.totalTokenCount,14);
 assertContract('ProjectBlueprintV1',p.body.output);
});
test('200 invalid JSON is preserved verbatim, never repaired or unavailable',()=>{
 const raw='{"broken":1,}';const p=parseCandidate(response(raw),meta);
 assert.equal(p.http_status,502);assert.equal(p.body.code,'PROVIDER_OUTPUT_INVALID_JSON');assert.equal(p.body.provider_status,200);
 assert.equal(p.body.raw_candidate_text,raw);assert.equal(p.body.text_length,raw.length);assert.equal(p.body.text_truncated,false);assert.equal(p.body.finish_reason,'STOP');assert.equal(p.body.usageMetadata.totalTokenCount,14);assert(p.body.parse_error);assert(!('output' in p.body));
});
test('raw diagnostics are bounded and known credentials are redacted',()=>{
 const p=parseCandidate(response('private-secret '+ 'x'.repeat(MAX_CANDIDATE_CHARS)),{...meta,secrets:['private-secret']});
 assert(p.body.text_truncated);assert(!JSON.stringify(p).includes('private-secret'));assert(p.body.raw_candidate_text.includes('[REDACTED]'));
});
test('invalid output makes one transport attempt, no Blueprint and no pedagogical repair',async()=>{
 const prev=process.env.MULTIPLAN_SHADOW_RUN;process.env.MULTIPLAN_SHADOW_RUN='1';let n=0;
 try{
 const parsed=parseCandidate(response('{bad,'),meta);
 const result=await generateShadow(sources,{},async(task,src)=>callProvider(task,src,{model:meta.model,endpoint:'https://example.test/plan-project-blueprint-v1-shadow',token:'mock-only',fetchImpl:async(_url,req)=>{
  n++;const body=JSON.parse(req.body);assert(body.response_schema);assert.equal(body.model,meta.model);
  return {ok:false,status:502,json:async()=>parsed.body};
 }}));
 assert.equal(n,1);assert.equal(result.status,'PROVIDER_OUTPUT_INVALID_JSON');assert.equal(result.repair_count,0);assert.equal(result.revisions.length,0);assert.equal(result.blueprint,null);
 assert.equal(result.telemetry[0].attempts[0].provider_diagnostics.raw_candidate_text,'{bad,');assert.equal(result.telemetry[0].usage.totalTokenCount,14);
 }finally{if(prev===undefined)delete process.env.MULTIPLAN_SHADOW_RUN;else process.env.MULTIPLAN_SHADOW_RUN=prev}
});
test('transport accepts a valid Blueprint but does not replace full domain or Gate',()=>{
 const before=hash(schemaFor('ProjectBlueprintV1')),s=transportSchema(sources);
 assert.deepEqual(schemaErrors(blueprint,s),[]);assertContract('ProjectBlueprintV1',blueprint);
 assert.equal(s.properties.session_progression.minItems,sources.constraints.requested_sessions);assert.equal(s.properties.session_progression.maxItems,sources.constraints.requested_sessions);
 const bad=structuredClone(blueprint);bad.source.constraints_hash='invalid-hash';
 assert.deepEqual(schemaErrors(bad,s),[]);assert.throws(()=>assertContract('ProjectBlueprintV1',bad));
 const semanticBad=structuredClone(blueprint);semanticBad.grade_contributions[0].integration_destination='unknown';
 assertContract('ProjectBlueprintV1',semanticBad);assert(blueprintGate({...sources,blueprint:semanticBad}).deterministic_findings.some(f=>f.rule_id==='BPD-005'&&f.status==='FAIL'));
 assert.equal(hash(schemaFor('ProjectBlueprintV1')),before);
});
test('failed repair transport preserves revision 1 and creates no revision 2 or repair count',async()=>{
 let calls=0;const result=await generateShadow(sources,{},async()=>{
  if(++calls===1)return {output:{...blueprint,unknown:'invalid domain'},telemetry:{}};
  const e=Error('invalid JSON');e.code='PROVIDER_OUTPUT_INVALID_JSON';throw e;
 });
 assert.equal(calls,2);assert.equal(result.revisions.length,1);assert.equal(result.repair_count,0);assert.equal(result.status,'PROVIDER_OUTPUT_INVALID_JSON');
});
