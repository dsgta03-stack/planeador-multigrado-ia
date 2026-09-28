import {hash,constraintsHash,snapshotHash} from '../project-blueprint-v1/contracts.mjs';
import {constructionPlan} from '../project-blueprint-v1/construction.mjs';
import {generateShadow} from '../project-blueprint-v1/shadow.mjs';
import {callProvider} from '../project-blueprint-v1/provider.mjs';
import {
 runShadowPipeline,
 blueprintApprovalFromEnvelope
} from './pipeline.mjs';
import {compileSessionGraph} from '../session-graph-v1/session-graph.mjs';
import {
 makeItinerancySemanticAdversarial,
 SESSION_GRAPH_ADVERSARIAL_VERSION
} from '../session-graph-v1/adversarial.mjs';
import {SESSION_PROVIDER_MODEL} from './session-provider.mjs';
import {createSessionGraphDriversSplitCritical} from './session-provider-split-critical.mjs';

const EXPECTED_BLUEPRINT_HASH =
 '001f3d41e1be2f11b86f36e47f1ed2c6d673ba83664eb8f357bdf284f6421335';

const CANONICAL_REPAIR_ID =
 'sessiongraph-repair-7be94d39-eb3a-40d2-9ab7-007899647b81';

const BLUEPRINT_EVIDENCE_IDS = [
 CANONICAL_REPAIR_ID,
 '1a188863-a7b5-483c-90de-02a4ee71a9ba',
 'd824482e-ecea-4d9c-9542-36baedbdd613',
 'cd6f2a06-52ae-4c16-a19f-642eec5c3087',
 '2b6e2684-7a8b-4af1-a24f-eb591fd0abdf',
 'cc45f21f-d7c5-4c70-ac27-02a1b3fead6c'
];

const EVIDENCE_PARTS = [
 'request.json',
 'result.json',
 'parsed.json',
 'received.json'
];

const e=process.env;
const k=e.SUPABASE_SECRET_KEY;

if(!k) throw Error('SUPABASE_SECRET_KEY_MISSING');
if(process.env.MULTIPLAN_SHADOW_RUN!=='1'||process.env.NODE_ENV==='production'){
 throw Error('PIPELINE_SHADOW_RUN_NOT_EXPLICIT_OR_PRODUCTION');
}

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

function storageUrl(bucket,path){
 return e.SUPABASE_PROJECT_URL+
  '/storage/v1/object/authenticated/'+
  encodeURIComponent(bucket)+'/'+
  path.split('/').map(encodeURIComponent).join('/');
}

async function fetchStorageJson(bucket,path,{required=false}={}){
 const r=await nativeFetch(
  storageUrl(bucket,path),
  {headers:{apikey:k}}
 );

 if(!r.ok){
  if(required) throw Error('EVIDENCE_FETCH_HTTP_'+r.status+'_'+path);
  return null;
 }

 return r.json();
}

function collect(root,predicate,out=[],seen=new Set()){
 if(root===null||root===undefined) return out;

 if(typeof root==='string'){
  const text=root.trim();

  if(
   (text.startsWith('{')&&text.endsWith('}')) ||
   (text.startsWith('[')&&text.endsWith(']'))
  ){
   try{
    collect(JSON.parse(text),predicate,out,seen);
   }catch{}
  }

  return out;
 }

 if(typeof root!=='object'||seen.has(root)) return out;

 seen.add(root);

 if(predicate(root)) out.push(root);

 for(const value of Array.isArray(root)?root:Object.values(root)){
  collect(value,predicate,out,seen);
 }

 return out;
}

function distinctByHash(values){
 const m=new Map();
 for(const value of values){
  try{m.set(hash(value),value);}catch{}
 }
 return [...m.values()];
}

/* -------- source bundle -------- */

const sourcePayload=await fetchStorageJson(
 e.SHADOW_EVIDENCE_BUCKET,
 e.SHADOW_SOURCE_OBJECT,
 {required:true}
);

const seenSources=new Set();

function findSources(x){
 if(!x||typeof x!=='object'||seenSources.has(x)) return null;
 seenSources.add(x);

 if(x.constraints&&x.curriculum&&x.methodology){
  return {
   constraints:x.constraints,
   curriculum:x.curriculum,
   methodology:x.methodology
  };
 }

 for(const value of Array.isArray(x)?x:Object.values(x)){
  const found=findSources(value);
  if(found) return found;
 }

 return null;
}

const sources=findSources(sourcePayload);
if(!sources) throw Error('SOURCE_BUNDLE_NOT_FOUND');

const sourceHashes={
 constraints:constraintsHash(sources.constraints),
 curriculum:snapshotHash(sources.curriculum),
 methodology:hash(sources.methodology)
};

