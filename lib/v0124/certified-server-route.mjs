import {createCertifiedPipelineRunner} from './certified-runtime.mjs';
import {createCertifiedPlanRoute} from './certified-plan-route.mjs';
import {createSupabaseCurriculumLookup} from '../../shadow/router-integration-v1/supabase-curriculum.mjs';

// The public project URL is the one already used by v0.12.4 history and review.
// The publishable key and provider credentials are supplied by the environment.
const PROJECT_SUPABASE_URL='https://dvcrwzxznuqongutnifn.supabase.co';
const closed=(json,res,status,code)=>json(res,status,{code});

/** Mountable HTTP boundary. Constructing this handler has no network or provider effects. */
export function createCertifiedServerRoute({
 env=process.env,readBody,bearer,json,
 runtimeFactory=createCertifiedPipelineRunner,
 planRouteFactory=createCertifiedPlanRoute,
 curriculumLookupFactory=createSupabaseCurriculumLookup,
 fetchImpl=fetch
}={}){
 if(typeof readBody!=='function'||typeof bearer!=='function'||typeof json!=='function')
  throw Error('CERTIFIED_HTTP_HELPERS_REQUIRED');
 return async function handleCertifiedServerRoute(req,res){
  // This branch must precede all request parsing and dependency construction.
  if(env.MULTIPLAN_CERTIFIED_R2_ENABLED!=='1')return closed(json,res,404,'CERTIFIED_ROUTE_DISABLED');
  if(req.method!=='POST')return closed(json,res,405,'METHOD_NOT_ALLOWED');
  const authorization=bearer(req);
  if(typeof authorization!=='string'||!/^Bearer \S+$/.test(authorization))
   return closed(json,res,401,'USER_AUTHORIZATION_REQUIRED');
  let body;
  try{body=JSON.parse((await readBody(req))||'{}');}
  catch(error){return closed(json,res,String(error?.message).includes('PAYLOAD_TOO_LARGE')?413:400,
   String(error?.message).includes('PAYLOAD_TOO_LARGE')?'PAYLOAD_TOO_LARGE':'INVALID_JSON');}
  try{
   const pipelineRunner=runtimeFactory({
    endpoint:env.MULTIPLAN_CERTIFIED_R2_ENDPOINT,
    token:env.MULTIPLAN_CERTIFIED_R2_TOKEN,
    identity:env.MULTIPLAN_CERTIFIED_R2_IDENTITY,
    fetchImpl
   });
   const curriculumLookup=curriculumLookupFactory({
    url:PROJECT_SUPABASE_URL,
    publishableKey:env.SUPABASE_PUBLISHABLE_KEY,
    authorization,
    fetchImpl
   });
   const route=planRouteFactory({curriculumLookup,pipelineRunner});
   const result=await route({body,authorization});
   if(!Number.isInteger(result?.http_status)||result.http_status<100||result.http_status>599||!result.body)
    throw Error('CERTIFIED_ROUTE_RESPONSE_INVALID');
   if(result.http_status===200&&(result.body.status!=='READY_FOR_TEACHER'||result.body.renderable!==true||!result.body.view_model))
    throw Error('CERTIFIED_ROUTE_SUCCESS_INVALID');
   return json(res,result.http_status,result.body);
  }catch{
   // Neither configuration errors nor provider exceptions may expose secrets.
   return closed(json,res,503,'CERTIFIED_ROUTE_UNAVAILABLE');
  }
 };
}
