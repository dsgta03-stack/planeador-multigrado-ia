import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V64_CHILD_PORT || 3601);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const MG_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-multigrade-didactic-v1";
const MG_ENABLED = String(process.env.MULTIPLAN_V64_MG_ENABLED || "true").toLowerCase() !== "false";

// Entire previous production stack remains intact underneath.
const child = spawn(process.execPath, ["server-v086-didactic.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[mg-didactic] child exited code=${code} signal=${signal}`);
  if (!shuttingDown) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { shuttingDown = true; try { child.kill(sig); } catch {} process.exit(0); });

function json(res, status, body, headers={}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}
function readBody(req, maxBytes=260000) {
  return new Promise((resolve,reject)=>{ let raw=""; req.on("data",c=>{raw+=c;if(raw.length>maxBytes){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy();}}); req.on("end",()=>resolve(raw)); req.on("error",reject); });
}
async function call(url, raw, authorization, timeout=115000) {
  const r = await fetch(url, { method:"POST", headers:{"content-type":"application/json",authorization}, body:raw||"{}", signal:AbortSignal.timeout(timeout) });
  return { status:r.status, contentType:r.headers.get("content-type")||"application/json; charset=utf-8", data:Buffer.from(await r.arrayBuffer()), engine:r.headers.get("x-multiplan-plan-engine")||"" };
}
function send(res, result, engine, extra={}) {
  res.writeHead(result.status, { "content-type":result.contentType, "cache-control":"no-store", "x-multiplan-plan-engine":engine, ...extra });
  res.end(result.data);
}

async function routePlan(req,res) {
  const authorization=String(req.headers.authorization||"");
  if(!authorization.startsWith("Bearer ")) return json(res,401,{code:"AUTH_REQUIRED"});
  let raw; try{raw=await readBody(req);}catch(e){return json(res,413,{code:"PAYLOAD_TOO_LARGE",message:String(e)});}
  let body; try{body=JSON.parse(raw||"{}");}catch{return json(res,400,{code:"INVALID_JSON"});}
  const grades=[...new Set((Array.isArray(body?.grados)?body.grados:[]).map(Number).filter(Number.isInteger))];
  const multi=grades.length>=2;

  if(MG_ENABLED && multi){
    try{
      const mg=await call(MG_URL,raw,authorization);
      if(mg.status<500 && mg.status!==422) return send(res,mg,"V6.4-MULTIGRADE-DIDACTIC-BETA.1");
      const fallback=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,90000);
      return send(res,fallback,fallback.engine||"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",{
        "x-multiplan-fallback":"v6.2.1-multigrade-stable",
        "x-multiplan-v64-mg-status":String(mg.status),
      });
    }catch(error){
      try{
        const fallback=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,90000);
        return send(res,fallback,fallback.engine||"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",{"x-multiplan-fallback":"v6.2.1-multigrade-network"});
      }catch(fallbackError){ return json(res,502,{code:"V64_MG_AND_FALLBACK_FAILED",message:String(error),fallback:String(fallbackError)}); }
    }
  }
  try{const r=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,115000);return send(res,r,r.engine||"V6.4-DIDACTIC-EXECUTION-BETA.2");}
  catch(error){return json(res,502,{code:"V64_CHILD_ERROR",message:String(error)});}
}

