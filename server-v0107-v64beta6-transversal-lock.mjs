import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0106_CHILD_PORT||5101);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;
const V64_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-multigrade-didactic-v6";
const STABLE_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-gemini-transversal-lock";
const V65_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-methodology-v65-beta8";
const SHADOW_ENABLED=String(process.env.MULTIPLAN_V65_SHADOW_ENABLED||"true").toLowerCase()!=="false";

const child=spawn(process.execPath,["server-v0106-v65beta8-shadow.mjs"],{
  env:{...process.env,PORT:String(CHILD_PORT),MULTIPLAN_V65_SHADOW_ENABLED:"false"},
  stdio:["ignore","inherit","inherit"]
});
let shuttingDown=false;
child.on("exit",(code,signal)=>{console.error(`[v0107] child v0.10.6 exited code=${code} signal=${signal}`);if(!shuttingDown)setTimeout(()=>process.exit(code||1),50)});
for(const sig of ["SIGTERM","SIGINT"])process.on(sig,()=>{shuttingDown=true;try{child.kill(sig)}catch{}process.exit(0)});

function json(res,status,body,headers={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers});res.end(JSON.stringify(body))}
function readBody(req,max=500000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}
function parseBuffer(buf){try{return JSON.parse(buf.toString("utf8"))}catch{return null}}
function executable(plan){return !!(plan&&Array.isArray(plan.sessions)&&plan.sessions.length&&plan.sessions.some(s=>Array.isArray(s?.work_moments)&&s.work_moments.length))}
async function callUrl(url,raw,authorization,timeout){const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json",authorization},body:raw||"{}",signal:AbortSignal.timeout(timeout)});return{status:r.status,contentType:r.headers.get("content-type")||"application/json; charset=utf-8",data:Buffer.from(await r.arrayBuffer()),engine:r.headers.get("x-multiplan-plan-engine")||"",transversal:r.headers.get("x-multiplan-transversal-lock")||""}}
async function callChild(path,raw,authorization,timeout=560000){const r=await fetch(CHILD_ORIGIN+path,{method:"POST",headers:{"content-type":"application/json",authorization},body:raw||"{}",signal:AbortSignal.timeout(timeout)});return{status:r.status,contentType:r.headers.get("content-type")||"application/json; charset=utf-8",data:Buffer.from(await r.arrayBuffer()),engine:r.headers.get("x-multiplan-plan-engine")||""}}
function send(res,r,engine,extra={}){res.writeHead(r.status,{"content-type":r.contentType,"cache-control":"no-store","x-multiplan-plan-engine":engine||"unknown",...extra});res.end(r.data)}

async function runShadow(raw,authorization,basePlan){try{const request=JSON.parse(raw||"{}");request.base_plan=basePlan;request.methodology_selection=request.methodology_selection||request.metodologia||"auto";request.v65_mode="shadow";request.shadow_test=true;request.shadow_source_run_id=basePlan?.run_id||null;const started=Date.now();const r=await fetch(V65_URL,{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify(request),signal:AbortSignal.timeout(560000)});const text=await r.text();let out=null;try{out=JSON.parse(text)}catch{}const v=out?.methodology_engine?.validator||{};console.log(JSON.stringify({event:"v65_beta8_shadow_complete",status:r.status,elapsed_ms:Date.now()-started,engine:out?.engineVersion||null,run_id:out?.run_id||null,base_run_id:basePlan?.run_id||null,teacher_selection_gate:v?.gates?.teacher_selection_preserved??null,transversal_grades:basePlan?.transversal_grades||[],errors:Array.isArray(v?.errors)?v.errors.length:null,code:out?.code||null}))}catch(error){console.error(JSON.stringify({event:"v65_beta8_shadow_error",base_run_id:basePlan?.run_id||null,message:String(error).slice(0,500)}))}}

async function routePlan(req,res){
  const authorization=String(req.headers.authorization||"");
  if(!authorization.startsWith("Bearer "))return json(res,401,{code:"AUTH_REQUIRED"});
  let raw;try{raw=await readBody(req)}catch(e){return json(res,413,{code:"PAYLOAD_TOO_LARGE",message:String(e)})}
  let body;try{body=JSON.parse(raw||"{}")}catch{return json(res,400,{code:"INVALID_JSON"})}
  const grades=[...new Set((Array.isArray(body.grados)?body.grados:[]).map(Number).filter(Number.isInteger))];
  if(grades.length<2){let c;try{c=await callChild("/api/gemini-plan",raw,authorization)}catch(e){return json(res,502,{code:"V0107_SINGLE_GRADE_CHILD_ERROR",message:String(e)})}return send(res,c,c.engine||"single-grade-child")}

  let primary;
  try{primary=await callUrl(V64_URL,raw,authorization,540000)}catch(e){primary={status:502,contentType:"application/json; charset=utf-8",data:Buffer.from(JSON.stringify({code:"V0107_V64_CALL_ERROR",message:String(e)})),engine:"V6.4-MULTIGRADE-DIDACTIC-BETA.6-TRANSVERSAL-LOCK",transversal:""}}
  if(primary.status===401||primary.status===403)return send(res,primary,primary.engine);
  const p=primary.status===200?parseBuffer(primary.data):null;
  if(primary.status===200&&executable(p)){
    send(res,primary,primary.engine||p.engineVersion,{"x-multiplan-transversal-lock":"required-and-preserved","x-multiplan-safe-fallback":"not-needed","x-multiplan-v65-shadow":SHADOW_ENABLED?"enabled-beta8-non-governing":"disabled"});
    if(SHADOW_ENABLED)setImmediate(()=>void runShadow(raw,authorization,p));
    return;
  }

  let stable;
  try{stable=await callUrl(STABLE_URL,raw,authorization,330000)}catch(e){return json(res,502,{code:"V0107_SAFE_RESCUE_CALL_ERROR",message:String(e),primary_status:primary.status})}
  if(stable.status===401||stable.status===403)return send(res,stable,stable.engine);
  const s=stable.status===200?parseBuffer(stable.data):null;
  if(stable.status===200&&executable(s))return send(res,stable,stable.engine||s.engineVersion,{"x-multiplan-transversal-lock":"required-and-applied","x-multiplan-safe-fallback":"TRANSVERSAL-LOCK-STABLE","x-multiplan-v65-shadow":"not-run-on-stable-fallback"});
  return json(res,502,{code:"MULTIGRADE_SAFE_GENERATION_FAILED",message:"No se obtuvo una planeación ejecutable que superara Transversal Lock.",primary_status:primary.status,primary_code:parseBuffer(primary.data)?.code||null,rescue_status:stable.status,rescue_code:parseBuffer(stable.data)?.code||null});
}

async function proxy(req,res){try{const headers={};for(const n of["content-type","authorization","accept","cookie"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);const r=await fetch(CHILD_ORIGIN+req.url,init);const type=r.headers.get("content-type")||"application/octet-stream";const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data)}catch(e){json(res,502,{code:"V0107_PROXY_ERROR",message:String(e)})}}

const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/health"){
    try{const r=await fetch(CHILD_ORIGIN+"/health");const childHealth=await r.json().catch(()=>({}));return json(res,r.ok?200:503,{ok:r.ok,version:"0.10.7",teacherSelectionPolicy:"AUTHORITATIVE_NO_AUTO_PDA",zeroPdaPlanning:"SUPPORTED",missingPdaPolicy:"TRANSVERSAL_PROJECT_ISOLATED_GENERATION",crossGradePdaPolicy:"FORBIDDEN",visibleMultigradePrimary:"V6.4-MULTIGRADE-DIDACTIC-BETA.6-TRANSVERSAL-LOCK",visibleMultigradeRescue:"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE+TRANSVERSAL-LOCK-V1",transversalLock:"REQUIRED_FOR_ALL_MULTIGRADE_OUTPUTS",unsafeVisibleFallbacks:"DISABLED",shadowEngine:"V6.5-METHODOLOGY-ENGINE-BETA.8",shadowMode:SHADOW_ENABLED?"ACTIVE_NON_GOVERNING":"DISABLED",userResponseMultigradeFrom:"V6.4 Beta.6 or Transversal-Lock stable only",child:childHealth})}catch(e){return json(res,503,{ok:false,version:"0.10.7",message:String(e)})}
  }
  if(req.method==="POST"&&req.url==="/api/gemini-plan")return routePlan(req,res);
  return proxy(req,res);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.10.7 on ${PORT}; multigrade V6.4 Beta.6 + mandatory Transversal Lock; child v0.10.6 on ${CHILD_PORT}; Beta.8 shadow=${SHADOW_ENABLED}`));
