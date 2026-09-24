import {hash,deepFreeze} from '../project-blueprint-v1/contracts.mjs';
import {buildPipelineSourcesFromProductionRequest,requestEligibility} from './source-adapter.mjs';

export const ROUTER_PIPELINE_SHADOW_VERSION='ROUTER_PIPELINE_SHADOW_V1';

const safeError=e=>({code:e?.code||'ERROR',message:String(e?.message||e).slice(0,500),reasons:Array.isArray(e?.reasons)?[...e.reasons]:[]});

/**
 * Non-governing bridge. It never writes or transforms the production plan response.
 * The caller may fire-and-forget this function after the productive plan has already
 * been returned. All authoritative curriculum data is rebuilt server-side.
 */
export async function runRouterPipelineShadow({body,authorization,curriculumLookup,pipelineRunner,sourceRunId=null}={}){
 const eligibility=requestEligibility(body);
 const base={router_shadow_version:ROUTER_PIPELINE_SHADOW_VERSION,source_run_id:sourceRunId||null,eligible:eligibility.eligible,reasons:[...eligibility.reasons]};
 if(!eligibility.eligible)return deepFreeze({...base,status:'SKIPPED_NOT_ELIGIBLE'});
 if(typeof curriculumLookup!=='function')return deepFreeze({...base,status:'SOURCE_LOOKUP_UNAVAILABLE',error:{code:'CURRICULUM_LOOKUP_REQUIRED',message:'curriculumLookup is required',reasons:[]}});
 if(typeof pipelineRunner!=='function')return deepFreeze({...base,status:'PIPELINE_RUNNER_UNAVAILABLE',error:{code:'PIPELINE_RUNNER_REQUIRED',message:'pipelineRunner is required',reasons:[]}});
 try{
  const built=await buildPipelineSourcesFromProductionRequest(body,{curriculumLookup});
  const sourceHash=hash(built.sources);
  const result=await pipelineRunner(deepFreeze(structuredClone(built.sources)),{authorization,sourceRunId,sourceHash});
  const out={...base,status:result?.status||'UNKNOWN',source_hash:sourceHash,blueprint_hash:result?.blueprint_approval?.approved_blueprint_hash||null,graph_hash:result?.session_approval?.approved_graph_hash||null,repair_count:Number(result?.repair_count||0),teacher_projection_ready:result?.status==='READY_FOR_TEACHER',pipeline_version:result?.pipeline_version||null};
  return deepFreeze(out);
 }catch(e){return deepFreeze({...base,status:'SHADOW_ERROR',error:safeError(e)});}
}

export function shadowLogRecord(result,{elapsedMs=null}={}){
 return deepFreeze({event:'pipeline_v1_router_shadow',timestamp:new Date().toISOString(),elapsed_ms:elapsedMs,status:result?.status||'UNKNOWN',eligible:result?.eligible===true,source_run_id:result?.source_run_id||null,source_hash:result?.source_hash||null,blueprint_hash:result?.blueprint_hash||null,graph_hash:result?.graph_hash||null,repair_count:Number(result?.repair_count||0),teacher_projection_ready:result?.teacher_projection_ready===true,error_code:result?.error?.code||null});
}
