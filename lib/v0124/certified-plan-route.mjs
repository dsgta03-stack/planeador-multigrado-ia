import {runCertifiedV0124Pipeline} from './certified-pipeline.mjs';
import {toV0124TeacherProjectionView,assertV0124TeacherProjectionView} from './teacher-projection-view.mjs';
import {assertRenderablePresentationEnvelope} from '../../shadow/presentation-v1/presentation-gateway.mjs';
import {assertFinalPlanSnapshot} from '../../shadow/presentation-v1/final-plan-snapshot.mjs';
import {PIPELINE_UI_STATES} from '../../shadow/presentation-v1/teacher-plan-view.mjs';

export const CERTIFIED_PIPELINE_MODE='CERTIFIED_R2';
export const CERTIFIED_PLAN_HTTP_STATUS=Object.freeze({
 NEEDS_TEACHER_INPUT:422,
 BLUEPRINT_NOT_APPROVED:409,
 BLUEPRINT_STAGE_FAILED:503,
 BLUEPRINT_REVISION_REQUIRED:409,
 SESSION_AUTHOR_DRIVER_REQUIRED:503,
 SESSION_AUTHORING_FAILED:503,
 SESSION_GRAPH_CONTRACT_REJECTED:422,
 SESSION_REVIEW_UNAVAILABLE:503,
 SESSION_GRAPH_REJECTED:422,
 SESSION_REPAIR_FAILED:503,
 PIPELINE_RUNNER_UNAVAILABLE:503,
 SHADOW_ERROR:503,
 READY_FOR_TEACHER:200
});

const unknownDescriptor=Object.freeze({kind:'error',title:'Estado no reconocido',message:'El pipeline devolvió un estado no reconocido. No se mostrará una planeación final.',retryable:false});
const descriptorFor=status=>structuredClone(PIPELINE_UI_STATES[status]||unknownDescriptor);
const safeStatus=status=>typeof status==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(status)?status:'UNKNOWN';
const repairCount=value=>Number.isInteger(value)&&value>=0?value:0;
const body=(status,renderable,view_model,repair_count)=>({
 pipeline_mode:CERTIFIED_PIPELINE_MODE,
 status,
 renderable,
 view_model,
 descriptor:descriptorFor(status),
 repair_count:repairCount(repair_count)
});
const closedError=()=>({http_status:503,body:body('SHADOW_ERROR',false,null,0)});

/** Converts a PresentationGateway envelope into an HTTP-shaped value, without a server. */
export function buildCertifiedPlanHttpResponse(envelope,{viewModelFactory=toV0124TeacherProjectionView}={}){
 const status=safeStatus(envelope?.status);
 if(status==='READY_FOR_TEACHER'){
  try{
   assertRenderablePresentationEnvelope(envelope);
   assertFinalPlanSnapshot(envelope.final_snapshot);
   const model=viewModelFactory(envelope.teacher_plan_view);
   assertV0124TeacherProjectionView(model);
   const view=envelope.teacher_plan_view,snapshot=envelope.final_snapshot;
   if(model.source.view_hash!==view.view_hash||
      model.source.projection_hash!==view.source.projection_hash||
      model.source.projection_hash!==snapshot.source.projection_hash||
      model.source.approved_blueprint_hash!==snapshot.source.approved_blueprint_hash||
      model.source.approved_graph_hash!==snapshot.source.approved_graph_hash||
      model.source.constraints_hash!==snapshot.source.constraints_hash)throw Error('CERTIFIED_HTTP_SOURCE_HASH_MISMATCH');
   return {http_status:200,body:body(status,true,model,envelope.repair_count)};
  }catch{return closedError();}
 }
 return {
  http_status:CERTIFIED_PLAN_HTTP_STATUS[status]||500,
  body:body(status,false,null,envelope?.repair_count)
 };
}

/** Caller supplies the request values; provider, network, server and storage stay outside. */
export function createCertifiedPlanRoute({curriculumLookup,pipelineRunner}={}){
 return async function handleCertifiedPlan({body:requestBody,authorization=null,teacherContextBinding=null,pipelineEvidence=null,createdAt}={}){
  try{
   const envelope=await runCertifiedV0124Pipeline({body:requestBody,curriculumLookup,pipelineRunner,authorization,teacherContextBinding,pipelineEvidence,createdAt});
   return buildCertifiedPlanHttpResponse(envelope);
  }catch{return closedError();}
 };
}
