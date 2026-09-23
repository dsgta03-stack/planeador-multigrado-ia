import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V0124_CHILD_PORT || 6901);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const REVIEW_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-review-pedagogical-v1";

const child = spawn(process.execPath, ["server-v0123-workflow-guidance.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[v0124] child exited code=${code} signal=${signal}`);
  if (!stopping) setTimeout(() => process.exit(code || 1), 50);
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    stopping = true;
    try { child.kill(signal); } catch {}
    process.exit(0);
  });
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extra,
  });
  res.end(JSON.stringify(body));
}

function readBody(req, max = 1_500_000) {
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

function bearer(req) {
  const value = String(req.headers.authorization || "");
  return value.startsWith("Bearer ") ? value : "";
}

async function reviewRoute(req, res) {
  const authorization = bearer(req);
  if (!authorization) return json(res, 401, { code: "AUTH_REQUIRED" });
  let raw;
  try {
    raw = await readBody(req);
    JSON.parse(raw || "{}");
  } catch (error) {
    return json(res, String(error).includes("PAYLOAD_TOO_LARGE") ? 413 : 400, {
      code: String(error).includes("PAYLOAD_TOO_LARGE") ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
    });
  }
  try {
    const response = await fetch(REVIEW_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: raw || "{}",
      signal: AbortSignal.timeout(140_000),
    });
    const data = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, {
      "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-multiplan-pedagogical-review": response.headers.get("x-multiplan-pedagogical-review") || "PEDAGOGICAL-REVIEW-V1-SHADOW",
      "x-multiplan-review-mode": response.headers.get("x-multiplan-review-mode") || "shadow",
    });
    res.end(data);
  } catch (error) {
    json(res, 502, { code: "PEDAGOGICAL_REVIEW_UPSTREAM_ERROR", message: String(error).slice(0, 300) });
  }
}

