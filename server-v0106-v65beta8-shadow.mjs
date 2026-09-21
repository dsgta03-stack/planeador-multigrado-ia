import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0105_CHILD_PORT||5001);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;
const V65_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-methodology-v65-beta8";
const SHADOW_ENABLED=String(process.env.MULTIPLAN_V65_SHADOW_ENABLED||"true").toLowerCase()!=="false";

const child=spawn(process.execPath,["server-v0105-zero-pda-teacher-lock.mjs"],{
  env:{...process.env,PORT:String(CHILD_PORT),MULTIPLAN_V65_SHADOW_ENABLED:"false"},
  stdio:["ignore","inherit","inherit"]
});
let shuttingDown=false;
child.on("exit",(code,signal)=>{console.error(`[v0106] child v0.10.5 exited code=${code} signal=${signal}`);if(!shuttingDown)setTimeout(()=>process.exit(code||1),50)});
for(const sig of ["SIGTERM","SIGINT"])process.on(sig,()=>{shuttingDown=true;try{child.kill(sig)}catch{}process.exit(0)});

function json(res,status,body,headers={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers});res.end(JSON.stringify(body))}
function readBody(req,max=450000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}
function parse(buf){try{return JSON.parse(buf.toString("utf8"))}catch{return null}}
async function callChild(path,raw,authorization,timeout=560000){const r=await fetch(CHILD_ORIGIN+path,{method:"POST",headers:{"content-type":"application/json",authorization},body:raw||"{}",signal:AbortSignal.timeout(timeout)});return{status:r.status,contentType:r.headers.get("content-type")||"application/json; charset=utf-8",data:Buffer.from(await r.arrayBuffer()),engine:r.headers.get("x-multiplan-plan-engine")||""}}
function send(res,r,engine,extra={}){res.writeHead(r.status,{"content-type":r.contentType,"cache-control":"no-store","x-multiplan-plan-engine":engine,"x-multiplan-v65-shadow":SHADOW_ENABLED?"enabled-beta8-non-governing":"disabled",...extra});res.end(r.data)}

function patchTeacherSelectionLanguage(html){
  return String(html)
    .replaceAll("Sin PDA seleccionado en '+missing.map(g=>g+'.º').join(', ')+'. Puedes continuar; quedará como advertencia pedagógica.","Sin PDA seleccionado en '+missing.map(g=>g+'.º').join(', ')+'. Estos grados participarán de forma transversal en el proyecto, sin atribución curricular automática.")
    .replaceAll("Sin PDA seleccionado por decisión docente. No bloquea el avance, pero el validador lo registra como advertencia.","Sin PDA seleccionado por decisión docente. Participará transversalmente en el proyecto con actividades adaptadas a sus características, sin atribuirle un PDA ajeno.")
    .replaceAll("sin PDA seleccionado: definir evidencia y criterio solo cuando exista un aprendizaje curricular decidido.","sin PDA seleccionado: registrar aportes y evidencias del proyecto sin presentarlos como logro de un PDA no seleccionado.")
    .replaceAll("Revisar grados sin PDA: '+missingGrades.map(g=>g+'.º').join(', ')","Grados con participación transversal sin PDA: '+missingGrades.map(g=>g+'.º').join(', ')")
    .replaceAll("Hay grados activos sin PDA seleccionado; es una decisión permitida, pero requiere revisión curricular antes de cerrar la planeación.","Hay grados sin PDA seleccionado por decisión docente; participarán transversalmente en el proyecto y no recibirán PDA, LTG ni criterios curriculares ajenos.");
}

