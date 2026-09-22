import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0118_CHILD_PORT||6301);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;
const ADAPTER="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-methodology-safe-adapter-v1";

const child=spawn(process.execPath,["server-v0117-teacher-presentation.mjs"],{env:{...process.env,PORT:String(CHILD_PORT)},stdio:["ignore","inherit","inherit"]});
let stopping=false;child.on("exit",(c,s)=>{console.error(`[v0118] child exited code=${c} signal=${s}`);if(!stopping)setTimeout(()=>process.exit(c||1),50)});for(const sig of["SIGTERM","SIGINT"])process.on(sig,()=>{stopping=true;try{child.kill(sig)}catch{}process.exit(0)});

function read(req,max=900000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}
function json(res,status,body,extra={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra});res.end(JSON.stringify(body))}
function copied(r){const h={"content-type":r.headers.get("content-type")||"application/json; charset=utf-8","cache-control":"no-store"};for(const n of["x-multiplan-plan-engine","x-multiplan-safe-fallback","x-multiplan-v65-promotion","x-multiplan-v64-base","x-multiplan-provider-degraded","x-multiplan-teacher-presentation","x-multiplan-teacher-presentation-model","x-multiplan-methodology-recommender","x-multiplan-result-guard"])if(r.headers.get(n))h[n]=r.headers.get(n);return h}
const executable=p=>!!(p&&Array.isArray(p.sessions)&&p.sessions.some(s=>Array.isArray(s.work_moments)&&s.work_moments.length));
function isSafeRescue(p){const e=String(p?.engineVersion||"");const t=Array.isArray(p?.transversal_grades)?p.transversal_grades:[];return e.includes("TRANSVERSAL-LOCK")&&e.includes("CONCEPT-GUARD")&&executable(p)&&p?.validator?.status==="APROBADO"&&p?.teacher_selection_preserved===true&&(t.length===0||(p?.transversal_isolation_applied===true&&p?.teacher_selection_semantic_gate?.status==="PASS"));}

async function plan(req,res){
 const auth=String(req.headers.authorization||"");if(!auth.startsWith("Bearer "))return json(res,401,{code:"AUTH_REQUIRED"});
 let raw="";try{raw=await read(req)}catch(e){return json(res,413,{code:"PAYLOAD_TOO_LARGE",message:String(e)})}
 let input={};try{input=JSON.parse(raw||"{}")}catch{return json(res,400,{code:"INVALID_JSON"})}
 try{
  const base=await fetch(CHILD_ORIGIN+"/api/gemini-plan",{method:"POST",headers:{"content-type":"application/json",authorization:auth},body:raw||"{}",signal:AbortSignal.timeout(650000)});
  const h=copied(base),buf=Buffer.from(await base.arrayBuffer());if(!base.ok){res.writeHead(base.status,h);res.end(buf);return}
  let out;try{out=JSON.parse(buf.toString("utf8"))}catch{res.writeHead(base.status,h);res.end(buf);return}
  if(String(out?.engineVersion||"").startsWith("V6.5")||base.headers.get("x-multiplan-v65-promotion")==="PROMOTED"){res.writeHead(200,h);res.end(buf);return}
  if(!isSafeRescue(out)){h["x-multiplan-safe-adapter"]="NOT-ADMITTED";res.writeHead(200,h);res.end(buf);return}
  try{
   const payload={...input,base_plan:out,methodology_selection:input.methodology_selection||input.metodologia||out?.teacher_presentation?.methodology_id||"abp"};
   const ar=await fetch(ADAPTER,{method:"POST",headers:{"content-type":"application/json",authorization:auth},body:JSON.stringify(payload),signal:AbortSignal.timeout(210000)});
   const adapted=await ar.json().catch(()=>null),gate=adapted?.methodology_engine?.promotion_gate||{},sessions=adapted?.methodology_engine?.transformed_sessions;
   if(ar.ok&&gate.promotable===true&&Array.isArray(sessions)&&sessions.length){
    adapted.sessions=sessions;
    if(out.teacher_presentation)adapted.teacher_presentation=out.teacher_presentation;
    if(adapted?.methodology_engine?.integrated_project&&out?.teacher_presentation?.project_title)adapted.methodology_engine.integrated_project.display_title=out.teacher_presentation.project_title;
    h["x-multiplan-plan-engine"]=String(adapted.engineVersion||"V6.5-METHODOLOGY-ENGINE-BETA.10-PROMOTION-GATE");
    h["x-multiplan-v65-promotion"]="PROMOTED-SAFE-RESCUE";
    h["x-multiplan-safe-fallback"]="TRANSVERSAL-LOCK-STABLE+METHODOLOGY-ADAPTER";
    h["x-multiplan-safe-base-admission"]="PASS";
    h["x-multiplan-safe-adapter"]="SAFE-RESCUE-ADAPTER-V1";
    res.writeHead(200,h);res.end(JSON.stringify(adapted));return;
   }
   console.error(JSON.stringify({event:"safe_rescue_methodology_not_promoted",status:ar.status,failures:gate.failures||[],code:adapted?.code||null}));
  }catch(e){console.error(JSON.stringify({event:"safe_rescue_methodology_adapter_error",message:String(e).slice(0,400)}))}
  h["x-multiplan-safe-adapter"]="FAILED-KEPT-STABLE";res.writeHead(200,h);res.end(buf);
 }catch(e){json(res,502,{code:"V0118_PLAN_ROUTE_ERROR",message:String(e)})}
}

async function proxy(req,res){try{const headers={};for(const n of["content-type","authorization","accept","cookie","user-agent"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await read(req);const r=await fetch(CHILD_ORIGIN+(req.url||"/"),init),data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{...copied(r),"content-type":r.headers.get("content-type")||"application/octet-stream"});res.end(data)}catch(e){json(res,502,{code:"V0118_PROXY_ERROR",message:String(e)})}}

http.createServer(async(req,res)=>{if(req.method==="POST"&&req.url==="/api/gemini-plan")return plan(req,res);if(req.method==="GET"&&req.url==="/v0118_health")return json(res,200,{ok:true,version:"0.11.8",safeRescueMethodology:"ENABLED",coreBeta10:"UNCHANGED",teacherPresentation:"v0.11.7",recommendation:"v0.11.6"});return proxy(req,res)}).listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.11.8 on ${PORT}; safe transversal rescue can re-enter Beta.10 methodology gate`));