const REVIEW_UI = String.raw`
<style id="mp-pedagogical-review-style">
#mpPedagogicalReview{margin:0 0 18px;padding:20px;background:#fff;border:1px solid #dfe7f1;border-radius:18px;box-shadow:0 10px 28px rgba(26,58,92,.06)}
.mp-review-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.mp-review-head h2{margin:0 0 5px;font-size:19px;color:#10233c}.mp-review-head p{margin:0;color:#6f7f92;font-size:12px;line-height:1.5;max-width:760px}.mp-review-btn{border:0;border-radius:11px;background:linear-gradient(90deg,#0f62cc,#1674e8);color:#fff;padding:11px 15px;font-weight:850;cursor:pointer;white-space:nowrap}.mp-review-btn:disabled{opacity:.45;cursor:not-allowed}.mp-review-state{margin-top:14px;padding:13px 14px;border-radius:12px;background:#f6f9fc;border:1px solid #e0e8f0;color:#52697f;font-size:13px;line-height:1.5}.mp-review-state.is-running{background:#eef6ff;border-color:#cfe3f8;color:#285c8b}.mp-review-state.is-error{background:#fff1f1;border-color:#efc8c8;color:#8b3030}.mp-review-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.mp-review-stat{border:1px solid #dfe7f1;border-radius:12px;padding:12px;background:#f9fbfd}.mp-review-stat span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#718197;font-weight:850}.mp-review-stat strong{display:block;margin-top:4px;font-size:20px;color:#193b5b}.mp-review-status{margin-top:14px;padding:12px 14px;border-radius:12px;font-weight:850}.mp-review-status.blocked{background:#fff0f0;border:1px solid #edc2c2;color:#8b3030}.mp-review-status.adjust{background:#fff7e8;border:1px solid #efd6a7;color:#7a4c0b}.mp-review-status.good{background:#edf8f2;border:1px solid #c7e8d5;color:#17643f}.mp-review-status.stale{background:#f4f5f7;border:1px solid #dedfe3;color:#636a75}.mp-review-groups{display:grid;gap:12px;margin-top:14px}.mp-review-group{border:1px solid #e0e8f0;border-radius:13px;overflow:hidden}.mp-review-group h3{margin:0;padding:11px 13px;background:#f7f9fc;font-size:14px;color:#24425f}.mp-review-finding{padding:12px 13px;border-top:1px solid #edf1f5}.mp-review-finding:first-of-type{border-top:0}.mp-review-rule{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mp-review-rule b{font-size:12px}.mp-review-chip{font-size:10px;font-weight:900;padding:3px 6px;border-radius:999px}.mp-review-chip.critical{background:#ffeded;color:#8b3030}.mp-review-chip.warning{background:#fff4d7;color:#815305}.mp-review-finding p{margin:7px 0 0;font-size:12px;line-height:1.5;color:#52697f}.mp-review-note{margin-top:13px;font-size:11px;color:#738398;line-height:1.45}.mp-review-empty{padding:14px;color:#567086;font-size:12px}.mp-review-degraded{margin-top:10px;padding:9px 11px;border-radius:10px;background:#fff7e8;border:1px solid #efd6a7;color:#71460b;font-size:11px}
@media(max-width:760px){.mp-review-head{display:block}.mp-review-btn{width:100%;margin-top:12px}.mp-review-summary{grid-template-columns:1fr 1fr}}
</style>
<script id="mp-pedagogical-review-script">(()=>{
  const GROUPS={PRJ:'Proyecto',PDA:'PDA y evaluación',SES:'Continuidad de sesiones',MET:'Metodología NEM',EVD:'Evidencias y productos',MG:'Organización multigrado',LTG:'Libros de Texto Gratuitos',TIME:'Tiempo y viabilidad',COH:'Coherencia global'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let signatureAtReview='';

  function getState(){try{return state}catch{return null}}
  function selectedPdas(){const s=getState();try{return Object.values(s?.selected||{}).filter(Boolean).map(x=>({id:x.pda_id||x.id,grade:Number(x.grade)||null,text:x.pda_official||x.text||'',content:x.content_official||x.content||''}))}catch{return []}}
  function chosenMethod(){const checked=document.querySelector('#mpMethodologyStep input[name="mpMethod"]:checked');if(checked)return checked.value;const s=getState();return s?.latestPlanData?.methodology_engine?.methodology_primary?.id||s?.latestPlanData?.methodology_engine?.methodology_primary?.label||''}
  function planData(){const s=getState();return s?.latestPlanData&&typeof s.latestPlanData==='object'?s.latestPlanData:null}
  function planReady(){const p=planData();return !!(p&&Object.keys(p).length)}
  function inputSignature(){
    const p=planData();
    const payload={context:document.getElementById('context')?.value?.trim()||'',problem:document.getElementById('problem')?.value?.trim()||'',method:chosenMethod(),pdas:selectedPdas().map(x=>[x.id,x.grade]).sort(),run_id:p?.run_id||'',engine:p?.engineVersion||'',sessions:(p?.sessions||[]).map(s=>[s.session_number,s.purpose,s.total_minutes])};
    return JSON.stringify(payload);
  }
  function invalidateIfChanged(){
    const s=getState();if(!s?.pedagogicalReview)return;
    if(signatureAtReview&&inputSignature()!==signatureAtReview){s.pedagogicalReview=null;renderStale();}
  }
  function shellReady(){
    if(document.getElementById('mpPedagogicalReview'))return;
    const workflow=document.getElementById('mpWorkflowV0123'),legacy=document.getElementById('mpLegacyMain');
    if(!workflow||!legacy)return setTimeout(shellReady,100);
    const box=document.createElement('section');box.id='mpPedagogicalReview';
    box.innerHTML='<div class="mp-review-head"><div><h2>Revisión pedagógica</h2><p>Comprueba coherencia del proyecto, PDA, metodología, sesiones, evidencias, organización multigrado y tiempo. Esta revisión no cambia tus PDA ni reescribe la planeación.</p></div><button type="button" class="mp-review-btn" id="mpReviewRun" disabled>Revisar planeación</button></div><div id="mpReviewContent" class="mp-review-state">Genera una planeación para habilitar la revisión.</div>';
    const note=document.getElementById('mpWorkflowNote');(note||workflow).insertAdjacentElement('afterend',box);
    document.getElementById('mpReviewRun').addEventListener('click',runReview);
    document.addEventListener('input',invalidateIfChanged,true);document.addEventListener('change',invalidateIfChanged,true);document.addEventListener('click',()=>setTimeout(()=>{invalidateIfChanged();updateButton()},140),true);
    setInterval(()=>{updateButton();invalidateIfChanged();syncVisibility()},1000);
    updateButton();syncVisibility();
  }
  function syncVisibility(){const history=document.getElementById('mpHistoryView');const hidden=history&&getComputedStyle(history).display!=='none';const box=document.getElementById('mpPedagogicalReview');if(box)box.style.display=hidden?'none':''}
  function updateButton(){const b=document.getElementById('mpReviewRun');if(!b)return;const ready=planReady();b.disabled=!ready;if(!ready)b.textContent='Revisar planeación';}
  function renderStale(){const root=document.getElementById('mpReviewContent');if(!root)return;root.className='mp-review-state';root.innerHTML='<div class="mp-review-status stale">Revisión desactualizada</div><div class="mp-review-note">La planeación o sus insumos cambiaron. Ejecuta de nuevo la revisión para obtener un resultado vigente.</div>';}
  function payload(){const p=planData(),pdas=selectedPdas();return{plan:p,context:document.getElementById('context')?.value?.trim()||'',problem:document.getElementById('problem')?.value?.trim()||'',methodology:chosenMethod(),selected_pdas:pdas,requested_sessions:Number(document.getElementById('sessions')?.value||p?.requestedSessions||0)||null,minutes_per_session:Number(document.getElementById('minutes')?.value||p?.minutesPerSession||0)||null,mode:'review-only'}}
  async function runReview(){
    const root=document.getElementById('mpReviewContent'),button=document.getElementById('mpReviewRun');if(!root||!button||!planReady())return;
    button.disabled=true;button.textContent='Revisando…';root.className='mp-review-state is-running';root.innerHTML='<b>Analizando coherencia pedagógica…</b><br>Se revisan reglas estructurales y semánticas sin modificar la planeación.';
    try{
      const response=await fetch('/api/pedagogical-review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload())});
      const data=await response.json();if(!response.ok)throw new Error(data.code==='AUTH_REQUIRED'?'Inicia sesión para ejecutar la revisión pedagógica.':(data.message||data.code||'No fue posible revisar la planeación.'));
      const s=getState();if(s)s.pedagogicalReview=data;signatureAtReview=inputSignature();render(data);
    }catch(error){const s=getState();if(s)s.pedagogicalReview=null;root.className='mp-review-state is-error';root.innerHTML='<b>No se pudo ejecutar la revisión.</b><br>'+esc(error.message||error);}
    finally{button.textContent='Revisar de nuevo';button.disabled=!planReady();}
  }
  function statusLabel(status){if(status==='BLOCKED')return['blocked','🔴 Requiere correcciones antes de considerarse validada'];if(status==='NEEDS_ADJUSTMENT')return['adjust','🟡 Utilizable con ajustes pedagógicos'];return['good','🟢 Coherencia pedagógica suficiente']}
  function render(data){
    const root=document.getElementById('mpReviewContent');if(!root)return;root.className='';const [klass,label]=statusLabel(data.status);
    const findings=Array.isArray(data.findings)?data.findings:[];const grouped={};findings.forEach(f=>{const key=String(f.rule_id||'').split('-')[0]||'COH';(grouped[key] ||= []).push(f)});
    const groups=Object.entries(grouped).map(([key,rows])=>'<section class="mp-review-group"><h3>'+esc(GROUPS[key]||key)+'</h3>'+rows.map(f=>'<article class="mp-review-finding"><div class="mp-review-rule"><b>'+esc(f.rule_id)+'</b><span class="mp-review-chip '+(f.severity==='CRITICAL'?'critical':'warning')+'">'+(f.severity==='CRITICAL'?'Crítico':'Ajuste')+'</span></div><p><b>Qué ocurre:</b> '+esc(f.failure||'Hallazgo detectado.')+'</p>'+(f.observed_evidence?'<p><b>Evidencia:</b> '+esc(f.observed_evidence)+'</p>':'')+(f.recommendation?'<p><b>Qué conviene hacer:</b> '+esc(f.recommendation)+'</p>':'')+'</article>').join('')+'</section>').join('');
    const degraded=data?.semantic_review?.status==='DEGRADED'?'<div class="mp-review-degraded">La revisión semántica no estuvo disponible completamente. Se conservaron las verificaciones deterministas; algunos criterios quedan como no evaluables.</div>':'';
    root.innerHTML='<div class="mp-review-status '+klass+'">'+label+'</div><div class="mp-review-summary"><div class="mp-review-stat"><span>Puntaje orientativo</span><strong>'+esc(data.score??'—')+'</strong></div><div class="mp-review-stat"><span>Críticos</span><strong>'+esc(data.critical_count??0)+'</strong></div><div class="mp-review-stat"><span>Ajustes</span><strong>'+esc(data.warning_count??0)+'</strong></div><div class="mp-review-stat"><span>No evaluables</span><strong>'+esc(data.not_evaluable_count??0)+'</strong></div></div>'+degraded+'<div class="mp-review-groups">'+(groups||'<div class="mp-review-empty">No se detectaron hallazgos críticos ni ajustes sustentados en esta revisión.</div>')+'</div><div class="mp-review-note">Versión: '+esc(data.review_version||'PEDAGOGICAL-REVIEW-V1-SHADOW')+' · modo shadow. El puntaje orienta; ningún puntaje alto compensa un hallazgo crítico.</div>';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',shellReady);else shellReady();
})();</script>`;

