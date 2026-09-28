import {constructionPlan} from '../project-blueprint-v1/construction.mjs';
import {runShadowPipeline} from './pipeline.mjs';
import {SESSION_PROVIDER_MODEL} from './session-provider.mjs';
import {createSessionGraphDriversSplitCritical} from './session-provider-split-critical.mjs';
import {
 makeItinerancySemanticAdversarial,
 SESSION_GRAPH_ADVERSARIAL_VERSION
} from '../session-graph-v1/adversarial.mjs';

export const LIVE_SHADOW_ADVERSARIAL_RUNNER_VERSION='MULTIPLAN_LIVE_SHADOW_ADVERSARIAL_V1';

export async function runLiveShadowAdversarial({
 sources,
 endpoint,
 token,
 identity='multiplan-blueprint-shadow-adversarial-v1',
 model=SESSION_PROVIDER_MODEL,
 evidenceDirectory=null,
 graphId=null,
 fetchImpl=fetch,
 sleep
}={}){
 if(process.env.MULTIPLAN_SHADOW_RUN!=='1'||process.env.NODE_ENV==='production'){
  throw Error('PIPELINE_SHADOW_RUN_NOT_EXPLICIT_OR_PRODUCTION');
 }
 if(model!==SESSION_PROVIDER_MODEL)throw Error('PIPELINE_MODEL_LOCKED');

 const plan=constructionPlan(sources);
 const sessionDrivers=createSessionGraphDriversSplitCritical({
  endpoint,
  token,
  identity,
  model,
  durableEvidence:true,
  fetchImpl,
  ...(sleep?{sleep}:{})
 });

 const adversarialAuthor=async input=>{
  const authored=await sessionDrivers.sessionAuthor(input);

  if(authored?.status==='BLUEPRINT_REVISION_REQUIRED')return authored;

  const proposal=authored?.proposal??authored?.output??authored;
  if(!proposal||typeof proposal!=='object'){
   throw Error('ADVERSARIAL_SOURCE_PROPOSAL_REQUIRED');
  }

  return {
   proposal:makeItinerancySemanticAdversarial(proposal)
  };
 };

 const result=await runShadowPipeline({
  sources,
  drivers:{
   sessionAuthor:adversarialAuthor,
   sessionReview:sessionDrivers.sessionReview,
   sessionCriticalReview:sessionDrivers.sessionCriticalReview
  },
  options:{
   graphId:graphId||undefined,
   maxSessionRepairs:0,
   blueprintOptions:{
    endpoint,
    token,
    identity,
    model,
    constructionPlan:plan,
    authoringCompact:true,
    durableEvidence:true,
    evidenceDirectory,
    fetchImpl,
    ...(sleep?{sleep}:{})
   }
  }
 });

 return Object.freeze({
  ...result,
  runtime:{
   runner_version:LIVE_SHADOW_ADVERSARIAL_RUNNER_VERSION,
   adversarial_version:SESSION_GRAPH_ADVERSARIAL_VERSION,
   session_provider:sessionDrivers.diagnostics()
  }
 });
}