import {analyzeLegacyPlanRequest,buildPipelineSourceArtifacts} from '../integration-v1/legacy-request-adapter.mjs';

export const ROUTER_SOURCE_ADAPTER_VERSION='ROUTER_SOURCE_ADAPTER_FAIL_CLOSED_V1';

export function analyzeProductionRequest(body){
  return analyzeLegacyPlanRequest(body);
}

export async function buildPipelineSourcesFromProductionRequest(body,{curriculumLookup}={}){
  const analysis=analyzeLegacyPlanRequest(body);
  if(analysis.status==='NEEDS_TEACHER_INPUT'){
    return Object.freeze({
      status:'NEEDS_TEACHER_INPUT',
      adapter_version:ROUTER_SOURCE_ADAPTER_VERSION,
      missing_teacher_fields:Object.freeze([...analysis.missing_teacher_fields]),
      analysis
    });
  }
  if(analysis.status!=='READY_FOR_CURRICULUM_RESOLUTION')throw Error(`ROUTER_SOURCE_UNEXPECTED_STATUS:${analysis.status}`);
  if(typeof curriculumLookup!=='function')throw Error('CURRICULUM_LOOKUP_REQUIRED');
  const authoritative=await curriculumLookup(analysis.curriculum_query);
  const built=buildPipelineSourceArtifacts(analysis,{
    curriculum_pdas:authoritative?.pdas,
    ltg:Array.isArray(authoritative?.ltg)?authoritative.ltg:[],
    corpus_version_or_provenance:authoritative?.provenance
  });
  return Object.freeze({
    status:'READY_FOR_PIPELINE',
    adapter_version:ROUTER_SOURCE_ADAPTER_VERSION,
    sources:built.sources,
    analysis
  });
}