function renderer(){return String.raw`
<script>
(()=>{
 const safe=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const grades=xs=>(Array.isArray(xs)?xs:[]).map(g=>g+'.º').join(', ');
 const previous=window.renderSessions;
 function directStep(p){return '<div style="margin:8px 0;padding:10px 11px;background:#f8fbf8;border-left:3px solid #6f9d80;border-radius:7px"><b>Paso '+safe(p.step)+' · '+safe(p.minutes)+' min</b><br><b>Docente:</b> '+safe(p.teacher_action)+'<br><b>Alumnos:</b> '+safe(p.student_action)+'<br><b>Consigna:</b> “'+safe(p.teacher_prompt)+'”<br><b>Resultado esperado:</b> '+safe(p.expected_result)+'<br><b>Antes de avanzar:</b> '+safe(p.check_before_next)+'</div>';}
 function autoStep(p){return '<div style="margin:8px 0;padding:10px 11px;background:#faf9f2;border-left:3px solid #b39a4a;border-radius:7px"><b>Paso '+safe(p.step)+' · '+safe(p.minutes)+' min</b><br><b>Qué hacen:</b> '+safe(p.student_action)+'<br><b>Cómo se revisan solos:</b> '+safe(p.self_check)+'<br><b>Si se atoran:</b> '+safe(p.if_stuck)+(Array.isArray(p.materials)&&p.materials.length?'<br><b>Material:</b> '+safe(p.materials.join(', ')):'')+'<br><b>Resultado esperado:</b> '+safe(p.expected_result)+'</div>';}
 function projectCard(data){const p=data?.multigrade_project;if(!p)return '';return '<div class="notice" style="margin-bottom:14px"><b>Proyecto común multigrado: '+safe(p.title)+'</b><br><b>Problema:</b> '+safe(p.common_problem)+'<br><b>Pregunta guía:</b> '+safe(p.guiding_question)+'<br><b>Producto colectivo:</b> '+safe(p.final_collective_product)+'<div style="margin-top:8px"><b>Aporte por grado:</b>'+(p.grade_contributions||[]).map(c=>'<div style="margin:5px 0 0 12px"><b>'+safe(c.grade)+'.º:</b> '+safe(c.contribution)+' <span class="muted">— '+safe(c.evidence)+'</span></div>').join('')+'</div></div>';}
 function renderMG(data){if(!String(data?.engineVersion||'').startsWith('V6.4-MULTIGRADE'))return '';const ss=Array.isArray(data.sessions)?data.sessions:[];return projectCard(data)+ss.map(s=>'<div class="session"><strong>Sesión '+safe(s.session_number)+' · '+safe(s.total_minutes)+' min</strong>'+(s.purpose?'<br><b>Propósito:</b> '+safe(s.purpose):'')+(s.session_story?'<div class="muted" style="margin-top:5px"><b>Hilo de la sesión:</b> '+safe(s.session_story)+'</div>':'')+'<div class="gradeBlock" style="margin-top:10px"><b>Apertura común · '+safe(s.opening_minutes)+' min</b><br>'+safe(s.common_opening||'')+'</div>'+(s.work_moments||[]).map(m=>{
   const direct='<div style="padding:12px;border:1px solid #bdd7c6;border-radius:9px;background:#f4faf6"><b>CON EL DOCENTE · '+safe(grades(m.direct_teacher_grades))+'</b>'+(m.direct_activity_title?'<div style="font-size:16px;font-weight:900;margin:5px 0">'+safe(m.direct_activity_title)+'</div>':'')+'<b>Qué hará el docente:</b> '+safe(m.direct_teacher_action_detail||m.direct_teacher_action||'')+'<br><b>Qué harán los alumnos:</b> '+safe(m.direct_student_action||'')+'<div style="margin-top:8px;font-weight:900">Procedimiento</div>'+(m.direct_procedure||[]).map(directStep).join('')+(m.direct_support_if_needed?'<b>Si necesitan apoyo:</b> '+safe(m.direct_support_if_needed)+'<br>':'')+(m.direct_transition?'<b>Transición:</b> '+safe(m.direct_transition)+'<br>':'')+(m.direct_evidence_detail?'<b>Evidencia detallada:</b> '+safe(m.direct_evidence_detail):'')+'</div>';
   const autos=(m.other_blocks||[]).map(b=>'<div style="padding:12px;border:1px solid #e0d5a8;border-radius:9px;background:#fffdf6;margin-top:9px"><b>TRABAJO AUTÓNOMO · '+safe(grades(b.grades))+'</b>'+(b.activity_title?'<div style="font-size:16px;font-weight:900;margin:5px 0">'+safe(b.activity_title)+'</div>':'')+'<b>Antes de que el docente rote:</b> '+safe(b.instructions_before_rotation||'')+'<br><b>Qué harán sin el docente:</b> '+safe(b.activity_detail||b.activity||'')+'<div style="margin-top:8px;font-weight:900">Procedimiento autónomo</div>'+(b.procedure||[]).map(autoStep).join('')+(b.autonomy_support_detail?'<b>Apoyo preparado:</b> '+safe(b.autonomy_support_detail)+'<br>':'')+(b.transition?'<b>Al terminar:</b> '+safe(b.transition)+'<br>':'')+(b.evidence_detail?'<b>Evidencia:</b> '+safe(b.evidence_detail):'')+'</div>').join('');
   return '<div class="gradeBlock" style="border-left:4px solid #1d6a45"><b>Momento '+safe(m.moment)+' · '+safe(m.minutes)+' min</b><div style="margin-top:9px">'+direct+'</div>'+(autos?'<div style="margin-top:10px"><b>Mientras el docente trabaja con ese bloque:</b>'+autos+'</div>':'')+'</div>';
 }).join('')+'<div class="gradeBlock"><b>Cierre común · '+safe(s.closure_minutes)+' min</b><br>'+safe(s.common_closure||'')+'</div>'+(s.prepares_next?'<div class="muted"><b>Prepara la siguiente sesión:</b> '+safe(s.prepares_next)+'</div>':'')+'</div>').join('');}
 window.renderSessions=function(data){const target=document.getElementById('sessionsPlan');if(!target)return;const mg=renderMG(data);if(mg){let old='';try{if(typeof previous==='function'){previous(data);old=target.innerHTML||'';}}catch(e){console.error(e)}target.innerHTML=mg+(old?'<details style="margin-top:14px"><summary style="cursor:pointer;font-weight:800">Ver vista anterior</summary><div style="margin-top:10px">'+old+'</div></details>':'');return;}if(typeof previous==='function')return previous(data);};
 try{renderSessions=window.renderSessions;}catch{}
})();
</script>`;}