async function runShadow(raw,authorization,basePlan){
  try{
    const request=JSON.parse(raw||"{}");
    request.base_plan=basePlan;
    request.methodology_selection=request.methodology_selection||request.metodologia||"auto";
    request.v65_mode="shadow";
    request.shadow_test=true;
    request.shadow_source_run_id=basePlan?.run_id||null;
    const started=Date.now();
    const r=await fetch(V65_URL,{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify(request),signal:AbortSignal.timeout(560000)});
    const text=await r.text();let out=null;try{out=JSON.parse(text)}catch{}
    const v=out?.methodology_engine?.validator||{};
    console.log(JSON.stringify({event:"v65_beta8_shadow_complete",status:r.status,elapsed_ms:Date.now()-started,engine:out?.engineVersion||r.headers.get("x-multiplan-plan-engine")||null,run_id:out?.run_id||null,base_run_id:basePlan?.run_id||null,methodology:out?.methodology_engine?.methodology_primary?.id||null,quality:v?.quality?.total??null,procedure_ratio:v?.procedure_coherence?.ratio??null,teacher_selection_gate:v?.gates?.teacher_selection_preserved??null,transversal_grades:out?.transversal_grades||basePlan?.transversal_grades||[],errors:Array.isArray(v?.errors)?v.errors.length:null,code:out?.code||null}));
  }catch(error){console.error(JSON.stringify({event:"v65_beta8_shadow_error",base_run_id:basePlan?.run_id||null,message:String(error).slice(0,500)}))}
}

async function routePlan(req,res){
  const authorization=String(req.headers.authorization||"");
  if(!authorization.startsWith("Bearer "))return json(res,401,{code:"AUTH_REQUIRED"});
  let raw;try{raw=await readBody(req)}catch(e){return json(res,413,{code:"PAYLOAD_TOO_LARGE",message:String(e)})}
  let r;try{r=await callChild("/api/gemini-plan",raw,authorization)}catch(e){return json(res,502,{code:"V0106_CHILD_ERROR",message:String(e)})}
  const plan=r.status===200?parse(r.data):null;
  const engine=r.engine||plan?.engineVersion||"unknown";
  send(res,r,engine,{"x-multiplan-v65-shadow-base":plan?.run_id||""});
  if(SHADOW_ENABLED&&r.status===200&&plan&&String(plan.engineVersion||engine).startsWith("V6.4"))setImmediate(()=>void runShadow(raw,authorization,plan));
}

async function proxy(req,res){
  try{
    const headers={};for(const n of["content-type","authorization","accept","cookie"])if(req.headers[n])headers[n]=req.headers[n];
    const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);
    const r=await fetch(CHILD_ORIGIN+req.url,init);
    const type=r.headers.get("content-type")||"application/octet-stream";
    if(req.method==="GET"&&req.url==="/"&&type.includes("text/html")){
      const html=patchTeacherSelectionLanguage(await r.text());
      res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
    }
    const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data);
  }catch(e){json(res,502,{code:"V0106_PROXY_ERROR",message:String(e)})}
}

const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/health"){
    try{
      const r=await fetch(CHILD_ORIGIN+"/health");const childHealth=await r.json().catch(()=>({}));
      return json(res,r.ok?200:503,{ok:r.ok,version:"0.10.6.1",teacherSelectionPolicy:childHealth.teacherSelectionPolicy||"AUTHORITATIVE_NO_AUTO_PDA",zeroPdaPlanning:childHealth.zeroPdaPlanning||"SUPPORTED",missingPdaPolicy:childHealth.missingPdaPolicy||"TRANSVERSAL_PROJECT_ADAPTATION_ONLY",crossGradePdaPolicy:"FORBIDDEN",noPdaUiLanguage:"TRANSVERSAL_NOT_WARNING",stableEnginePatch:"V6.2.1 function v12 teacher-selection-lock",didacticEnginePatch:"V6.4 Beta.5 function v2 teacher-selection-lock",shadowEngine:"V6.5-METHODOLOGY-ENGINE-BETA.8",shadowMode:SHADOW_ENABLED?"ACTIVE_NON_GOVERNING":"DISABLED",shadowIsolation:"ONLY_BETA8_AT_TOP_LEVEL; LOWER_METHODOLOGY_SHADOWS_DISABLED",shadowGoal:"TEACHER-SELECTION-GATE + EXISTING-METHODOLOGY-QUALITY-GATES",userResponseAlwaysFrom:"server-v0105-zero-pda-teacher-lock.mjs",child:childHealth});
    }catch(e){return json(res,503,{ok:false,version:"0.10.6.1",code:"V0105_CHILD_NOT_READY",message:String(e)})}
  }
  if(req.method==="POST"&&req.url==="/api/gemini-plan")return routePlan(req,res);
  return proxy(req,res);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.10.6.1 on ${PORT}; child v0.10.5 on ${CHILD_PORT}; only V6.5 Beta.8 shadow=${SHADOW_ENABLED}`));
