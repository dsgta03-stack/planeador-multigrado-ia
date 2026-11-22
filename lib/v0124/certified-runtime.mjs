import {deepFreeze} from '../../shadow/project-blueprint-v1/contracts.mjs';
import {constructionPlan} from '../../shadow/project-blueprint-v1/construction.mjs';
import {runShadowPipeline} from '../../shadow/pipeline-v1/pipeline.mjs';
import {SESSION_PROVIDER_MODEL} from '../../shadow/pipeline-v1/session-provider.mjs';
import {createSessionGraphDriversSplitCritical} from '../../shadow/pipeline-v1/session-provider-split-critical.mjs';
import {createProjectCompositionProvider,PROJECT_COMPOSITION_PROMPT_VERSION} from '../../shadow/project-composition-v1/provider.mjs';

export const CERTIFIED_RUNTIME_VERSION='V0124_CERTIFIED_PIPELINE_RUNTIME_V1';
const ENDPOINT_PATH='/functions/v1/plan-project-blueprint-v1-shadow';

function assertConfig({endpoint,token,identity,model,maxSessionRepairs,fetchImpl,sleep,factories}){
 let parsed;
 try{parsed=new URL(endpoint);}catch{throw Error('CERTIFIED_SHADOW_ENDPOINT_REQUIRED');}
 if(parsed.protocol!=='https:'||parsed.pathname!==ENDPOINT_PATH||parsed.search||parsed.hash||parsed.username||parsed.password)
  throw Error('CERTIFIED_SHADOW_ENDPOINT_REQUIRED');
 if(typeof token!=='string'||token.length<40)throw Error('CERTIFIED_PROVIDER_TOKEN_REQUIRED');
 if(typeof identity!=='string'||!identity.trim())throw Error('CERTIFIED_PROVIDER_IDENTITY_REQUIRED');
 if(model!==SESSION_PROVIDER_MODEL)throw Error('CERTIFIED_MODEL_LOCKED');
 if(maxSessionRepairs!==1)throw Error('CERTIFIED_MAX_SESSION_REPAIRS_LOCKED');
 if(typeof fetchImpl!=='function'||(sleep!==undefined&&typeof sleep!=='function'))throw Error('CERTIFIED_TRANSPORT_INVALID');
 for(const key of ['constructionPlan','createSessionGraphDriversSplitCritical','createProjectCompositionProvider','runShadowPipeline'])
  if(typeof factories[key]!=='function')throw Error('CERTIFIED_FACTORY_INVALID');
}

// Keep provider errors useful, but never expose the provider credential or a
// caller's Authorization header in a pipeline result or its diagnostics.
function redact(value,secrets){
 if(typeof value==='string'){
  let clean=value;
  for(const secret of secrets)if(secret)clean=clean.split(secret).join('[REDACTED]');
  return clean.replace(/\b(Bearer\s+)[^\s,;"']+/gi,'$1[REDACTED]');
 }
 if(Array.isArray(value))return value.map(item=>redact(item,secrets));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value)
  .filter(([key])=>!/(?:^|_)(?:authorization|token|credential|secret)(?:$|_)/i.test(key))
  .map(([key,item])=>[key,redact(item,secrets)]));
 return value;
}

