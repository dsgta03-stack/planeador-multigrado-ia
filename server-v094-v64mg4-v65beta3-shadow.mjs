import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V091_CHILD_PORT || 4001);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const MG4_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-multigrade-didactic-v4";
const V65_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-methodology-v65-beta3";
const MG4_ENABLED = String(process.env.MULTIPLAN_V64_MG4_ENABLED || "true").toLowerCase() !== "false";
const SHADOW_ENABLED = String(process.env.MULTIPLAN_V65_SHADOW_ENABLED || "true").toLowerCase() !== "false";

const child = spawn(process.execPath, ["server-v091-v64mg3-v65shadow.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});
let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[v094] v0.9.1 child exited code=${code} signal=${signal}`);
  if (!shuttingDown) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => {
  shuttingDown = true;
  try { child.kill(sig); } catch {}
  process.exit(0);
});

function json(res, status, body, headers={}) {
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers});
  res.end(JSON.stringify(body));
}
function readBody(req,maxBytes=320000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>maxBytes){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy();}});req.on("end",()=>resolve(raw));req.on("error",reject);});}
async function call(url,raw,authorization,timeout=260000){const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json",authorization},body:raw||"{}",signal:AbortSignal.timeout(timeout)});return{status:r.status,contentType:r.headers.get("content-type")||"application/json; charset=utf-8",data:Buffer.from(await r.arrayBuffer()),engine:r.headers.get("x-multiplan-plan-engine")||"",headers:r.headers};}
function parse(buffer){try{return JSON.parse(buffer.toString("utf8"));}catch{return null;}}
function send(res,result,engine,extra={}){res.writeHead(result.status,{"content-type":result.contentType,"cache-control":"no-store","x-multiplan-plan-engine":engine,"x-multiplan-v65-shadow":SHADOW_ENABLED?"enabled-non-governing-beta3":"disabled",...extra});res.end(result.data);}
async function runShadow(raw,authorization,basePlan){try{const request=JSON.parse(raw||"{}");request.base_plan=basePlan;request.methodology_selection=request.methodology_selection||request.metodologia||"auto";request.v65_mode="shadow";request.shadow_test=true;request.shadow_source_run_id=basePlan?.run_id||null;const started=Date.now();const r=await fetch(V65_URL,{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify(request),signal:AbortSignal.timeout(210000)});const text=await r.text();let out=null;try{out=JSON.parse(text);}catch{}console.log(JSON.stringify({event:"v65_beta3_shadow_complete",status:r.status,elapsed_ms:Date.now()-started,engine:out?.engineVersion||r.headers.get("x-multiplan-plan-engine")||null,run_id:out?.run_id||null,base_run_id:basePlan?.run_id||null,methodology:out?.methodology_engine?.methodology_primary?.id||null,quality:out?.methodology_engine?.validator?.quality?.total??null,transformation_ratio:out?.methodology_engine?.validator?.transformation?.ratio??null,errors:out?.methodology_engine?.validator?.errors?.length??null,code:out?.code||null}));}catch(error){console.error(JSON.stringify({event:"v65_beta3_shadow_error",base_run_id:basePlan?.run_id||null,message:String(error).slice(0,500)}));}}

async function routePlan(req,res){
  const authorization=String(req.headers.authorization||"");
  if(!authorization.startsWith("Bearer "))return json(res,401,{code:"AUTH_REQUIRED"});
  let raw;try{raw=await readBody(req);}catch(e){return json(res,413,{code:"PAYLOAD_TOO_LARGE",message:String(e)});}
  let body;try{body=JSON.parse(raw||"{}");}catch{return json(res,400,{code:"INVALID_JSON"});}
  const grades=[...new Set((Array.isArray(body?.grados)?body.grados:[]).map(Number).filter(Number.isInteger))];
  const multi=grades.length>=2;

  if(MG4_ENABLED&&multi){
    try{
      const mg=await call(MG4_URL,raw,authorization,420000);
      if(mg.status<500&&mg.status!==422){
        const plan=parse(mg.data);
        if(plan){plan.engineVersion="V6.4-MULTIGRADE-DIDACTIC-BETA.4";mg.data=Buffer.from(JSON.stringify(plan));}
        send(res,mg,"V6.4-MULTIGRADE-DIDACTIC-BETA.4",{"x-multiplan-v64-mg4":"primary"});
        if(SHADOW_ENABLED&&mg.status===200&&plan)setImmediate(()=>void runShadow(raw,authorization,plan));
        return;
      }
      const fallback=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,300000);
      return send(res,fallback,fallback.engine||"V6.4-MULTIGRADE-DIDACTIC-BETA.3",{"x-multiplan-fallback":"v0.9.1","x-multiplan-v64-mg4-status":String(mg.status)});
    }catch(error){
      try{const fallback=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,300000);return send(res,fallback,fallback.engine||"V6.4-MULTIGRADE-DIDACTIC-BETA.3",{"x-multiplan-fallback":"v0.9.1-network","x-multiplan-v64-mg4-error":String(error).slice(0,180)});}catch(fallbackError){return json(res,502,{code:"V094_AND_FALLBACK_FAILED",message:String(error),fallback:String(fallbackError)});}
    }
  }
  try{const r=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,260000);return send(res,r,r.engine||"V6.4-DIDACTIC-EXECUTION-BETA.2");}catch(error){return json(res,502,{code:"V094_CHILD_ERROR",message:String(error)});}
}

async function proxy(req,res){try{const headers={};for(const n of ["content-type","authorization","accept","cookie"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);const r=await fetch(CHILD_ORIGIN+req.url,init);const type=r.headers.get("content-type")||"application/octet-stream";const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data);}catch(e){json(res,502,{code:"V091_CHILD_PROXY_ERROR",message:String(e)});}}

const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/health"){try{const r=await fetch(CHILD_ORIGIN+"/health");const child=await r.json().catch(()=>({}));return json(res,r.ok?200:503,{ok:r.ok,version:"0.9.4",multigradeEngine:MG4_ENABLED?"V6.4-MULTIGRADE-DIDACTIC-BETA.4":"V6.4-MULTIGRADE-DIDACTIC-BETA.3",multigradeFallback:"V0.9.1 -> Beta.3 -> Beta.2 -> V6.2.1",shadowEngine:"V6.5-METHODOLOGY-ENGINE-BETA.3",shadowMode:SHADOW_ENABLED?"ACTIVE_NON_GOVERNING":"DISABLED",shadowGoal:"INTEGRATED-PROJECT + PROGRESSIVE-PRODUCT + ACTION-TRANSFORMATION",singleGradeEngine:"V6.4-DIDACTIC-EXECUTION-BETA.2",previousProduction:"server-v093-v64mg4-v65shadow.mjs",child});}catch(e){return json(res,503,{ok:false,version:"0.9.4",code:"V091_CHILD_NOT_READY",message:String(e)});}}
  if(req.method==="POST"&&req.url==="/api/gemini-plan")return routePlan(req,res);
  return proxy(req,res);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.9.4 router on ${PORT}; V6.4-MG Beta.4=${MG4_ENABLED}; V6.5 Beta.3 shadow=${SHADOW_ENABLED}; child v0.9.1 on ${CHILD_PORT}`));