async function proxy(req,res){try{const headers={};for(const n of ["content-type","authorization","accept","cookie"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);const r=await fetch(CHILD_ORIGIN+req.url,init);const type=r.headers.get("content-type")||"application/octet-stream";if(req.method==="GET"&&req.url==="/"&&type.includes("text/html")){let html=await r.text();html=html.replaceAll("Multiplan · motor V6.4 didáctico · respaldo V6.3/V6.2.1","Multiplan · V6.4 didáctico para 1.º–6.º · respaldo estable");html=html.replace("</body>",renderer()+"</body>");res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});return res.end(html);}const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data);}catch(e){json(res,502,{code:"MG_CHILD_PROXY_ERROR",message:String(e)});}}

const server=http.createServer(async(req,res)=>{
 if(req.method==="GET"&&req.url==="/health"){try{const r=await fetch(CHILD_ORIGIN+"/health");const childHealth=await r.json().catch(()=>({}));return json(res,r.ok?200:503,{ok:r.ok,version:"0.8.8",renderer:"MULTIGRADE-STEP-BY-STEP-V1",multigradeDidacticEnabled:MG_ENABLED,multigradeEngine:MG_ENABLED?"V6.4-MULTIGRADE-DIDACTIC-BETA.1":"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",multigradeFallback:"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",singleGradeEngine:"V6.4-DIDACTIC-EXECUTION-BETA.2",lowerFallbacks:["V6.3-PROJECT-ACTION-CONTINUITY-BETA.4","V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA","PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE"],child:childHealth});}catch(e){return json(res,503,{ok:false,version:"0.8.8",code:"MG_CHILD_NOT_READY",message:String(e)});}}
 if(req.method==="POST"&&req.url==="/api/gemini-plan")return routePlan(req,res);
 return proxy(req,res);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan V6.4 multigrade didactic router on ${PORT}; child on ${CHILD_PORT}; enabled=${MG_ENABLED}`));