import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {callProvider} from '../provider.mjs';
import {sources,candidate} from '../fixtures/build.mjs';
import {constructionPlan} from '../construction.mjs';
import {generateShadow} from '../shadow.mjs';
test('compact live protocol polls stored result, records raw response before returning to evaluator',async()=>{
 const old=process.env.MULTIPLAN_SHADOW_RUN;process.env.MULTIPLAN_SHADOW_RUN='1';const dir=mkdtempSync(join(tmpdir(),'shadow-evidence-'));
 const src=sources(),plan=constructionPlan(src);let submitted,generateCalls=0;
 try{const r=await callProvider('GENERATE',src,{endpoint:'https://test.invalid/plan-project-blueprint-v1-shadow',token:'synthetic-auth-only',model:'gemini-3.5-flash-lite',authoringCompact:true,constructionPlan:plan,durableEvidence:true,evidenceDirectory:dir,sleep:async()=>{},fetchImpl:async(url,opts)=>{
  const b=JSON.parse(opts.body);
  if(b.task==='GENERATE'){generateCalls++;submitted=b;return new Response(JSON.stringify({request_id:b.request_id}),{status:202});}
  assert.equal(b.task,'EVIDENCE_READ');return new Response(JSON.stringify(b.part==='result'?{http_status:200,body:{output:{synthetic:true},model:'gemini-3.5-flash-lite',provider_status:200,usage:{totalTokenCount:10},finish_reason:'STOP'}}:{part:b.part,raw:'synthetic received response'}),{status:200});
 }});
 assert.equal(generateCalls,1);assert.equal(r.output.synthetic,true);assert.equal(readdirSync(dir).length,4);assert(!submitted.response_schema.properties.source);assert(!submitted.response_schema.properties.pda_analysis.items.properties.official_text);assert.equal(submitted.prompt.authoring_version,'BLUEPRINT_AUTHORING_COMPACT_V1');assert(submitted.system.includes('sin introducciones'));
 assert(readdirSync(dir).some(x=>x.endsWith('-received.json')));for(const f of readdirSync(dir))assert(!readFileSync(join(dir,f),'utf8').includes('synthetic-auth-only'));
 }finally{rmSync(dir,{recursive:true,force:true});if(old===undefined)delete process.env.MULTIPLAN_SHADOW_RUN;else process.env.MULTIPLAN_SHADOW_RUN=old;}
});
test('construction-mode deterministic failure stops before semantic calls or pedagogical repair',async()=>{
 const src=sources(),plan=constructionPlan(src),b=candidate(src),calls=[];
 // Synthetic authoring, literal evidence is intentionally not a semantic PASS.
 b.project_stages=plan.stages.map((s,i)=>({...b.project_stages[i],stage_id:s.stage_id,estimated_minutes:30}));
 b.construction_evidence=plan.coverage_matrix.map(r=>{const s=b.project_stages.find(s=>s.stage_id===r.stage_id);return {operation:r.operation,stage_id:r.stage_id,student_operation_quote:s.student_operation,evidence_quote:s.expected_output}});
 b.final_outcome.required_resources[0].resource='Unauthorized resource';
 const r=await generateShadow(src,{constructionPlan:plan},async task=>{calls.push(task);return {output:b,telemetry:{task}}});
 assert.deepEqual(calls,['GENERATE']);assert.equal(r.repair_count,0);assert.equal(r.revisions.length,1);assert(r.gate.deterministic_findings.some(x=>x.status!=='PASS'));assert.equal(r.approved_blueprint_hash,null);
});
