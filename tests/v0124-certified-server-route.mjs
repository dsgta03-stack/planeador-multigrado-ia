import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCertifiedServerRoute} from '../lib/v0124/certified-server-route.mjs';

const json=(res,http_status,body)=>{res.out={http_status,body};};
const setup=({env={},method='POST',authorization='Bearer user-token',raw='{}',...dependencies}={})=>{
 const calls=[];
 const factories={
  runtimeFactory:()=>{calls.push('runtime');return async()=>{throw Error('UNEXPECTED_PROVIDER');};},
  curriculumLookupFactory:()=>{calls.push('lookup');return async()=>{throw Error('UNEXPECTED_CURRICULUM');};},
  planRouteFactory:()=>{calls.push('route');return async()=>({http_status:409,body:{status:'BLUEPRINT_NOT_APPROVED',renderable:false,view_model:null}});},
  fetchImpl:()=>{throw Error('UNEXPECTED_NETWORK');},
  ...dependencies
 };
 const handler=createCertifiedServerRoute({env,readBody:async()=>{calls.push('read');return raw;},bearer:()=>authorization,json,...factories});
 const req={method},res={};
 return {calls,run:async()=>{await handler(req,res);return res.out;}};
};

test('flag absent or not exactly 1 closes before body, runtime, lookup or provider',async()=>{
 for(const value of [undefined,'','0','true','01']){
  const env=value===undefined?{}:{MULTIPLAN_CERTIFIED_R2_ENABLED:value};
  const t=setup({env,method:'GET',authorization:'',raw:'invalid'});
  assert.deepEqual(await t.run(),{http_status:404,body:{code:'CERTIFIED_ROUTE_DISABLED'}});
  assert.deepEqual(t.calls,[]);
 }
});

test('enabled route requires POST and user Bearer before constructing dependencies',async()=>{
 const env={MULTIPLAN_CERTIFIED_R2_ENABLED:'1'};
 const method=setup({env,method:'GET'});
 assert.equal((await method.run()).http_status,405);
 assert.deepEqual(method.calls,[]);
 for(const authorization of ['', 'Basic key','Bearer ',null]){
  const t=setup({env,authorization});
  assert.equal((await t.run()).http_status,401);
  assert.deepEqual(t.calls,[]);
 }
});

test('uses existing body limit helper, rejects invalid JSON and relays route status/body exactly',async()=>{
 const env={MULTIPLAN_CERTIFIED_R2_ENABLED:'1',MULTIPLAN_CERTIFIED_R2_ENDPOINT:'https://example.invalid/plan-project-blueprint-v1-shadow',MULTIPLAN_CERTIFIED_R2_TOKEN:'secret',MULTIPLAN_CERTIFIED_R2_IDENTITY:'identity',SUPABASE_PUBLISHABLE_KEY:'publishable'};
 const invalid=setup({env,raw:'{'});
 assert.deepEqual(await invalid.run(),{http_status:400,body:{code:'INVALID_JSON'}});
 assert.deepEqual(invalid.calls,['read']);
 const expected={status:'SESSION_GRAPH_REJECTED',renderable:false,view_model:null,descriptor:{kind:'blocked'},repair_count:1};
 const calls=[];
 const t=setup({env,raw:'{"pdas":["P1"]}',runtimeFactory:options=>{calls.push(['runtime',options]);return async()=>{};},curriculumLookupFactory:options=>{calls.push(['lookup',options]);return async()=>{};},planRouteFactory:options=>{calls.push(['route',options]);return async args=>{calls.push(['handle',args]);return {http_status:422,body:expected};}}});
 assert.deepEqual(await t.run(),{http_status:422,body:expected});
 assert.deepEqual(calls.map(x=>x[0]),['runtime','lookup','route','handle']);
 assert.equal(calls[0][1].token,'secret');
 assert.equal(calls[1][1].publishableKey,'publishable');
 assert.equal(calls[1][1].authorization,'Bearer user-token');
 assert.deepEqual(calls[3][1],{body:{pdas:['P1']},authorization:'Bearer user-token'});
});

test('422, 409 and 503 remain unchanged; validated READY can pass as 200',async()=>{
 const env={MULTIPLAN_CERTIFIED_R2_ENABLED:'1'};
 for(const [http_status,status] of [[422,'NEEDS_TEACHER_INPUT'],[409,'BLUEPRINT_NOT_APPROVED'],[503,'SESSION_REVIEW_UNAVAILABLE'],[200,'READY_FOR_TEACHER']]){
  const body={pipeline_mode:'CERTIFIED_R2',status,renderable:http_status===200,view_model:http_status===200?{view_model_version:'V0124_CERTIFIED_TEACHER_VIEW_V1'}:null,descriptor:{kind:'status'},repair_count:0};
  const t=setup({env,planRouteFactory:()=>async()=>({http_status,body})});
  assert.deepEqual(await t.run(),{http_status,body});
 }
});

