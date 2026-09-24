import test from 'node:test';
import assert from 'node:assert/strict';
import {outputBudget} from '../edge/output-budget.mjs';
import {parseCandidate} from '../edge/provider-output.mjs';
test('diagnostic 65536 only for Flash35 GENERATE/REPAIR; REVIEW unchanged',()=>{
 for(const task of ['GENERATE','REPAIR']){assert.equal(outputBudget(task,'gemini-3.5-flash-lite',true),65536);assert.equal(outputBudget(task,'gemini-3.5-flash-lite'),22000)}
 assert.equal(outputBudget('REVIEW','gemini-3.5-flash-lite',true),22000);
 assert.equal(outputBudget('GENERATE','another-model',true),22000);
});
test('diagnostic MAX_TOKENS always stops as bloat and retains evidence',()=>{
 const r=parseCandidate({candidates:[{content:{parts:[{text:'{"unfinished":'}]},finishReason:'MAX_TOKENS'}],usageMetadata:{totalTokenCount:65536}},{model:'gemini-3.5-flash-lite',diagnostic:true,max_output_tokens:65536,latency_ms:9});
 assert.equal(r.body.code,'BLUEPRINT_OUTPUT_BLOAT');assert.equal(r.body.max_output_tokens,65536);assert.equal(r.body.raw_candidate_text,'{"unfinished":');assert.equal(r.body.usage.totalTokenCount,65536);assert(!('output' in r.body));
});
