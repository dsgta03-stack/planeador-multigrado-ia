import {randomUUID} from 'node:crypto';
import {createSessionGraphDrivers,SESSION_PROVIDER_MODEL,SESSION_PROVIDER_VERSION,SHADOW_PROMPT_VERSION} from './session-provider.mjs';
import {criticalAuditResponseShape} from './critical-audit.mjs';

export const SESSION_CRITICAL_REVIEW_MODE='SPLIT_LITERAL_V1';

const GROUPS=Object.freeze([
 {focus:'WORKED',claim_key:'worked',result_key:'worked_audits'},
 {focus:'METHODOLOGY',claim_key:'methodology_links',result_key:'methodology_link_audits'},
 {focus:'FUNCTIONAL',claim_key:'functional_links',result_key:'functional_link_audits'}
]);

const sleepDefault=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const providerError=(payload,status)=>{
 const e=Error(payload?.provider_message||payload?.message||payload?.code||`SESSION_PROVIDER_HTTP_${status}`);
 e.code=payload?.code||'SESSION_PROVIDER_ERROR';
 e.provider_status=payload?.provider_status||status;
 e.provider_error_status=payload?.provider_error_status||null;
 return e;
};
const outputFromPayload=payload=>{
 if(!payload||typeof payload!=='object'||!payload.output||typeof payload.output!=='object')throw providerError(payload,200);
 return payload.output;
};
const partialShape=resultKey=>({
 type:'object',
 properties:{input_hash:{type:'string'},[resultKey]:structuredClone(criticalAuditResponseShape.properties[resultKey])},
 required:['input_hash',resultKey]
});

function assertSplitConfig({endpoint,token,identity,model}){
 if(typeof endpoint!=='string'||!endpoint.startsWith('https://'))throw Error('SESSION_PROVIDER_SHADOW_ENDPOINT_REQUIRED');
 if(typeof token!=='string'||token.length<40)throw Error('SESSION_PROVIDER_SHADOW_TOKEN_REQUIRED');
 if(typeof identity!=='string'||!identity)throw Error('SESSION_PROVIDER_SHADOW_IDENTITY_REQUIRED');
 if(model!==SESSION_PROVIDER_MODEL)throw Error('SESSION_PROVIDER_MODEL_LOCKED');
}

export function createSplitCriticalReview({endpoint,token,identity='multiplan-blueprint-shadow-test-v1',model=SESSION_PROVIDER_MODEL,durableEvidence=true,pollIntervalMs=3000,maxPolls=90,fetchImpl=fetch,sleep=sleepDefault}={}){
 assertSplitConfig({endpoint,token,identity,model});
 let logicalCalls=0;

 async function callGroup(group,{input,request}){
  logicalCalls++;
  const request_id=durableEvidence?`sessiongraph-review-${group.focus.toLowerCase()}-${randomUUID()}`:null;
  const claims=request?.claims?.[group.claim_key];
  if(!Array.isArray(claims))throw Error(`SESSION_CRITICAL_${group.focus}_CLAIMS_REQUIRED`);
  const body={
   task:'REVIEW',
   prompt_version:SHADOW_PROMPT_VERSION,
   model,
   system:'Eres un auditor semántico literal y adversarial. Evalúa exclusivamente la familia de claims indicada. No repares, no infieras acciones ausentes, no compenses un vínculo falso con otra actividad y no parafrasees evidencia.',
   prompt:{
    provider_version:SESSION_PROVIDER_VERSION,
    audit_version:request.audit_version,
    input_hash:request.input_hash,
    instruction:request.instruction,
    review_focus:group.focus,
    quote_policy:'Para cada PASS copia una cita CORTA, CONTIGUA y EXACTA de los campos del claim recibido. No resumas, no normalices, no unas fragmentos y no uses puntos suspensivos. Si no existe una cita literal que demuestre el claim, marca FAIL; nunca fabriques una cita aproximada.',
    claims:{[group.claim_key]:claims},
    output_contract:{input_hash:'repeat exact input_hash',[group.result_key]:request.output_contract?.[group.result_key]||`exactly one row per ${group.focus} claim`}
   },
   input:{claims:{[group.claim_key]:claims}},
   response_schema:partialShape(group.result_key),
   input_hash:request.input_hash,
   ...(request_id?{request_id}:{})
  };
  const response=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`,'x-shadow-identity':identity},body:JSON.stringify(body),signal:AbortSignal.timeout(210000)});
  let payload=await response.json();
  if(response.status===202&&request_id){
   if(payload?.request_id!==request_id)throw Error('SESSION_PROVIDER_DURABLE_REQUEST_ID_MISMATCH');
   let saved=null;
   for(let i=0;i<maxPolls;i++){
    await sleep(pollIntervalMs);
    const poll=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`,'x-shadow-identity':identity},body:JSON.stringify({task:'EVIDENCE_READ',request_id,part:'result'}),signal:AbortSignal.timeout(20000)});
    if(poll.status===202)continue;
    if(!poll.ok)throw providerError(await poll.json().catch(()=>({code:'SESSION_PROVIDER_POLL_FAILED'})),poll.status);
    saved=await poll.json();
    break;
   }
   if(!saved)throw Error('SESSION_PROVIDER_DURABLE_RESULT_PENDING');
   if(!(saved.http_status>=200&&saved.http_status<300))throw providerError(saved.body,saved.http_status);
   payload=saved.body;
  }else if(!response.ok)throw providerError(payload,response.status);
  const output=outputFromPayload(payload);
  if(output.input_hash!==request.input_hash)throw Error(`SESSION_CRITICAL_${group.focus}_INPUT_HASH_MISMATCH`);
  if(!Array.isArray(output[group.result_key]))throw Error(`SESSION_CRITICAL_${group.focus}_ROWS_REQUIRED`);
  return {
   rows:output[group.result_key],
   provider:{focus:group.focus,request_id,model,finish_reason:payload.finish_reason||null,usage:payload.usage||payload.usageMetadata||null}
  };
 }

 const sessionCriticalReview=async({input,request})=>{
  if(!request||typeof request.input_hash!=='string'||!request.input_hash)throw Error('SESSION_CRITICAL_REQUEST_HASH_REQUIRED');
  const parts=[];
  for(const group of GROUPS)parts.push(await callGroup(group,{input,request}));
  const audit={
   input_hash:request.input_hash,
   worked_audits:parts[0].rows,
   methodology_link_audits:parts[1].rows,
   functional_link_audits:parts[2].rows
  };
  return {audit,provider:{mode:SESSION_CRITICAL_REVIEW_MODE,model,requests:parts.map(x=>x.provider)}};
 };
 return Object.freeze({sessionCriticalReview,diagnostics:()=>({mode:SESSION_CRITICAL_REVIEW_MODE,model,logical_calls:logicalCalls,durable_evidence:durableEvidence})});
}

export function createSessionGraphDriversSplitCritical(options={}){
 const base=createSessionGraphDrivers(options);
 const critical=createSplitCriticalReview(options);
 return Object.freeze({
  sessionAuthor:base.sessionAuthor,
  sessionRepair:base.sessionRepair,
  sessionReview:base.sessionReview,
  sessionCriticalReview:critical.sessionCriticalReview,
  diagnostics:()=>({
   ...base.diagnostics(),
   critical_review:critical.diagnostics(),
   logical_calls_total:base.diagnostics().logical_calls+critical.diagnostics().logical_calls
  })
 });
}
