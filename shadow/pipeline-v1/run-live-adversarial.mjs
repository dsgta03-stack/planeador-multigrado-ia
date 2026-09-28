import {runLiveShadowAdversarial} from './live-adversarial.mjs';
import {constraintsHash,snapshotHash,hash} from '../project-blueprint-v1/contracts.mjs';

const e=process.env;
const k=e.SUPABASE_SECRET_KEY;
if(!k) throw Error('SUPABASE_SECRET_KEY_MISSING');

const nativeFetch=globalThis.fetch;

globalThis.fetch=async(url,...args)=>{
 const req=typeof args[0]==='object'?args[0]:{};
 if(
  url===e.SHADOW_PROVIDER_ENDPOINT &&
  req.headers?.authorization?.startsWith('Bearer ') &&
  req.headers.authorization.includes(k)
 ){
  delete req.headers.authorization;
  req.headers.apikey=k;
 }
 return nativeFetch(url,...args);
};

const p=e.SHADOW_SOURCE_OBJECT.split('/').map(encodeURIComponent).join('/');
const u=
 e.SUPABASE_PROJECT_URL+
 '/storage/v1/object/authenticated/'+
 encodeURIComponent(e.SHADOW_EVIDENCE_BUCKET)+
 '/'+p;

const r=await nativeFetch(u,{headers:{apikey:k}});
if(!r.ok) throw Error('SOURCE_FETCH_HTTP_'+r.status);

const payload=await r.json();
const seen=new Set();

function findSources(x){
 if(!x||typeof x!=='object'||seen.has(x))return null;
 seen.add(x);

 if(x.constraints&&x.curriculum&&x.methodology){
  return {
   constraints:x.constraints,
   curriculum:x.curriculum,
   methodology:x.methodology
  };
 }

 for(const v of Array.isArray(x)?x:Object.values(x)){
  const f=findSources(v);
  if(f)return f;
 }
 return null;
}

const sources=findSources(payload);
if(!sources)throw Error('SOURCE_BUNDLE_NOT_FOUND');

const got={
 constraints:constraintsHash(sources.constraints),
 curriculum:snapshotHash(sources.curriculum),
 methodology:hash(sources.methodology)
};

const expected={
 constraints:e.SHADOW_EXPECTED_CONSTRAINTS_HASH,
 curriculum:e.SHADOW_EXPECTED_CURRICULUM_HASH,
 methodology:e.SHADOW_EXPECTED_METHODOLOGY_HASH
};

for(const key of Object.keys(expected)){
 if(got[key]!==expected[key]){
  throw Error('SOURCE_HASH_MISMATCH_'+key+'_'+got[key]);
 }
}

console.log('SOURCE_PREFLIGHT_PASS '+JSON.stringify(got));

const result=await runLiveShadowAdversarial({
 sources,
 endpoint:e.SHADOW_PROVIDER_ENDPOINT,
 token:k,
 model:'gemini-3.5-flash-lite'
});

const summary={
 status:result.status,
 model:'gemini-3.5-flash-lite',
 adversarial_version:result.runtime?.adversarial_version||null,
 blueprint_hash:result.blueprint?hash(result.blueprint):null,
 session_graph_hash:result.session_graph?hash(result.session_graph):null,
 teacher_plan_hash:result.teacher_plan?hash(result.teacher_plan):null,
 teacher_plan_present:Boolean(result.teacher_plan),
 repair_count:result.repair_count,
 session_gate:result.session_gate?.status||null,
 critical_gate:result.session_critical_gate?.status||null,
 stages:result.stages,
 errors:result.errors,
 runtime:result.runtime
};

console.log('ADVERSARIAL_SUMMARY '+JSON.stringify(summary));

const certified=
 result.status==='SESSION_GRAPH_REJECTED' &&
 !result.teacher_plan &&
 result.repair_count===0 &&
 !result.stages.some(x=>x.stage==='TEACHER_PROJECTION') &&
 result.stages.some(
  x=>
   (x.stage==='SESSION_GATE'||x.stage==='SESSION_CRITICAL_GATE') &&
   x.status==='FAIL'
 );

if(!certified){
 console.error('ADVERSARIAL_NOT_CERTIFIED');
 process.exitCode=2;
}else{
 console.log('ADVERSARIAL_CERTIFIED');
}