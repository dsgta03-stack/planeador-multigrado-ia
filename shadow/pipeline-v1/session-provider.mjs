import {randomUUID} from 'node:crypto';
import {hash} from '../project-blueprint-v1/contracts.mjs';
import {SESSION_GRAPH_AUTHORING_INSTRUCTION,providerAuthoringShapeSchema,validateSessionGraphAuthoring} from '../session-graph-v1/authoring.mjs';
import {SESSION_GRAPH_REVIEW_INSTRUCTION} from '../session-graph-v1/reviewer.mjs';

export const SESSION_PROVIDER_VERSION='SESSION_GRAPH_PROVIDER_V1';
export const SESSION_PROVIDER_MODEL='gemini-3.5-flash-lite';
export const SHADOW_PROMPT_VERSION='PROJECT_BLUEPRINT_SHADOW_V1_R2';

const REVIEW_SHAPE={type:'object',properties:{input_hash:{type:'string'},findings:{type:'array',items:{type:'object',properties:{rule_id:{type:'string'},status:{type:'string'},scope:{type:'string'},observed:{type:'string'},expected:{type:'string'}},required:['rule_id','status','scope','observed','expected']}}},required:['input_hash','findings']};
const sleepDefault=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sourcesOnly=ctx=>({constraints:ctx.sources.constraints,curriculum:ctx.sources.curriculum,methodology:ctx.sources.methodology});
const sessionSource=ctx=>({...sourcesOnly(ctx),blueprint:ctx.blueprint,approval:ctx.approval});
const repairShape=source=>({type:'object',properties:{status:{type:'string'},reason:{type:'string'},proposal:providerAuthoringShapeSchema(source)},required:['status','reason','proposal']});

function assertConfig({endpoint,token,identity,model}){
 if(typeof endpoint!=='string'||!endpoint.startsWith('https://')||!endpoint.endsWith('/plan-project-blueprint-v1-shadow'))throw Error('SESSION_PROVIDER_SHADOW_ENDPOINT_REQUIRED');
 if(typeof token!=='string'||token.length<40)throw Error('SESSION_PROVIDER_SHADOW_TOKEN_REQUIRED');
 if(typeof identity!=='string'||!identity)throw Error('SESSION_PROVIDER_SHADOW_IDENTITY_REQUIRED');
 if(model!==SESSION_PROVIDER_MODEL)throw Error('SESSION_PROVIDER_MODEL_LOCKED');
}

function providerError(payload,status){
 const e=Error(payload?.provider_message||payload?.message||payload?.code||`SESSION_PROVIDER_HTTP_${status}`);
 e.code=payload?.code||'SESSION_PROVIDER_ERROR';
 e.provider_status=payload?.provider_status||status;
 e.provider_error_status=payload?.provider_error_status||null;
 return e;
}

function outputFromPayload(payload){
 if(!payload||typeof payload!=='object'||!payload.output||typeof payload.output!=='object')throw providerError(payload,200);
 return payload.output;
}

