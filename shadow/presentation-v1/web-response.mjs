import {deepFreeze} from '../project-blueprint-v1/contracts.mjs';
import {buildTeacherPresentationEnvelope} from './presentation-gateway.mjs';

export const WEB_PRESENTATION_RESPONSE_VERSION='WEB_PRESENTATION_RESPONSE_V1';

const HTTP_BY_KIND=Object.freeze({ready:200,teacher_input:422,blocked:409,rejected:422,error:503});

/**
 * Deterministic HTTP-facing response contract for the future web integration.
 * It never exposes a plan payload unless PresentationGateway declares it renderable.
 */
export function buildWebPresentationResponse(input={}){
 const envelope=buildTeacherPresentationEnvelope(input);
 const kind=envelope.descriptor?.kind||'error';
 const http_status=HTTP_BY_KIND[kind]||500;
 const body={
  response_version:WEB_PRESENTATION_RESPONSE_VERSION,
  status:envelope.status,
  renderable:envelope.renderable,
  ui:{
   kind,
   title:envelope.descriptor?.title||'Estado del planeador',
   message:envelope.descriptor?.message||'No se generó una planeación final.',
   retryable:envelope.descriptor?.retryable===true
  },
  repair_count:envelope.repair_count,
  pipeline_version:envelope.pipeline_version,
  ...(envelope.renderable?{
   plan:envelope.teacher_plan_view,
   snapshot:envelope.final_snapshot
  }:{
   plan:null,
   snapshot:null
  })
 };
 return deepFreeze({http_status,body});
}

export function assertWebPresentationResponse(response){
 if(!response||!Number.isInteger(response.http_status)||!response.body||response.body.response_version!==WEB_PRESENTATION_RESPONSE_VERSION)throw Error('WEB_PRESENTATION_RESPONSE_INVALID');
 if(response.body.renderable===true){
  if(response.http_status!==200||response.body.status!=='READY_FOR_TEACHER'||!response.body.plan||!response.body.snapshot)throw Error('WEB_PRESENTATION_READY_CONTRACT_INVALID');
 }else if(response.body.plan!==null||response.body.snapshot!==null){
  throw Error('WEB_PRESENTATION_FAIL_CLOSED_VIOLATION');
 }
 return true;
}