/** Constructing the runner validates configuration but does not create drivers or call a provider. */
export function createCertifiedPipelineRunner({
 endpoint,token,identity,model=SESSION_PROVIDER_MODEL,maxSessionRepairs=1,
 evidenceDirectory=null,graphId=null,fetchImpl=fetch,sleep,
 // Technical injection for deterministic local tests; defaults are the certified modules.
 factories={constructionPlan,createSessionGraphDriversSplitCritical,createProjectCompositionProvider,runShadowPipeline}
}={}){
 assertConfig({endpoint,token,identity,model,maxSessionRepairs,fetchImpl,sleep,factories});
 const transport={endpoint,token,identity,model,durableEvidence:true,fetchImpl,...(sleep?{sleep}:{})};
 return async function certifiedPipelineRunner(sources,{authorization}={}){
  const secrets=[token,authorization].filter(value=>typeof value==='string'&&value);
  try{
  if(!sources||Object.keys(sources).sort().join(',')!=='constraints,curriculum,methodology')
   throw Error('PIPELINE_REQUIRES_EXACT_SOURCE_ARTIFACTS');
  const plan=factories.constructionPlan(sources);
  const sessionDrivers=factories.createSessionGraphDriversSplitCritical(transport);
   const projectCompositionProvider=
    factories.createProjectCompositionProvider({
     invoke:async request=>{
      const requestId=globalThis.crypto.randomUUID();
      const headers={
       'content-type':'application/json',
       authorization:`Bearer ${token}`,
       'x-shadow-identity':identity
      };

      const parseResponse=async response=>{
       try{
        return await response.json();
       }catch{
        throw Error('PROJECT_COMPOSITION_PROVIDER_INVALID_RESPONSE');
       }
      };

      const fail=(payload,status)=>{
       const error=Error(
        payload?.message||
        payload?.error||
        payload?.code||
        `PROJECT_COMPOSITION_PROVIDER_HTTP_${status}`
       );

       if(payload?.code)error.code=payload.code;

       throw error;
      };

      const response=await fetchImpl(
       endpoint,
       {
        method:'POST',
        headers,
        body:JSON.stringify({
         ...request,
         task:'PROJECT_COMPOSITION',
         prompt_version:PROJECT_COMPOSITION_PROMPT_VERSION,
         model,
         request_id:requestId
        }),
        signal:AbortSignal.timeout(210000)
       }
      );

      const accepted=await parseResponse(response);

      if(!response.ok){
       fail(accepted,response.status);
      }

      if(
       response.status!==202||
       accepted?.status!=='ACCEPTED'||
       accepted?.request_id!==requestId
      ){
       throw Error('PROJECT_COMPOSITION_DURABLE_ACCEPTANCE_REQUIRED');
      }

      const wait=
       sleep||
       ((ms)=>new Promise(resolve=>setTimeout(resolve,ms)));

      for(let attempt=0;attempt<210;attempt++){
       if(attempt>0)await wait(1000);

       const poll=await fetchImpl(
        endpoint,
        {
         method:'POST',
         headers,
         body:JSON.stringify({
          task:'EVIDENCE_READ',
          request_id:requestId,
          part:'result'
         }),
         signal:AbortSignal.timeout(30000)
        }
       );

       const saved=await parseResponse(poll);

       if(poll.status===202){
        continue;
       }

       if(!poll.ok){
        fail(saved,poll.status);
       }

       if(
        !saved||
        typeof saved!=='object'||
        !Number.isInteger(saved.http_status)||
        !saved.body||
        typeof saved.body!=='object'
       ){
        throw Error('PROJECT_COMPOSITION_DURABLE_RESULT_INVALID');
       }

       if(
        saved.http_status<200||
        saved.http_status>=300
       ){
        fail(saved.body,saved.http_status);
       }

       return {
        ...saved.body,
        request_id:requestId
       };
      }

      throw Error('PROJECT_COMPOSITION_DURABLE_TIMEOUT');
     }
    });
  const result=await factories.runShadowPipeline({
   sources,
   drivers:{
     projectCompositionProvider,
    sessionAuthor:sessionDrivers.sessionAuthor,
    sessionRepair:sessionDrivers.sessionRepair,
    sessionReview:sessionDrivers.sessionReview,
    sessionCriticalReview:sessionDrivers.sessionCriticalReview
   },
   options:{
    graphId:graphId||undefined,maxSessionRepairs:1,
    blueprintOptions:{...transport,constructionPlan:plan,authoringCompact:true,evidenceDirectory,executionMode:'CERTIFIED_R2'}
   }
  });
  const diagnostics=sessionDrivers.diagnostics();
  return deepFreeze(redact({...result,runtime:{runner_version:CERTIFIED_RUNTIME_VERSION,session_provider:diagnostics}},secrets));
  }catch(error){
   const safe=Error(redact(String(error?.message||error),secrets));
   if(error?.code)safe.code=redact(String(error.code),secrets);
   throw safe;
  }
 }
}
