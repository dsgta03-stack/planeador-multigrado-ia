import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0117_CHILD_PORT||6201);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;
const PRESENTER="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-teacher-presentation-v1";

const child=spawn(process.execPath,["server-v0116-methodology-recommendation.mjs"],{env:{...process.env,PORT:String(CHILD_PORT)},stdio:["ignore","inherit","inherit"]});
let stopping=false;
child.on("exit",(code,signal)=>{console.error(`[v0117] child exited code=${code} signal=${signal}`);if(!stopping)setTimeout(()=>process.exit(code||1),50)});
for(const sig of["SIGTERM","SIGINT"])process.on(sig,()=>{stopping=true;try{child.kill(sig)}catch{}process.exit(0)});

function readBody(req,max=800000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}
function json(res,status,body,extra={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra});res.end(JSON.stringify(body))}
function copyHeaders(r){const h={"content-type":r.headers.get("content-type")||"application/json; charset=utf-8","cache-control":"no-store"};for(const n of["x-multiplan-plan-engine","x-multiplan-safe-fallback","x-multiplan-v65-promotion","x-multiplan-v64-base","x-multiplan-provider-degraded","x-multiplan-methodology-recommender","x-multiplan-result-guard"])if(r.headers.get(n))h[n]=r.headers.get(n);return h}

const PATCH=String.raw`
<style id="mp-teacher-style">
#mpTeacherVoiceNote{margin:10px 0;padding:10px 12px;border-radius:10px;background:#f0faf7;border:1px solid #cfe7df;color:#235a4a;font-size:13px;line-height:1.45}.mpTeacherSession{padding:15px 0;border-bottom:1px solid #dfe7f1}.mpTeacherSession:last-child{border-bottom:0}.mpTeacherSession h4{margin:0 0 8px;font-size:17px}.mpTeacherNarrative{line-height:1.62;color:#20354d}.mpTeacherBlock{margin:9px 0;padding:11px 13px;border-left:3px solid #19a990;background:#f7fbfa;border-radius:8px;line-height:1.55}.mpTeacherPhase{display:inline-block;margin-bottom:8px;padding:5px 8px;border-radius:8px;background:#eaf4ff;color:#145eaa;font-size:12px;font-weight:850}#mpTechnicalTrace{margin-top:18px;border:1px solid #dfe7f1;border-radius:11px;padding:10px 12px;background:#fafcfe}#mpTechnicalTrace summary{cursor:pointer;font-weight:800;color:#536b82}
</style>
<script id="mp-teacher-script">
(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function renderTeacher(data){
 const p=data?.teacher_presentation;if(!p||!Array.isArray(p.sessions)||!p.sessions.length)return;
 const plan=document.getElementById('plan');const seq=document.getElementById('sessionsPlan');if(!plan||!seq)return;
 let header=document.getElementById('mpPlanMethodHeader');if(!header){header=document.createElement('div');header.id='mpPlanMethodHeader';header.className='mpPlanMethodHeader';plan.insertBefore(header,plan.firstChild)}
 const existingMeta=header.querySelector('.meta')?.outerHTML||'';const phaseLine=header.querySelector('.mpMethodPhases')?.outerHTML||'';
 header.innerHTML='<div class="muted">Proyecto generado por Multiplan</div><h2>'+esc(p.project_title||'Proyecto')+'</h2>'+existingMeta+'<div id="mpTeacherVoiceNote"><b>Redacción docente:</b> las actividades se presentan en primera persona para que la planeación tenga una voz natural de trabajo docente. Los PDA y referencias curriculares oficiales no se reescriben.</div>'+phaseLine;
 if(!document.getElementById('mpTechnicalTrace')){const detail=document.createElement('details');detail.id='mpTechnicalTrace';detail.innerHTML='<summary>Ver detalle técnico y trazabilidad original</summary><div style="margin-top:10px">'+seq.innerHTML+'</div>';seq.insertAdjacentElement('afterend',detail)}
 seq.innerHTML=p.sessions.map(s=>'<div class="mpTeacherSession"><span class="mpTeacherPhase">'+esc(s.phase||'Desarrollo')+'</span><h4>Sesión '+esc(s.session_number)+'</h4>'+(s.purpose?'<p><b>Propósito:</b> '+esc(s.purpose)+'</p>':'')+'<p class="mpTeacherNarrative">'+esc(s.teacher_narrative||'')+'</p>'+(s.activity_blocks||[]).map(b=>'<div class="mpTeacherBlock"><b>'+esc(b.label||'Actividad')+'</b>'+(Array.isArray(b.grades)&&b.grades.length?' · '+esc(b.grades.map(g=>g+'.º').join(', ')):'')+'<br>'+esc(b.narrative||'')+'</div>').join('')+'<p class="mpTeacherNarrative"><b>Cierre:</b> '+esc(s.closure_narrative||'')+'</p></div>').join('');
 setTimeout(()=>header.scrollIntoView({behavior:'smooth',block:'start'}),80);
}
function wrap(){const prior=window.fetch.bind(window);window.fetch=async function(input,init={}){const url=typeof input==='string'?input:(input?.url||'');const r=await prior(input,init);if(url.includes('/api/gemini-plan')){const c=r.clone();c.json().then(d=>{if(r.ok&&d.teacher_presentation)setTimeout(()=>renderTeacher(d),220)}).catch(()=>{})}return r}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wrap);else wrap();
})();
</script>`;

