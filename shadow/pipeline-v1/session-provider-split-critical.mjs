import {randomUUID} from 'node:crypto';
import {createSessionGraphDrivers,SESSION_PROVIDER_MODEL,SESSION_PROVIDER_VERSION,SHADOW_PROMPT_VERSION} from './session-provider.mjs';
import {criticalAuditResponseShape} from './critical-audit.mjs';

export const SESSION_CRITICAL_REVIEW_MODE='SPLIT_LITERAL_V1';

const GROUPS=Object.freeze([
 {focus:'WORKED',claim_key:'worked',result_key:'worked_audits'},
 {focus:'METHODOLOGY',claim_key:'methodology_links',result_key:'methodology_link_audits'},
 {focus:'FUNCTIONAL',claim_key:'functional_links',result_key:'functional_link_audits'}
]);

const FOCUS_INSTRUCTIONS=Object.freeze({
 WORKED:'Audita SOLO los claims WORKED recibidos. Evalúa cada PDA oficial como conjunción de todos sus componentes y usa únicamente student_action de esa misma fila. Para explicar+proponer exige explicación observable y propuesta explícita de un acuerdo concreto. Para indagar+compartir exige fuente u observación concreta, procesamiento o contraste, registro trazable y socialización explícita. No evalúes operaciones metodológicas ni requisitos funcionales.',
 METHODOLOGY:'Audita SOLO los claims METHODOLOGY recibidos. IGNORA por completo PDA, estados WORKED/DEVELOPING y requisitos funcionales. Evalúa exclusivamente claim.semantics.required contra claim.semantics.not_enough usando la acción local de la actividad. COMPRENSION_Y_PRODUCCION es PASS cuando la misma actividad procesa o comprende información Y produce, construye o transforma un componente concreto; no exijas explicar+proponer ni ningún otro componente de un PDA salvo que aparezca literalmente en claim.semantics.required. DIFUSION requiere comunicación real a audiencia; RECONOCIMIENTO requiere reconocimiento o revisión observable; cada operación se juzga sólo por su propio contrato semántico. Para una fila PASS, exact_quote DEBE ser una subcadena literal y contigua tomada exclusivamente de claim.common_student_action o claim.grade_actions[].student_action. Nunca uses claim.output, claim.evidence, título, producto o evidencia como exact_quote metodológico.',
 FUNCTIONAL:'Audita SOLO los claims FUNCTIONAL recibidos. IGNORA PDA, estados WORKED/DEVELOPING y etiquetas metodológicas. Evalúa únicamente si la misma actividad ejecuta el requirement_id y produce evidencia local pertinente en una etapa autorizada. at_least_two_viable_spaces_or_audiences exige uso real de dos espacios o audiencias; circulation_evidence exige circulación ya realizada y registrada; movement exige desplazamiento; relocation_or_reinstallation reinstalación; mediation interacción explicativa; mounting montaje físico; piece_explanation explicación real de piezas. Para una fila PASS, action_quote DEBE ser una subcadena literal y contigua tomada exclusivamente de claim.common_student_action o claim.grade_actions[].student_action. evidence_quote DEBE ser una subcadena literal y contigua tomada de claim.output, claim.evidence o claim.grade_actions[].evidence. Nunca copies output o evidence dentro de action_quote.'
});

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
const literalValues=values=>[...new Set(values.filter(value=>typeof value==='string'&&value.trim().length>0))];

const functionalAuditShape=claims=>{
 const shape=structuredClone(criticalAuditResponseShape.properties.functional_link_audits);
 const items=shape.items;
 const actionQuotes=literalValues(claims.flatMap(claim=>[
  claim.common_student_action,
  ...(claim.grade_actions||[]).map(row=>row.student_action)
 ]));
 const evidenceQuotes=literalValues(claims.flatMap(claim=>[
  claim.output,
  claim.evidence,
  ...(claim.grade_actions||[]).map(row=>row.evidence)
 ]));
 items.properties.requirement_id.enum=literalValues(claims.map(claim=>claim.requirement_id));
 items.properties.activity_id.enum=literalValues(claims.map(claim=>claim.activity_id));
 items.properties.status.enum=['PASS','FAIL'];
 items.properties.action_quote.enum=['',...actionQuotes];
 items.properties.evidence_quote.enum=['',...evidenceQuotes];
 return shape;
};

const partialShape=(resultKey,claims)=>({
 type:'object',
 properties:{
  input_hash:{type:'string'},
  [resultKey]:resultKey==='functional_link_audits'
   ?functionalAuditShape(claims)
   :structuredClone(criticalAuditResponseShape.properties[resultKey])
 },
 required:['input_hash',resultKey]
});
function assertSplitConfig({endpoint,token,identity,model}){
 if(typeof endpoint!=='string'||!endpoint.startsWith('https://'))throw Error('SESSION_PROVIDER_SHADOW_ENDPOINT_REQUIRED');
 if(typeof token!=='string'||token.length<40)throw Error('SESSION_PROVIDER_SHADOW_TOKEN_REQUIRED');
 if(typeof identity!=='string'||!identity)throw Error('SESSION_PROVIDER_SHADOW_IDENTITY_REQUIRED');
 if(model!==SESSION_PROVIDER_MODEL)throw Error('SESSION_PROVIDER_MODEL_LOCKED');
}

export function createSplitCriticalReview({endpoint,token,identity='multiplan-blueprint-shadow-test-v1',model=SESSION_PROVIDER_MODEL,durableEvidence=true,pollIntervalMs=3000,maxPolls=90,minIntervalMs=8200,fetchImpl=fetch,sleep=sleepDefault}={}){
 assertSplitConfig({endpoint,token,identity,model});
 let logicalCalls=0,lastStart=0;

 async function callGroup(group,{input,request}){
  const delay=lastStart+minIntervalMs-Date.now();
  if(delay>0)await sleep(delay);
  lastStart=Date.now();
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
    instruction:FOCUS_INSTRUCTIONS[group.focus],
    review_focus:group.focus,
    quote_policy:'Para cada PASS copia una cita CORTA, CONTIGUA y EXACTA de los campos del claim recibido. No resumas, no normalices, no unas fragmentos y no uses puntos suspensivos. Si no existe una cita literal que demuestre el claim, marca FAIL; nunca fabriques una cita aproximada.',
    claims:{[group.claim_key]:claims},
    output_contract:{input_hash:'repeat exact input_hash',[group.result_key]:request.output_contract?.[group.result_key]||`exactly one row per ${group.focus} claim`}
   },
   input:{constraints:input.constraints,curriculum:input.curriculum,methodology:input.methodology,blueprint:input.blueprint,graph:input.graph},
   response_schema:partialShape(group.result_key,claims),
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
 return Object.freeze({sessionCriticalReview,diagnostics:()=>({mode:SESSION_CRITICAL_REVIEW_MODE,model,logical_calls:logicalCalls,durable_evidence:durableEvidence,min_interval_ms:minIntervalMs})});
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
