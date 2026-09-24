import {constructionPlan} from '../project-blueprint-v1/construction.mjs';
import {runShadowPipeline} from './pipeline.mjs';
import {createSessionGraphDrivers,SESSION_PROVIDER_MODEL} from './session-provider.mjs';

export const LIVE_SHADOW_RUNNER_VERSION='MULTIPLAN_LIVE_SHADOW_RUNNER_V1';

/**
 * Opt-in only. This module wires the already isolated ProjectBlueprint provider
 * to the SessionGraph provider adapter. It has no production route, persistence
 * to plan_runs, UI writer, or legacy-plan input.
 */
export async function runLiveShadowPipeline({sources,endpoint,token,identity='multiplan-blueprint-shadow-test-v1',model=SESSION_PROVIDER_MODEL,evidenceDirectory=null,graphId=null,maxSessionRepairs=1,fetchImpl=fetch,sleep}={}){
 if(process.env.MULTIPLAN_SHADOW_RUN!=='1'||process.env.NODE_ENV==='production')throw Error('PIPELINE_SHADOW_RUN_NOT_EXPLICIT_OR_PRODUCTION');
 if(model!==SESSION_PROVIDER_MODEL)throw Error('PIPELINE_MODEL_LOCKED');
 const plan=constructionPlan(sources);
 const sessionDrivers=createSessionGraphDrivers({endpoint,token,identity,model,durableEvidence:true,fetchImpl,...(sleep?{sleep}:{})});
 const result=await runShadowPipeline({
  sources,
  drivers:{sessionAuthor:sessionDrivers.sessionAuthor,sessionRepair:sessionDrivers.sessionRepair,sessionReview:sessionDrivers.sessionReview,sessionCriticalReview:sessionDrivers.sessionCriticalReview},
  options:{graphId:graphId||undefined,maxSessionRepairs,blueprintOptions:{endpoint,token,identity,model,constructionPlan:plan,authoringCompact:true,durableEvidence:true,evidenceDirectory,fetchImpl,...(sleep?{sleep}:{})}}
 });
 return Object.freeze({...result,runtime:{runner_version:LIVE_SHADOW_RUNNER_VERSION,session_provider:sessionDrivers.diagnostics()}});
}
