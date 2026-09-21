import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V097_CHILD_PORT||4501);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;
const MG5_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-multigrade-didactic-v5";
const STABLE_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-gemini-lab";
const V65_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-methodology-v65-beta4";
const SHADOW_ENABLED=String(process.env.MULTIPLAN_V65_SHADOW_ENABLED||"true").toLowerCase()!=="false";

const child=spawn(process.execPath,["server-v097-v65beta4-shadow.mjs"],{env:{...process.env,PORT:String(CHILD_PORT),MULTIPLAN_V65_SHADOW_ENABLED:"false"},stdio:["ignore","inherit","inherit"]});
let shuttingDown=false;
child.on("exit",(code,signal)=>{console.error(`[v098] child v0.9.7 exited code=${code} signal=${signal}`);if(!shuttingDown)setTimeout(()=>process.exit(code||1),50)});
for(const sig of ["SIGTERM","SIGINT"])process.on(sig,()=>{shuttingDown=true;try{child.kill(sig)}catch{}process.exit(0)});

function json(res,status,body,headers={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers});res.end(JSON.stringify(body))}
function readBody(req,max=360000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}
async function call(url,raw,authorization,timeout=420000){const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json",authorization},body:raw||"{}",signal:AbortSignal.timeout(timeout)});const data=Buffer.from(await r.arrayBuffer());return{status:r.status,contentType:r.headers.get("content-type")||"application/json; charset=utf-8",data,engine:r.headers.get("x-multiplan-plan-engine")||""}}
function parse(buf){try{return JSON.parse(buf.toString("utf8"))}catch{return null}}
function executable(r){const p=parse(r.data);return r.status===200&&p&&Array.isArray(p.sessions)&&p.sessions.length>0&&p.sessions.every(s=>Array.isArray(s.work_moments)&&s.work_moments.length>0)}
function send(res,r,headers={}){const p=parse(r.data);res.writeHead(r.status,{"content-type":r.contentType,"cache-control":"no-store","x-multiplan-plan-engine":r.engine||p?.engineVersion||"unknown","x-multiplan-rescue":"V098-SIMPLIFIED-RESCUE",...headers});res.end(r.data)}

async function runShadow(raw,authorization,basePlan){if(!SHADOW_ENABLED||!String(basePlan?.engineVersion||"").startsWith("V6.4"))return;try{const request=JSON.parse(raw||"{}");request.base_plan=basePlan;request.methodology_selection=request.methodology_selection||request.metodologia||"auto";request.v65_mode="shadow";request.shadow_test=true;request.shadow_source_run_id=basePlan?.run_id||null;const started=Date.now();const r=await fetch(V65_URL,{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify(request),signal:AbortSignal.timeout(260000)});const text=await r.text();let out=null;try{out=JSON.parse(text)}catch{}console.log(JSON.stringify({event:"v65_beta4_shadow_complete",status:r.status,elapsed_ms:Date.now()-started,engine:out?.engineVersion||r.headers.get("x-multiplan-plan-engine")||null,run_id:out?.run_id||null,base_run_id:basePlan?.run_id||null,quality:out?.methodology_engine?.validator?.quality?.total??null,procedure_gate:out?.methodology_engine?.validator?.gates?.procedure_action_coherence??null,context_gate:out?.methodology_engine?.validator?.gates?.context_supported??null,code:out?.code||null}))}catch(error){console.error(JSON.stringify({event:"v65_beta4_shadow_error",base_run_id:basePlan?.run_id||null,message:String(error).slice(0,500)}))}}

async function routePlan(req,res){const authorization=String(req.headers.authorization||"");if(!authorization.startsWith("Bearer "))return json(res,401,{code:"AUTH_REQUIRED"});let raw;try{raw=await readBody(req)}catch(e){return json(res,413,{code:"PAYLOAD_TOO_LARGE",message:String(e)})}let body;try{body=JSON.parse(raw||"{}")}catch{return json(res,400,{code:"INVALID_JSON"})}const grades=[...new Set((Array.isArray(body?.grados)?body.grados:[]).map(Number).filter(Number.isInteger))];if(grades.length<2){try{const r=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,420000);return send(res,r,{"x-multiplan-route":"single-grade-child-v097"})}catch(e){return json(res,502,{code:"V098_SINGLE_CHILD_ERROR",message:String(e)})}}

 const attempts=[];
 try{
   const mg=await call(MG5_URL,raw,authorization,460000);attempts.push({engine:mg.engine||"V6.4-MG-BETA.5",status:mg.status,executable:executable(mg)});
   if(executable(mg)){const p=parse(mg.data);send(res,mg,{"x-multiplan-route":"multigrade-beta5-primary","x-multiplan-fallback-count":"0"});setImmediate(()=>void runShadow(raw,authorization,p));return}
 }catch(e){attempts.push({engine:"V6.4-MG-BETA.5",status:"NETWORK_ERROR",error:String(e).slice(0,180)})}

 for(let i=1;i<=2;i++){
   try{
     const stable=await call(STABLE_URL,raw,authorization,360000);attempts.push({engine:stable.engine||"V6.2.1",status:stable.status,executable:executable(stable),attempt:i});
     if(executable(stable))return send(res,stable,{"x-multiplan-route":"multigrade-stable-direct-rescue","x-multiplan-stable-attempt":String(i),"x-multiplan-fallback-count":String(i)});
   }catch(e){attempts.push({engine:"V6.2.1",status:"NETWORK_ERROR",attempt:i,error:String(e).slice(0,180)})}
 }
 return json(res,502,{code:"MULTIGRADE_GENERATION_EXHAUSTED",message:"No se obtuvo una planeación ejecutable después de Beta.5 y dos intentos directos del motor estable. La respuesta incompleta no se muestra como si fuera una planeación válida.",attempts},{"x-multiplan-plan-engine":"V098-SIMPLIFIED-RESCUE"});
}

async function proxy(req,res){try{const headers={};for(const n of["content-type","authorization","accept","cookie"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);const r=await fetch(CHILD_ORIGIN+req.url,init);const type=r.headers.get("content-type")||"application/octet-stream";const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data)}catch(e){json(res,502,{code:"V098_PROXY_ERROR",message:String(e)})}}

const server=http.createServer(async(req,res)=>{if(req.method==="GET"&&req.url==="/health"){try{const r=await fetch(CHILD_ORIGIN+"/health");const childHealth=await r.json().catch(()=>({}));return json(res,r.ok?200:503,{ok:r.ok,version:"0.9.8",visibleMultigradePrimary:"V6.4-MULTIGRADE-DIDACTIC-BETA.5",visibleMultigradeRescue:"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE x2 direct",removedFromVisibleFallback:["V6.4 Beta.4","V6.4 Beta.3","V6.4 Beta.2"],responseGuard:"REQUIRE sessions[].work_moments[] before 200",shadowEngine:"V6.5-METHODOLOGY-ENGINE-BETA.4",shadowMode:SHADOW_ENABLED?"ACTIVE_NON_GOVERNING":"DISABLED",child:childHealth})}catch(e){return json(res,503,{ok:false,version:"0.9.8",code:"CHILD_NOT_READY",message:String(e)})}}if(req.method==="POST"&&req.url==="/api/gemini-plan")return routePlan(req,res);return proxy(req,res)});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.9.8 on ${PORT}; simplified multigrade rescue; child v0.9.7 on ${CHILD_PORT}; V6.5 Beta.4 shadow=${SHADOW_ENABLED}`));