export function createSessionGraphDrivers({endpoint,token,identity='multiplan-blueprint-shadow-test-v1',model=SESSION_PROVIDER_MODEL,durableEvidence=true,pollIntervalMs=3000,maxPolls=90,fetchImpl=fetch,sleep=sleepDefault}={}){
 assertConfig({endpoint,token,identity,model});
 let logicalCalls=0;

 async function call(task,{system,prompt,input,response_schema,input_hash=null}){
  logicalCalls++;
  const request_id=durableEvidence?`sessiongraph-${task.toLowerCase()}-${randomUUID()}`:null;
  const body={task,prompt_version:SHADOW_PROMPT_VERSION,model,system,prompt,input,response_schema,input_hash,...(request_id?{request_id}:{})};
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
    saved=await poll.json();break;
   }
   if(!saved)throw Error('SESSION_PROVIDER_DURABLE_RESULT_PENDING');
   if(!(saved.http_status>=200&&saved.http_status<300))throw providerError(saved.body,saved.http_status);
   payload=saved.body;
  }else if(!response.ok)throw providerError(payload,response.status);
  return {payload,request_id,logical_call:logicalCalls};
 }

 const sessionAuthor=async ctx=>{
  const source=sessionSource(ctx);
  const response_schema=providerAuthoringShapeSchema(source);
  const {payload,request_id}=await call('GENERATE',{
   system:'Eres un diseñador experto de secuencias didácticas multigrado de la Nueva Escuela Mexicana. El ProjectBlueprint aprobado es inmutable. Tu autoridad termina en la microarquitectura de actividades.',
   prompt:{provider_version:SESSION_PROVIDER_VERSION,authoring_version:'SESSION_GRAPH_AUTHORING_V1',instruction:SESSION_GRAPH_AUTHORING_INSTRUCTION,approved_blueprint_hash:ctx.approval.approved_blueprint_hash,blueprint:ctx.blueprint,constraints:ctx.sources.constraints,curriculum:ctx.sources.curriculum,methodology:ctx.sources.methodology},
   // The protected Blueprint shadow endpoint forbids blueprint inside GENERATE.input.
   // The immutable Blueprint is therefore prompt context, while input remains the three source artifacts.
   input:sourcesOnly(ctx),response_schema,input_hash:hash({blueprint:ctx.blueprint,approval:ctx.approval,sources:ctx.sources})
  });
  const proposal=outputFromPayload(payload);
  validateSessionGraphAuthoring(proposal,source);
  return {proposal,provider:{request_id,model,finish_reason:payload.finish_reason||null,usage:payload.usage||payload.usageMetadata||null}};
 };

 const sessionRepair=async ctx=>{
  const source=sessionSource(ctx);
  const response_schema=repairShape(source);
  const reasons=ctx.triggering_rules||[ctx.compile_error].filter(Boolean);
  const {payload,request_id}=await call('REPAIR',{
   system:'Eres un arquitecto pedagógico de SessionGraph. Repara sólo la microarquitectura de actividades. No cambies ni reinterpretes el ProjectBlueprint aprobado.',
   prompt:{provider_version:SESSION_PROVIDER_VERSION,authoring_version:'SESSION_GRAPH_AUTHORING_V1',instruction:SESSION_GRAPH_AUTHORING_INSTRUCTION,repair_protocol:{status_values:['PROPOSAL','BLUEPRINT_REVISION_REQUIRED'],rule:'Usa PROPOSAL si puedes corregir la microarquitectura sin cambiar el Blueprint. Usa BLUEPRINT_REVISION_REQUIRED únicamente si existe una contradicción concreta entre el Blueprint aprobado y las restricciones autorizadas que impide construir un SessionGraph válido. En ese caso explica la contradicción en reason y devuelve previous_proposal sin cambios en proposal; no revises el Blueprint.'},repair_instruction:'Corrige únicamente los fallos reportados. Conserva problema, pregunta guía, metodología, PDA, producto, etapas, artefactos, progresión, LTG y presupuesto del ProjectBlueprint. No añadas texto para aparentar PASS.',triggering_rules:reasons,previous_proposal:ctx.previous_proposal,approved_blueprint_hash:ctx.approval.approved_blueprint_hash,blueprint:ctx.blueprint,constraints:ctx.sources.constraints,curriculum:ctx.sources.curriculum,methodology:ctx.sources.methodology},
   input:{...sourcesOnly(ctx),blueprint:ctx.blueprint},response_schema,input_hash:hash({blueprint:ctx.blueprint,previous_proposal:ctx.previous_proposal,reasons})
  });
  const repaired=outputFromPayload(payload);
  if(repaired.status==='BLUEPRINT_REVISION_REQUIRED'){
   if(typeof repaired.reason!=='string'||!repaired.reason.trim())throw Error('SESSION_PROVIDER_REVISION_REASON_REQUIRED');
   return {status:'BLUEPRINT_REVISION_REQUIRED',reason:repaired.reason,provider:{request_id,model,finish_reason:payload.finish_reason||null,usage:payload.usage||payload.usageMetadata||null}};
  }
  if(repaired.status!=='PROPOSAL')throw Error('SESSION_PROVIDER_REPAIR_STATUS_INVALID');
  validateSessionGraphAuthoring(repaired.proposal,source);
  return {proposal:repaired.proposal,provider:{request_id,model,finish_reason:payload.finish_reason||null,usage:payload.usage||payload.usageMetadata||null}};
 };

 const sessionReview=async ({input,request})=>{
  const {payload,request_id}=await call('REVIEW',{
   system:'Eres un revisor pedagógico independiente, literal y estricto. Evalúa el SessionGraph contra el ProjectBlueprint aprobado. No repares ni reescribas.',
   prompt:{provider_version:SESSION_PROVIDER_VERSION,instruction:SESSION_GRAPH_REVIEW_INSTRUCTION,...request},
   input:{constraints:input.constraints,curriculum:input.curriculum,methodology:input.methodology,blueprint:input.blueprint,graph:input.graph},response_schema:REVIEW_SHAPE,input_hash:request.input_hash
  });
  const semantic=outputFromPayload(payload);
  return {semantic,provider:{request_id,model,finish_reason:payload.finish_reason||null,usage:payload.usage||payload.usageMetadata||null}};
 };

 return Object.freeze({sessionAuthor,sessionRepair,sessionReview,diagnostics:()=>({provider_version:SESSION_PROVIDER_VERSION,model,logical_calls:logicalCalls,durable_evidence:durableEvidence})});
}