async function proxy(req, res) {
  try {
    const headers = {};
    for (const name of ["content-type", "authorization", "accept", "cookie", "user-agent"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const response = await fetch(CHILD_ORIGIN + (req.url || "/"), init);
    const type = response.headers.get("content-type") || "application/octet-stream";
    if (req.method === "GET" && type.includes("text/html")) {
      let html = await response.text();
      if (html.includes("</body>")) html = html.replace("</body>", REVIEW_UI + "</body>");
      res.writeHead(response.status, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-multiplan-pedagogical-review-ui": "v0.12.4-shadow",
      });
      res.end(html);
      return;
    }
    const data = Buffer.from(await response.arrayBuffer());
    const outgoing = {
      "content-type": type,
      "cache-control": response.headers.get("cache-control") || "no-store",
    };
    for (const name of [
      "x-multiplan-plan-engine","x-multiplan-safe-fallback","x-multiplan-v65-promotion",
      "x-multiplan-methodology-sequence","x-multiplan-session-count-preserved",
      "x-multiplan-workflow-ui",
    ]) {
      const value = response.headers.get(name);if(value)outgoing[name]=value;
    }
    res.writeHead(response.status, outgoing);res.end(data);
  } catch (error) {
    json(res, 502, { code: "V0124_PROXY_ERROR", message: String(error) });
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/v0124_health") {
    return json(res, 200, {
      ok: true,
      version: "0.12.4-shadow",
      base: "0.12.3",
      pedagogicalReview: "PEDAGOGICAL-REVIEW-V1-SHADOW",
      reviewMode: "NON_GOVERNING",
      mutatesPlan: false,
      mutatesCurriculum: false,
      productionModified: false,
    });
  }
  if (req.method === "POST" && url.pathname === "/api/pedagogical-review") return reviewRoute(req, res);
  return proxy(req, res);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan v0.12.4 shadow on ${PORT}; Pedagogical Review V1 non-governing over v0.12.3`);
});