test('unknown state or rejected plan can never pass through as HTTP 200',async()=>{
 const env={MULTIPLAN_CERTIFIED_R2_ENABLED:'1'};
 for(const body of [
  {status:'FUTURE_UNKNOWN',renderable:true,view_model:{}},
  {status:'SESSION_GRAPH_REJECTED',renderable:false,view_model:null},
  {status:'READY_FOR_TEACHER',renderable:false,view_model:{}},
  {status:'READY_FOR_TEACHER',renderable:true,view_model:null}
 ]){
  const t=setup({env,planRouteFactory:()=>async()=>({http_status:200,body})});
  assert.deepEqual(await t.run(),{http_status:503,body:{code:'CERTIFIED_ROUTE_UNAVAILABLE'}});
 }
});

test('oversized payload retains the existing reader protection',async()=>{
 const env={MULTIPLAN_CERTIFIED_R2_ENABLED:'1'};
 let factoryCalls=0;
 const handler=createCertifiedServerRoute({env,readBody:async()=>{throw Error('PAYLOAD_TOO_LARGE');},bearer:()=> 'Bearer user-token',json,runtimeFactory:()=>{factoryCalls++;}});
 const res={};await handler({method:'POST'},res);
 assert.deepEqual(res.out,{http_status:413,body:{code:'PAYLOAD_TOO_LARGE'}});
 assert.equal(factoryCalls,0);
 const server=readFileSync(new URL('../server-v0124-consolidated-shadow.mjs',import.meta.url),'utf8');
 assert.match(server,/function readBody\(req,max=2_500_000\)/);
});

test('enabled configuration errors fail closed without secrets or external calls',async()=>{
 const env={MULTIPLAN_CERTIFIED_R2_ENABLED:'1',MULTIPLAN_CERTIFIED_R2_ENDPOINT:'https://example.invalid/other',MULTIPLAN_CERTIFIED_R2_TOKEN:'secret'};
 let network=0;
 const t=setup({env,runtimeFactory:undefined,curriculumLookupFactory:()=>{throw Error('MUST_NOT_CONSTRUCT');},fetchImpl:()=>{network++;}});
 const out=await t.run();
 assert.deepEqual(out,{http_status:503,body:{code:'CERTIFIED_ROUTE_UNAVAILABLE'}});
 assert.deepEqual(t.calls,['read']);
 assert.equal(network,0);
 assert.ok(!JSON.stringify(out).includes('secret'));
});

test('provider/configuration exception does not expose token or Authorization',async()=>{
 const env={MULTIPLAN_CERTIFIED_R2_ENABLED:'1',MULTIPLAN_CERTIFIED_R2_TOKEN:'sensitive-provider-token'};
 const t=setup({env,runtimeFactory:()=>{throw Error('Bearer sensitive-provider-token Authorization: Bearer user-token');}});
 const out=await t.run();
 assert.deepEqual(out,{http_status:503,body:{code:'CERTIFIED_ROUTE_UNAVAILABLE'}});
 const serialized=JSON.stringify(out);
 for(const secret of ['sensitive-provider-token','Authorization','user-token'])assert.ok(!serialized.includes(secret));
});

test('server intercepts certified path before proxy; legacy generation block remains separate',()=>{
 const server=readFileSync(new URL('../server-v0124-consolidated-shadow.mjs',import.meta.url),'utf8');
 const helper=readFileSync(new URL('../lib/v0124/certified-server-route.mjs',import.meta.url),'utf8');
 assert.match(server,/if\(url\.pathname==="\/api\/certified-plan"\)return certifiedPlanRoute\(req,res\);/);
 assert.ok(server.indexOf('certifiedPlanRoute(req,res)')<server.lastIndexOf('return proxy(req,res)'));
 assert.match(server,/req\.method==="POST"&&url\.pathname==="\/api\/gemini-plan"/);
 assert.match(server,/applyProjectCoherence\(rawPlan\)/);
 assert.match(server,/persistSnapshot\(bearer\(req\),plan\)/);
 for(const forbidden of ['project-coherence.mjs','history-fidelity.mjs','review-cache.mjs','docx-export.mjs','ui.mjs'])
  assert.ok(!helper.includes(forbidden));
});
