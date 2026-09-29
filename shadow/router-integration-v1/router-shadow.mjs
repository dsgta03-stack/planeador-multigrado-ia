import {hash,deepFreeze} from '../project-blueprint-v1/contracts.mjs';
import {buildPipelineSourcesFromProductionRequest} from './source-adapter.mjs';

export const ROUTER_PIPELINE_SHADOW_VERSION='ROUTER_PIPELINE_SHADOW_FAIL_CLOSED_V1';
const safeError=e=>({code:e?.code||'ERROR',message:String(e?.message||e).slice(0,500),reasons:Array.isArray(e?.reasons)?[...e.reasons]:[]});

export async function runRouterPipelineShadow({body,authorization,curriculumLookup,pipelineRunner,sourceRunId=null}={}){
  const base={router_shadow_version:ROUTER_PIPELINE_SHADOW_VERSION,source_run_id:sourceRunId||null};
  if(typeof pipelineRunner!=='function')return deepFreeze({...base,status:'PIPELINE_RUNNER_UNAVAILABLE',eligible:false,error:{code:'PIPELINE_RUNNER_REQUIRED',message:'pipelineRunner is required',reasons:[]}});
  try{
    const prepared=await buildPipelineSourcesFromProductionRequest(body,{curriculumLookup});
    if(prepared.status==='NEEDS_TEACHER_INPUT')return deepFreeze({...base,status:'NEEDS_TEACHER_INPUT',eligible:false,missing_teacher_fields:[...prepared.missing_teacher_fields]});
    const sourceHash=hash(prepared.sources);
    const result=await pipelineRunner(deepFreeze(structuredClone(prepared.sources)),{authorization,sourceRunId,sourceHash});
    return deepFreeze({
      ...base,
      status:result?.status||'UNKNOWN',
      eligible:true,
      source_hash:sourceHash,
      blueprint_hash:result?.blueprint_approval?.approved_blueprint_hash||null,
      graph_hash:result?.session_approval?.approved_graph_hash||null,
      repair_count:Number(result?.repair_count||0),
      pipeline_version:result?.pipeline_version||null
    });
  }catch(e){return deepFreeze({...base,status:'SHADOW_ERROR',eligible:false,error:safeError(e)});}
}

export function shadowLogRecord(result,{elapsedMs=null}={}){
  return deepFreeze({event:'pipeline_v1_router_shadow',timestamp:new Date().toISOString(),elapsed_ms:elapsedMs,status:result?.status||'UNKNOWN',eligible:result?.eligible===true,source_run_id:result?.source_run_id||null,source_hash:result?.source_hash||null,blueprint_hash:result?.blueprint_hash||null,graph_hash:result?.graph_hash||null,repair_count:Number(result?.repair_count||0),error_code:result?.error?.code||null});
}