async function planRoute(req,res){
 const auth=String(req.headers.authorization||"");if(!auth.startsWith("Bearer "))return json(res,401,{code:"AUTH_REQUIRED"});
 let raw="";try{raw=await readBody(req)}catch(e){return json(res,413,{code:"PAYLOAD_TOO_LARGE",message:String(e)})}
 let originalBody={};try{originalBody=JSON.parse(raw||"{}")}catch{return json(res,400,{code:"INVALID_JSON"})}
 try{
  const base=await fetch(CHILD_ORIGIN+"/api/gemini-plan",{method:"POST",headers:{"content-type":"application/json",authorization:auth},body:raw||"{}",signal:AbortSignal.timeout(600000)});
  const headers=copyHeaders(base),buf=Buffer.from(await base.arrayBuffer());
  if(!base.ok){res.writeHead(base.status,headers);res.end(buf);return}
  let plan;try{plan=JSON.parse(buf.toString("utf8"))}catch{res.writeHead(base.status,headers);res.end(buf);return}
  try{
   const payload={plan,methodology_selection:originalBody.methodology_selection||originalBody.metodologia||plan?.methodology_engine?.methodology_primary?.id||"abp",contexto:originalBody.contexto||"",situacion_problema:originalBody.situacion_problema||"",recursos:originalBody.recursos||""};
   const pr=await fetch(PRESENTER,{method:"POST",headers:{"content-type":"application/json",authorization:auth},body:JSON.stringify(payload),signal:AbortSignal.timeout(150000)});
   if(pr.ok){const presentation=await pr.json();plan.teacher_presentation=presentation;headers["x-multiplan-teacher-presentation"]="APPLIED";headers["x-multiplan-teacher-presentation-model"]=String(presentation.model||"unknown").slice(0,80);if(plan?.methodology_engine?.integrated_project)plan.methodology_engine.integrated_project.display_title=presentation.project_title||plan.methodology_engine.integrated_project.title}
   else headers["x-multiplan-teacher-presentation"]="UNAVAILABLE";
  }catch(e){console.error(JSON.stringify({event:"teacher_presentation_fallback",message:String(e).slice(0,300)}));headers["x-multiplan-teacher-presentation"]="UNAVAILABLE"}
  headers["content-type"]="application/json; charset=utf-8";res.writeHead(200,headers);res.end(JSON.stringify(plan));
 }catch(e){json(res,502,{code:"V0117_PLAN_ROUTE_ERROR",message:String(e)})}
}
async function proxy(req,res){try{const headers={};for(const n of["content-type","authorization","accept","cookie","user-agent"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);const r=await fetch(CHILD_ORIGIN+(req.url||"/"),init);const type=r.headers.get("content-type")||"application/octet-stream";if(req.method==="GET"&&type.includes("text/html")){let html=await r.text();if(html.includes("</body>"))html=html.replace("</body>",PATCH+"</body>");res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-multiplan-teacher-ui":"first-person-v1"});res.end(html);return}const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,copyHeaders(r));res.end(data)}catch(e){json(res,502,{code:"V0117_PROXY_ERROR",message:String(e)})}}

http.createServer(async(req,res)=>{if(req.method==="POST"&&req.url==="/api/gemini-plan")return planRoute(req,res);if(req.method==="GET"&&req.url==="/v0117_health")return json(res,200,{ok:true,version:"0.11.7",methodologyRecommendation:"API_FIRST",teacherChoice:"AUTHORITATIVE",projectTitle:"API_GENERATED",teacherVoice:"FIRST_PERSON_API_PRESENTATION",coreEngine:"V6.5 Beta.10 preserved"});return proxy(req,res)}).listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.11.7 on ${PORT}; API title + first-person teacher presentation`));
