import {parseCandidate,redactSecrets} from './provider-output.mjs';
import { config } from './config.ts';
// A separate, expiring machine identity. Never accepts Supabase user IDs or writes DB.
// Deployment has no production route/import and no access to plan_runs in this code.
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
 if(!config.enabled||Date.now()>config.expiresAt)return json({code:'SHADOW_DISABLED'},403);
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(token.length<40||await sha(token)!==config.tokenHash||req.headers.get('x-shadow-identity')!==config.identity)return json({code:'SHADOW_AUTH_REQUIRED'},401);
 try{
  const raw=await req.text();if(raw.length>500000)return json({code:'PAYLOAD_TOO_LARGE'},413);
  const b=JSON.parse(raw);
  if(!['GENERATE','REPAIR','REVIEW'].includes(b.task)||b.prompt_version!=='PROJECT_BLUEPRINT_SHADOW_V1_R2'||!['gemini-3.1-flash-lite','gemini-3.5-flash-lite','gemini-3.1-pro-preview'].includes(b.model))return json({code:'INVALID_SHADOW_OPERATION'},400);
  if(!b.input||!b.input.constraints||!b.input.curriculum||!b.input.methodology||b.task==='GENERATE'&&b.input.blueprint)return json({code:'INVALID_INPUT'},400);
  if(typeof b.system!=='string'||typeof b.prompt!=='object')return json({code:'INVALID_PROMPT'},400);
  const key=Deno.env.get('Multiplan');if(!key)return json({code:'PROVIDER_KEY_UNAVAILABLE'},503);
  const start=Date.now();
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${b.model}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:b.system}]},contents:[{role:'user',parts:[{text:JSON.stringify(b.prompt)}]}],generationConfig:{temperature:0.15,maxOutputTokens:22000,responseMimeType:'application/json',responseJsonSchema:b.response_schema}}),signal:AbortSignal.timeout(180000)});
  const providerRaw=await response.text();let result:any=null;try{result=JSON.parse(providerRaw)}catch{}
  if(!response.ok){
   const pe=result?.error||{};
   const safe={code:'PROVIDER_ERROR',provider_status:response.status,provider_error_code:pe.code??null,provider_error_status:pe.status??null,provider_message:redactSecrets(pe.message||providerRaw||'',[key,token,req.headers.get('authorization')||'']),retry_after:response.headers.get('retry-after'),request_id:response.headers.get('x-request-id')||response.headers.get('x-goog-request-id')||null,latency_ms:Date.now()-start};
   return json(safe,502);
  }
  if(!result)return json({code:'PROVIDER_INVALID_JSON',provider_status:response.status,latency_ms:Date.now()-start},502);
  const parsed=parseCandidate(result,{model:b.model,latency_ms:Date.now()-start,secrets:[key,token,req.headers.get('authorization')||'']});
  return json(parsed.body,parsed.http_status);
 }catch(e){return json({code:'SHADOW_PROVIDER_ERROR',message:String(e).slice(0,160)},502)}
});