const expectedSourceHashes={
 constraints:e.SHADOW_EXPECTED_CONSTRAINTS_HASH,
 curriculum:e.SHADOW_EXPECTED_CURRICULUM_HASH,
 methodology:e.SHADOW_EXPECTED_METHODOLOGY_HASH
};

for(const key of Object.keys(expectedSourceHashes)){
 if(sourceHashes[key]!==expectedSourceHashes[key]){
  throw Error('SOURCE_HASH_MISMATCH_'+key);
 }
}

console.log('SOURCE_PREFLIGHT_PASS '+JSON.stringify(sourceHashes));

/* -------- rebuild Blueprint from canonical durable GENERATE output -------- */

const CANONICAL_GENERATE_ID =
 '1a188863-a7b5-483c-90de-02a4ee71a9ba';

const EXPECTED_AUTHORING_HASH =
 '16887b3192c096f1e70a2bafd020ed7957dd812395fbbe48d877e24e995fd374';

const generateEvidence=await fetchStorageJson(
 e.SHADOW_EVIDENCE_BUCKET,
 CANONICAL_GENERATE_ID+'/result.json',
 {required:true}
);

const canonicalAuthoring=generateEvidence?.body?.output;

if(!canonicalAuthoring||typeof canonicalAuthoring!=='object'){
 throw Error('CANONICAL_AUTHORING_OUTPUT_NOT_FOUND');
}

if(hash(canonicalAuthoring)!==EXPECTED_AUTHORING_HASH){
 throw Error('CANONICAL_AUTHORING_HASH_MISMATCH');
}

console.log(
 'CANONICAL_AUTHORING_RECOVERED '+
 JSON.stringify({hash:hash(canonicalAuthoring)})
);

const plan=constructionPlan(sources);

const blueprintReplayProvider=async(task,input,options)=>{
 if(task==='GENERATE'){
  return {
   output:structuredClone(canonicalAuthoring),
   telemetry:{
    task:'GENERATE_REPLAY',
    provider:'durable_evidence',
    model:SESSION_PROVIDER_MODEL,
    prompt_version:'CANONICAL_DURABLE_REPLAY_V1',
    input_hash:null,
    output_hash:hash(canonicalAuthoring),
    latency_ms:0
   }
  };
 }

 if(task==='REPAIR'){
  const error=Error('CANONICAL_BLUEPRINT_REPAIR_FORBIDDEN');
  error.code='CANONICAL_BLUEPRINT_REPAIR_FORBIDDEN';
  throw error;
 }

 if(task==='REVIEW'){
  const audit={audit_version:'LOCAL_EVIDENCE_V1'};
  const calls=[];
  for(const reviewFocus of ['GLOBAL','PDA','STAGES','METHOD']){
   const r=await callProvider('REVIEW',input,{...options,reviewFocus});
   Object.assign(audit,r.output);
   calls.push(r.telemetry);
  }
  return {
   output:audit,
   telemetry:{
    task:'REVIEW',
    provider:'google',
    model:calls[0]?.model??SESSION_PROVIDER_MODEL,
    prompt_version:calls[0]?.prompt_version??'PROJECT_BLUEPRINT_REVIEW_REPLAY_V1',
    input_hash:null,
    output_hash:hash(audit),
    latency_ms:calls.reduce((n,c)=>n+(c.latency_ms||0),0),
    calls
   }
  };
 }

 throw Error('UNEXPECTED_BLUEPRINT_TASK_'+task);
};

const blueprintEnvelope=await generateShadow(
 sources,
 {
  endpoint:e.SHADOW_PROVIDER_ENDPOINT,
  token:k,
  identity:'multiplan-canonical-adversarial-blueprint-replay-v1',
  model:SESSION_PROVIDER_MODEL,
  constructionPlan:plan,
  authoringCompact:true,
  durableEvidence:true,
  fetchImpl:globalThis.fetch
 },
 blueprintReplayProvider
);

if(blueprintEnvelope.status!=='APPROVED'){
 throw Error(
  'REBUILT_BLUEPRINT_NOT_APPROVED_'+blueprintEnvelope.status
 );
}

const blueprint=blueprintEnvelope.blueprint;
const replayBlueprintHash=hash(blueprint);

console.log(
 'REBUILT_BLUEPRINT_APPROVED '+
 JSON.stringify({
  original_certified_hash:EXPECTED_BLUEPRINT_HASH,
  replay_blueprint_hash:replayBlueprintHash,
  authoring_hash:EXPECTED_AUTHORING_HASH
 })
);

const approval=blueprintApprovalFromEnvelope(blueprintEnvelope);

const source={
 ...sources,
 blueprint,
 approval
};

/* -------- recover exact repaired SessionGraph proposal -------- */

const proposalCandidates=[];

