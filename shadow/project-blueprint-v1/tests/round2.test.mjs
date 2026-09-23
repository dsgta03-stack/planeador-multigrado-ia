import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {callProvider} from '../provider.mjs';
import {generationSchema} from '../generation-schema.mjs';
import {applyEvidenceAudit,localEvidenceInput} from '../semantic-evidence.mjs';
import {generateShadow} from '../shadow.mjs';
const input=()=>JSON.parse(readFileSync(new URL('../fixtures/PB-010.json',import.meta.url))).input;
const withEnv=async fn=>{const run=process.env.MULTIPLAN_SHADOW_RUN,env=process.env.NODE_ENV;try{process.env.MULTIPLAN_SHADOW_RUN='1';process.env.NODE_ENV='test';await fn()}finally{if(run===undefined)delete process.env.MULTIPLAN_SHADOW_RUN;else process.env.MULTIPLAN_SHADOW_RUN=run;if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env}};
const options={endpoint:'https://example.test/plan-project-blueprint-v1-shadow',token:'synthetic-unit-test-token'};
test('503 retry bounded with backoff, identical requests and complete attempt telemetry',()=>withEnv(async()=>{
 let calls=0;const bodies=[],delays=[];
 const r=await callProvider('GENERATE',input(),{...options,sleep:async ms=>delays.push(ms),fetchImpl:async(url,req)=>{bodies.push(req.body);calls++;return calls<3?{ok:false,status:502,json:async()=>({code:'PROVIDER_ERROR',provider_status:503})}:{ok:true,status:200,json:async()=>({output:{value:'synthetic'},usage:{totalTokenCount:1}})}}});
 assert.equal(calls,3);assert.deepEqual(delays,[1000,2000]);assert.equal(new Set(bodies).size,1);assert.equal(r.telemetry.attempts.length,3);assert.equal(r.telemetry.attempts[0].output_hash,null);
}));
test('exhausted 503 is PROVIDER_UNAVAILABLE and never invents output',()=>withEnv(async()=>{
 let calls=0;await assert.rejects(callProvider('GENERATE',input(),{...options,sleep:async()=>{},fetchImpl:async()=>{calls++;return{ok:false,status:502,json:async()=>({provider_status:503})}}}),e=>e.code==='PROVIDER_UNAVAILABLE'&&e.telemetry.output_hash===null&&e.telemetry.attempts.length===3);assert.equal(calls,3);
}));
test('ambiguous network timeout is not replayed',()=>withEnv(async()=>{
 let calls=0;await assert.rejects(callProvider('GENERATE',input(),{...options,fetchImpl:async()=>{calls++;throw Error('timeout')}}),e=>e.code==='PROVIDER_UNAVAILABLE'&&e.telemetry.attempts[0].outcome==='UNKNOWN');assert.equal(calls,1);
}));
test('authorization failure is not retried or mislabeled pedagogy/unavailable',()=>withEnv(async()=>{
 let calls=0;await assert.rejects(callProvider('GENERATE',input(),{...options,fetchImpl:async()=>{calls++;return{ok:false,status:401,json:async()=>({code:'SHADOW_AUTH_REQUIRED'})}}}),e=>e.code==='SHADOW_AUTH_REQUIRED');assert.equal(calls,1);
}));
test('generation request constrains source, destination, resource and method without changing contract',()=>{
 const x=input(),schema=generationSchema(x),p=schema.properties;
 assert.deepEqual(p.grade_contributions.items.properties.integration_destination.enum,['outcome_01']);
 assert.deepEqual(p.final_outcome.properties.required_resources.items.properties.alternative.anyOf[1].enum,x.constraints.available_resources);
 assert.deepEqual(p.methodology.properties.selected_id.enum,[x.methodology.selected_id]);
 assert.equal(p.session_progression.minItems,x.constraints.requested_sessions);
});
test('local evidence packets contain only PDA-owning grade contributions',()=>{
 const x=input(),packets=localEvidenceInput(x);
 for(const p of packets.pda_units)assert(p.own_grade_contributions.every(c=>c.grade===p.official_pda.grade&&c.pda_ids.includes(p.official_pda.pda_id)));
});
test('local PDA failure cannot be masked by a global PASS for any cognitive action',()=>{
 const x=input();x.curriculum.pdas[0].pda_official='Argumenta una posición con razones';
 const o={findings:[{rule_id:'BPS-004',status:'PASS'}],pda_checks:x.curriculum.pdas.map(p=>({pda_id:p.pda_id,grade:p.grade,bps004:'FAIL',bps005:'FAIL'}))};
 assert.equal(applyEvidenceAudit(x,o).find(f=>f.rule_id==='BPS-004').status,'FAIL');
});
test('missing local proof cannot approve by operation labels alone',()=>{
 const x=input(),o={findings:[{rule_id:'BPS-008',status:'PASS'}],methodology_checks:[]};
 assert.equal(applyEvidenceAudit(x,o).find(f=>f.rule_id==='BPS-008').status,'NOT_EVALUABLE');
});
test('provider exhaustion during review retains candidate and consumes no repair revision',async()=>{
 const {blueprint,...src}=input();
 const r=await generateShadow(src,{},async task=>{if(task==='GENERATE')return{output:blueprint,telemetry:{task}};const e=Error('503');e.code='PROVIDER_UNAVAILABLE';throw e});
 assert.equal(r.status,'PROVIDER_UNAVAILABLE');assert.equal(r.revisions.length,1);assert.equal(r.repair_count,0);assert.equal(r.revisions[0].status,'PROVIDER_UNAVAILABLE');assert.equal(r.approved_blueprint_hash,null);
});
