import {deepFreeze} from '../../shadow/project-blueprint-v1/contracts.mjs';
import {buildPipelineSourcesFromProductionRequest} from '../../shadow/router-integration-v1/source-adapter.mjs';
import {buildTeacherPresentationEnvelope} from '../../shadow/presentation-v1/presentation-gateway.mjs';

const failure=(status,code,message)=>({
 ...buildTeacherPresentationEnvelope({pipelineResult:{status}}),
 error:{code,message:String(message||code).slice(0,500)}
});

/**
 * Isolated v0.12.4 boundary. The caller injects curriculum and pipeline drivers;
 * this module never generates, repairs, or presents pedagogical content itself.
 */
export async function runCertifiedV0124Pipeline({
 body,curriculumLookup,pipelineRunner,authorization=null,
 teacherContextBinding=null,pipelineEvidence=null,createdAt
}={}){
 let prepared;
 try{
  prepared=await buildPipelineSourcesFromProductionRequest(body,{curriculumLookup});
 }catch(error){
  return failure('SHADOW_ERROR','PIPELINE_SOURCE_BOUNDARY_ERROR',error?.message||error);
 }
 if(prepared.status==='NEEDS_TEACHER_INPUT'){
  return {
   ...buildTeacherPresentationEnvelope({pipelineResult:{status:'NEEDS_TEACHER_INPUT'}}),
   missing_teacher_fields:[...prepared.missing_teacher_fields]
  };
 }
 if(prepared.status!=='READY_FOR_PIPELINE')return failure('SHADOW_ERROR','PIPELINE_SOURCE_NOT_READY',prepared.status);
 if(typeof pipelineRunner!=='function')return failure('PIPELINE_RUNNER_UNAVAILABLE','PIPELINE_RUNNER_REQUIRED','A pipeline runner is required');

 const sources=deepFreeze({
  constraints:prepared.sources.constraints,
  curriculum:prepared.sources.curriculum,
  methodology:prepared.sources.methodology
 });
 let pipelineResult;
 try{
  pipelineResult=await pipelineRunner(sources,{authorization});
 }catch(error){
  return failure('SHADOW_ERROR','PIPELINE_RUNNER_ERROR',error?.message||error);
 }
 try{
  if(pipelineResult?.status==='READY_FOR_TEACHER'&&teacherContextBinding!==null&&teacherContextBinding!==undefined&&teacherContextBinding.constraints_hash!==sources.constraints.constraints_hash){
   return failure('SHADOW_ERROR','TEACHER_CONTEXT_CONSTRAINTS_HASH_MISMATCH','Teacher context is not bound to the validated constraints');
  }
  const envelope=buildTeacherPresentationEnvelope({pipelineResult,teacherContextBinding,pipelineEvidence,createdAt});
  if(envelope.status==='READY_FOR_TEACHER'&&!envelope.renderable){
   return failure('SHADOW_ERROR','TEACHER_PROJECTION_INVALID',envelope.projection_error||'Gateway rejected the projection');
  }
  return envelope;
 }catch(error){
  return failure('SHADOW_ERROR','PRESENTATION_GATEWAY_ERROR',error?.message||error);
 }
}