for(const part of EVIDENCE_PARTS){
 const doc=await fetchStorageJson(
  e.SHADOW_EVIDENCE_BUCKET,
  CANONICAL_REPAIR_ID+'/'+part
 );

 if(!doc) continue;

 collect(
  doc,
  value=>
   value?.authoring_version==='SESSION_GRAPH_AUTHORING_V1' &&
   Array.isArray(value.sessions),
  proposalCandidates
 );
}

const proposals=distinctByHash(proposalCandidates);
const validProposals=[];

for(const proposal of proposals){
 try{
  const compiled=compileSessionGraph(
   proposal,
   source,
   {
    graph_id:'canonical-positive-replay-preflight-v1',
    revision:1
   }
  );

  validProposals.push({
   proposal,
   proposal_hash:hash(proposal),
   graph_hash:hash(compiled.graph)
  });
 }catch{}
}

if(validProposals.length!==1){
 throw Error(
  'CANONICAL_PROPOSAL_NOT_UNIQUE_valid_'+
  validProposals.length+
  '_candidates_'+proposals.length
 );
}

const positive=validProposals[0];

console.log(
 'CANONICAL_POSITIVE_PROPOSAL_VALID '+
 JSON.stringify({
  proposal_hash:positive.proposal_hash,
  replay_graph_hash:positive.graph_hash
 })
);

/* -------- inject exactly one semantic adversarial defect -------- */

const adversarialProposal=
 makeItinerancySemanticAdversarial(positive.proposal);

if(hash(adversarialProposal)===positive.proposal_hash){
 throw Error('ADVERSARIAL_DID_NOT_CHANGE_PROPOSAL');
}

/* The adversarial MUST remain structurally compilable. */

const adversarialPreflight=compileSessionGraph(
 adversarialProposal,
 source,
 {
  graph_id:'canonical-adversarial-preflight-v1',
  revision:1
 }
);

console.log(
 'ADVERSARIAL_STRUCTURAL_PREFLIGHT_PASS '+
 JSON.stringify({
  adversarial_version:SESSION_GRAPH_ADVERSARIAL_VERSION,
  proposal_hash:hash(adversarialProposal),
  graph_hash:hash(adversarialPreflight.graph)
 })
);

/* -------- real semantic reviewers; no author and no repair -------- */

const sessionDrivers=createSessionGraphDriversSplitCritical({
 endpoint:e.SHADOW_PROVIDER_ENDPOINT,
 token:k,
 identity:'multiplan-canonical-adversarial-replay-v1',
 model:SESSION_PROVIDER_MODEL,
 durableEvidence:true,
 fetchImpl:globalThis.fetch
});

const result=await runShadowPipeline({
 sources,
 drivers:{
  blueprintRunner:async()=>blueprintEnvelope,
  sessionAuthor:async()=>({proposal:adversarialProposal}),
  sessionReview:sessionDrivers.sessionReview,
  sessionCriticalReview:sessionDrivers.sessionCriticalReview
 },
 options:{
  graphId:'canonical-adversarial-live-v1',
  maxSessionRepairs:0
 }
});

const summary={
 status:result.status,
 model:SESSION_PROVIDER_MODEL,
 original_positive_blueprint_hash:EXPECTED_BLUEPRINT_HASH,
 reconstructed_blueprint_hash:replayBlueprintHash,
 canonical_authoring_hash:EXPECTED_AUTHORING_HASH,
 positive_proposal_hash:positive.proposal_hash,
 adversarial_proposal_hash:hash(adversarialProposal),
 adversarial_version:SESSION_GRAPH_ADVERSARIAL_VERSION,
 session_graph_hash:result.session_graph?hash(result.session_graph):null,
 teacher_plan_hash:result.teacher_plan?hash(result.teacher_plan):null,
 teacher_plan_present:Boolean(result.teacher_plan),
 repair_count:result.repair_count,
 session_gate:result.session_gate?.status||null,
 critical_gate:result.session_critical_gate?.status||null,
 stages:result.stages,
 errors:result.errors,
 runtime:{
  session_provider:sessionDrivers.diagnostics()
 }
};

console.log(
 'CANONICAL_ADVERSARIAL_SUMMARY '+
 JSON.stringify(summary)
);

const compilePassed=
 result.stages.some(
  stage=>
   stage.stage==='SESSION_COMPILE' &&
   stage.status==='PASS'
 );

const semanticRejected=
 summary.session_gate==='FAIL' ||
 summary.critical_gate==='FAIL';

const certified=
 result.status==='SESSION_GRAPH_REJECTED' &&
 compilePassed &&
 semanticRejected &&
 result.repair_count===0 &&
 !result.teacher_plan &&
 !result.stages.some(
  stage=>stage.stage==='TEACHER_PROJECTION'
 );

if(!certified){
 console.error('CANONICAL_ADVERSARIAL_NOT_CERTIFIED');
 process.exitCode=2;
}else{
 console.log('CANONICAL_ADVERSARIAL_CERTIFIED');
}



