import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_UI_VISIBILITY_CHILD_PORT || 5901);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;

const child = spawn(process.execPath, ["server-v0114-ui-root-normalizer.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[ui-plan-visibility] child exited code=${code} signal=${signal}`);
  if (!stopping) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => {
  stopping = true;
  try { child.kill(sig); } catch {}
  process.exit(0);
});

function readBody(req, max = 600000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > max) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function visibilityPatch() {
  return String.raw`
<style id="mp-plan-visibility-style">
#mpGenerationStatus{margin:14px 0;padding:13px 15px;border:1px solid #b9d5f4;border-radius:12px;background:#eef6ff;color:#244d75;font-weight:700;line-height:1.45}
#mpGenerationStatus.mp-error{border-color:#efc1c1;background:#fff1f1;color:#8b3030}
#mpVisiblePlan{margin:0 0 18px;padding:22px;border:2px solid #9bc8f4;border-radius:16px;background:#fff;box-shadow:0 12px 30px rgba(26,58,92,.08)}
#mpVisiblePlan h2{margin:0 0 8px;font-size:23px;color:#10233c}#mpVisiblePlan h3{margin:18px 0 8px;font-size:17px;color:#173f66}
#mpVisiblePlan .mpv-badges{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 14px}.mpv-badge{padding:5px 9px;border-radius:999px;background:#eef6ff;border:1px solid #d7e7f7;color:#315c83;font-size:12px;font-weight:800}
#mpVisiblePlan .mpv-box{padding:12px 14px;margin:9px 0;border:1px solid #dfe7f1;border-radius:11px;background:#f8fbfe;line-height:1.5}
#mpVisiblePlan .mpv-moment{padding:12px 14px;margin:10px 0;border-left:4px solid #1674e8;background:#f8fbff;border-radius:8px;line-height:1.5}
#mpVisiblePlan .mpv-grade{margin:7px 0;padding:9px 11px;border:1px solid #e1e8ef;border-radius:9px;background:white}
</style>
<script id="mp-plan-visibility-script">
(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function statusBox(message,isError=false){
    let box=document.getElementById('mpGenerationStatus');
    if(!box){box=document.createElement('div');box.id='mpGenerationStatus';const results=document.getElementById('results');const actions=results?.querySelector('.actions');if(actions)actions.insertAdjacentElement('beforebegin',box);else (results||document.body).appendChild(box);}
    box.className=isError?'mp-error':'';box.innerHTML=message;box.style.display='block';return box;
  }
  function updateContinue(){
    const b=document.getElementById('continue');if(!b)return;
    if(b.disabled){b.textContent='Selecciona al menos un PDA para generar';b.title='La selección curricular la realiza el docente.';}
    else{b.textContent='Generar planeación';b.title='Generar la planeación con los PDA seleccionados.';}
  }
  function renderPlan(data){
    const plan=document.getElementById('plan');if(plan)plan.classList.remove('hidden');
    let panel=document.getElementById('mpVisiblePlan');
    if(!panel){panel=document.createElement('div');panel.id='mpVisiblePlan';if(plan)plan.insertBefore(panel,plan.firstChild);else document.body.appendChild(panel);}
    const method=data?.methodology_engine?.methodology_primary?.label || data?.methodology_engine?.methodology_primary?.id || 'Metodología seleccionada';
    const engine=data?.engineVersion || data?.methodology_engine?.version || '';
    const sessions=Array.isArray(data?.sessions)?data.sessions:[];
    const pdaJust=Array.isArray(data?.pda_justifications)?data.pda_justifications:[];
    const evals=Array.isArray(data?.evaluation)?data.evaluation:[];
    const sessionHtml=sessions.map(s=>{
      const moments=(s.work_moments||[]).map(m=>{
        const direct='<div class="mpv-grade"><b>Atención directa:</b> '+esc(m.direct_teacher_block||'')+'<br>'+esc(m.direct_teacher_action||'')+'</div>';
        const others=(m.other_blocks||[]).map(b=>'<div class="mpv-grade"><b>'+esc(b.block||'Trabajo autónomo')+'</b>'+(Array.isArray(b.grades)&&b.grades.length?' · '+esc(b.grades.map(g=>g+'.º').join(', ')):'')+'<br><b>Actividad:</b> '+esc(b.activity||'')+(b.evidence?'<br><b>Evidencia:</b> '+esc(b.evidence):'')+(b.assessment?'<br><b>Seguimiento:</b> '+esc(b.assessment):'')+'</div>').join('');
        return '<div class="mpv-moment"><b>Momento '+esc(m.moment||'')+' · '+esc(m.minutes||'')+' min</b>'+direct+others+'</div>';
      }).join('');
      return '<div class="mpv-box"><h3>Sesión '+esc(s.session_number||'')+' · '+esc(s.total_minutes||'')+' min</h3><b>Propósito:</b> '+esc(s.purpose||'')+(s.common_opening?'<p><b>Apertura común:</b> '+esc(s.common_opening)+'</p>':'')+moments+(s.common_closure?'<p><b>Cierre común:</b> '+esc(s.common_closure)+'</p>':'')+'</div>';
    }).join('');
    const pdaHtml=pdaJust.length?'<h3>PDA seleccionados</h3>'+pdaJust.map(p=>'<div class="mpv-grade"><b>'+esc(p.pda_id||'PDA')+'</b><br>'+esc(p.justification||p.role_in_common_experience||'Vinculado a la experiencia común.')+'</div>').join(''):'';
    const evHtml=evals.length?'<h3>Evaluación</h3>'+evals.map(e=>'<div class="mpv-grade"><b>'+esc(e.pda_id||'')+'</b>'+(e.criterion?'<br><b>Criterio:</b> '+esc(e.criterion):'')+(e.evidence?'<br><b>Evidencia:</b> '+esc(e.evidence):'')+(e.instrument?'<br><b>Instrumento:</b> '+esc(e.instrument):'')+'</div>').join(''):'';
    panel.innerHTML='<h2>Planeación generada</h2><div class="mpv-badges"><span class="mpv-badge">'+esc(method)+'</span>'+(engine?'<span class="mpv-badge">'+esc(engine)+'</span>':'')+'<span class="mpv-badge">'+sessions.length+' sesión'+(sessions.length===1?'':'es')+'</span></div>'+(data?.diagnosis?'<div class="mpv-box"><b>Diagnóstico interpretativo</b><br>'+esc(data.diagnosis)+'</div>':'')+(data?.guiding_question?'<div class="mpv-box"><b>Pregunta articuladora</b><br>'+esc(data.guiding_question)+'</div>':'')+pdaHtml+'<h3>Secuencia didáctica</h3>'+(sessionHtml||'<div class="mpv-box">La generación terminó, pero no devolvió sesiones visibles.</div>')+evHtml;
    const st=document.getElementById('mpGenerationStatus');if(st)st.style.display='none';
    setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),50);
  }
  function setup(){
    updateContinue();
    const b=document.getElementById('continue');if(b)new MutationObserver(updateContinue).observe(b,{attributes:true,attributeFilter:['disabled']});
    const priorFetch=window.fetch.bind(window);
    window.fetch=async function(input,init={}){
      const url=typeof input==='string'?input:(input?.url||'');
      const isPlan=url.includes('/api/gemini-plan');
      if(isPlan)statusBox('<b>Generando planeación…</b><br>El motor está construyendo y validando la secuencia. Puede tardar alrededor de 1–2 minutos; no recargues la página.');
      try{
        const response=await priorFetch(input,init);
        if(isPlan){
          const copy=response.clone();
          copy.json().then(data=>{
            if(response.ok)renderPlan(data);
            else statusBox('<b>No se pudo generar la planeación.</b><br>'+esc(data?.message||data?.code||('HTTP '+response.status)),true);
          }).catch(e=>statusBox('<b>La respuesta llegó, pero no pudo mostrarse.</b><br>'+esc(String(e)),true));
        }
        return response;
      }catch(e){if(isPlan)statusBox('<b>Error de conexión al generar.</b><br>'+esc(String(e)),true);throw e;}
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
</script>`;
}

async function proxy(req, res) {
  try {
    const headers = {};
    for (const name of ["content-type", "authorization", "accept", "cookie", "user-agent"]) if (req.headers[name]) headers[name] = req.headers[name];
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const upstream = await fetch(CHILD_ORIGIN + (req.url || "/"), init);
    const type = upstream.headers.get("content-type") || "application/octet-stream";
    if (req.method === "GET" && (req.url === "/" || String(req.url||"").startsWith("/?")) && type.includes("text/html")) {
      let html = await upstream.text();
      html = html.replace("</body>", visibilityPatch() + "</body>");
      res.writeHead(upstream.status, {"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-multiplan-plan-visibility":"v0.11.5"});
      res.end(html);return;
    }
    const data = Buffer.from(await upstream.arrayBuffer());
    const outHeaders = {"content-type":type,"cache-control":upstream.headers.get("cache-control")||"no-store"};
    for (const name of ["x-multiplan-ui","x-multiplan-plan-engine","x-multiplan-safe-fallback","x-multiplan-v65-promotion","x-multiplan-v64-base","x-multiplan-provider-degraded"]) { const v=upstream.headers.get(name);if(v)outHeaders[name]=v; }
    res.writeHead(upstream.status,outHeaders);res.end(data);
  } catch (error) {
    res.writeHead(502,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
    res.end(JSON.stringify({code:"UI_PLAN_VISIBILITY_ERROR",message:String(error)}));
  }
}

http.createServer(proxy).listen(PORT,"0.0.0.0",()=>{
  console.log(`Multiplan UI v0.11.5 plan visibility on ${PORT}; child v0.11.4 on ${CHILD_PORT}`);
});
