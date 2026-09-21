import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0101_CHILD_PORT||4701);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;
const GRADELOCK_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-gemini-gradelock";

const child=spawn(process.execPath,["server-v0101-v65beta7-shadow.mjs"],{env:{...process.env,PORT:String(CHILD_PORT)},stdio:["ignore","inherit","inherit"]});
let shuttingDown=false;
child.on("exit",(code,signal)=>{console.error(`[v0102] child v0.10.1 exited code=${code} signal=${signal}`);if(!shuttingDown)setTimeout(()=>process.exit(code||1),50)});
for(const sig of ["SIGTERM","SIGINT"])process.on(sig,()=>{shuttingDown=true;try{child.kill(sig)}catch{}process.exit(0)});

function json(res,status,body,headers={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers});res.end(JSON.stringify(body))}
function readBody(req,max=400000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}
function parse(buf){try{return JSON.parse(buf.toString("utf8"))}catch{return null}}
function executable(status,data){const p=parse(data);return status===200&&p&&Array.isArray(p.sessions)&&p.sessions.length>0&&p.sessions.every(s=>Array.isArray(s.work_moments)&&s.work_moments.length>0)}
async function call(url,raw,authorization,timeout=560000){const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json",authorization},body:raw||"{}",signal:AbortSignal.timeout(timeout)});return{status:r.status,type:r.headers.get("content-type")||"application/json; charset=utf-8",data:Buffer.from(await r.arrayBuffer()),engine:r.headers.get("x-multiplan-plan-engine")||"",gradeLock:r.headers.get("x-multiplan-grade-lock")||""}}
function send(res,r,extra={}){const p=parse(r.data);res.writeHead(r.status,{"content-type":r.type,"cache-control":"no-store","x-multiplan-plan-engine":r.engine||p?.engineVersion||"unknown",...extra});res.end(r.data)}

async function routePlan(req,res){
  const authorization=String(req.headers.authorization||"");
  if(!authorization.startsWith("Bearer "))return json(res,401,{code:"AUTH_REQUIRED"});
  let raw;try{raw=await readBody(req)}catch(e){return json(res,413,{code:"PAYLOAD_TOO_LARGE",message:String(e)})}
  let body;try{body=JSON.parse(raw||"{}")}catch{return json(res,400,{code:"INVALID_JSON"})}
  const grades=[...new Set((Array.isArray(body?.grados)?body.grados:[]).map(Number).filter(Number.isInteger))];
  try{
    const primary=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,560000);
    if(primary.status===401||primary.status===403)return send(res,primary,{"x-multiplan-route":"v0102-auth-primary"});
    if(executable(primary.status,primary.data))return send(res,primary,{"x-multiplan-route":"v0102-primary","x-multiplan-grade-lock-rescue":"not-needed"});
    if(grades.length<2)return send(res,primary,{"x-multiplan-route":"v0102-single-no-rescue"});
    const rescue=await call(GRADELOCK_URL,raw,authorization,240000);
    if(rescue.status===401||rescue.status===403)return send(res,rescue,{"x-multiplan-route":"v0102-auth-gradelock"});
    if(executable(rescue.status,rescue.data))return send(res,rescue,{"x-multiplan-route":"v0102-gradelock-rescue","x-multiplan-grade-lock-rescue":rescue.gradeLock||"repaired"});
    return json(res,502,{code:"V0102_GENERATION_EXHAUSTED",message:"No se obtuvo una planeación ejecutable. Se intentó la ruta didáctica y el rescate Grade-Lock.",primary:{status:primary.status,engine:primary.engine,body:parse(primary.data)},grade_lock:{status:rescue.status,engine:rescue.engine,mode:rescue.gradeLock,body:parse(rescue.data)}},{"x-multiplan-plan-engine":"V0102-GRADELOCK-RESCUE"});
  }catch(e){return json(res,502,{code:"V0102_ROUTE_ERROR",message:String(e)})}
}

async function proxy(req,res){try{const headers={};for(const n of["content-type","authorization","accept","cookie"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);const r=await fetch(CHILD_ORIGIN+req.url,init);const type=r.headers.get("content-type")||"application/octet-stream";const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data)}catch(e){json(res,502,{code:"V0102_PROXY_ERROR",message:String(e)})}}

const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/health"){
    try{const r=await fetch(CHILD_ORIGIN+"/health");const childHealth=await r.json().catch(()=>({}));return json(res,r.ok?200:503,{ok:r.ok,version:"0.10.2",visiblePrimary:"V0.10.1 -> V6.4 Beta.5",gradeLockRescue:"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE + GRADE-LOCK",gradeLockPolicy:"ONLY_RESCUE_WHEN_PRIMARY_NOT_EXECUTABLE; REMOVE PDA ASSIGNMENTS OUTSIDE BLOCK GRADE",shadowEngine:childHealth.shadowEngine||"V6.5-METHODOLOGY-ENGINE-BETA.7",child:childHealth})}catch(e){return json(res,503,{ok:false,version:"0.10.2",message:String(e)})}
  }
  if(req.method==="POST"&&req.url==="/api/gemini-plan")return routePlan(req,res);
  return proxy(req,res);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.10.2 on ${PORT}; child v0.10.1 on ${CHILD_PORT}; Grade-Lock rescue active`));
