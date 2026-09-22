import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V0121_CHILD_PORT || 6601);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const SUPABASE_URL = "https://dvcrwzxznuqongutnifn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_a2rcBHsCpg2Nr1KE1I_o1A_j2lXRDoA";

const child = spawn(process.execPath, ["server-v0120-official-methodology-sequence.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[v0121] child exited code=${code} signal=${signal}`);
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

function readBody(req, max = 1_000_000) {
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

async function rest(path, authorization) {
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization,
      accept: "application/json",
      "accept-profile": "public",
    },
    signal: AbortSignal.timeout(20_000),
  });
}

async function listHistory(req, res) {
  const authorization = bearer(req);
  if (!authorization) return json(res, 401, { code: "AUTH_REQUIRED" });
  try {
    const select = [
      "run_id", "created_at", "updated_at", "status", "engine_version", "title",
      "grades", "session_count", "minutes_per_session", "methodology_id",
      "methodology_label", "has_output", "base_run_id",
    ].join(",");
    const response = await rest(`plan_history?select=${select}&order=created_at.desc&limit=100`, authorization);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(JSON.stringify({ event: "plan_history_list_error", status: response.status, detail: data?.message || data?.code || null }));
      return json(res, response.status === 401 || response.status === 403 ? response.status : 502, {
        code: response.status === 401 || response.status === 403 ? "AUTH_REQUIRED" : "HISTORY_READ_FAILED",
      });
    }
    return json(res, 200, { items: Array.isArray(data) ? data : [] });
  } catch (error) {
    console.error(JSON.stringify({ event: "plan_history_list_exception", message: String(error).slice(0, 300) }));
    return json(res, 502, { code: "HISTORY_READ_FAILED" });
  }
}

async function historyDetail(req, res, runId) {
  const authorization = bearer(req);
  if (!authorization) return json(res, 401, { code: "AUTH_REQUIRED" });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    return json(res, 400, { code: "INVALID_RUN_ID" });
  }
  try {
    const select = "run_id,created_at,updated_at,status,engine_version,input_json,model_output_json,validator_json,error_message";
    const response = await rest(`plan_runs?select=${select}&run_id=eq.${encodeURIComponent(runId)}&limit=1`, authorization);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(JSON.stringify({ event: "plan_history_detail_error", status: response.status, run_id: runId, detail: data?.message || data?.code || null }));
      return json(res, response.status === 401 || response.status === 403 ? response.status : 502, {
        code: response.status === 401 || response.status === 403 ? "AUTH_REQUIRED" : "HISTORY_DETAIL_FAILED",
      });
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return json(res, 404, { code: "PLAN_NOT_FOUND" });
    return json(res, 200, row);
  } catch (error) {
    console.error(JSON.stringify({ event: "plan_history_detail_exception", run_id: runId, message: String(error).slice(0, 300) }));
    return json(res, 502, { code: "HISTORY_DETAIL_FAILED" });
  }
}

const HISTORY_UI = String.raw`
<style id="mp-history-style">
#mpHistoryView{display:none}.mp-history-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.mp-history-head h2{margin:0 0 6px;font-size:26px}.mp-history-head p{margin:0;color:var(--muted,#6f7f92)}.mp-history-refresh{border:1px solid #d9e4ee;background:#fff;color:#29425e;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer}.mp-history-state{padding:34px;text-align:center;background:#fff;border:1px solid var(--line,#dfe7f1);border-radius:18px;color:var(--muted,#6f7f92)}.mp-history-list{display:grid;gap:12px}.mp-history-card{background:#fff;border:1px solid var(--line,#dfe7f1);border-radius:17px;padding:18px 19px;box-shadow:0 8px 22px rgba(26,58,92,.05);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center}.mp-history-card h3{margin:0 0 7px;font-size:17px;color:#10233c}.mp-history-meta{display:flex;gap:7px;flex-wrap:wrap;color:#617286;font-size:12px}.mp-history-tag{padding:4px 8px;border-radius:999px;background:#f1f6fb;border:1px solid #e0e9f2}.mp-history-status{font-weight:800}.mp-history-status.ok{color:#137553;background:#eaf8f2;border-color:#ccecdf}.mp-history-status.review{color:#946000;background:#fff6dc;border-color:#f2df9c}.mp-history-status.pending{color:#53677c}.mp-history-open{border:0;border-radius:10px;background:linear-gradient(90deg,#0f62cc,#1674e8);color:#fff;padding:10px 14px;font-weight:800;cursor:pointer}.mp-history-open:disabled{opacity:.45;cursor:not-allowed}.mp-history-back{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:12px 14px;background:#eef6ff;border:1px solid #d8e8f8;border-radius:12px}.mp-history-back button{border:0;background:#fff;color:#145eaa;border-radius:9px;padding:8px 11px;font-weight:800;cursor:pointer}.mp-history-back span{font-size:13px;color:#315c83;font-weight:700}.mp-history-empty-icon{font-size:28px;margin-bottom:8px}
@media(max-width:760px){.mp-history-head{display:block}.mp-history-refresh{margin-top:12px}.mp-history-card{grid-template-columns:1fr}.mp-history-open{width:100%}.mp-nav{grid-template-columns:repeat(6,1fr)!important}}
</style>
<script id="mp-history-script">(()=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const methodology={abp:'Aprendizaje Basado en Problemas',steam:'Indagación STEAM',aprendizaje_servicio:'Aprendizaje Servicio',proyectos_comunitarios:'Proyectos Comunitarios'};
  let loaded=false;
  let items=[];
  let lastTitle='Planeación guardada';

  function dateLabel(value){try{return new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return String(value||'')}}
  function statusInfo(value){const status=String(value||'').toUpperCase();if(status==='APROBADO')return{label:'Lista',className:'ok'};if(status==='REVISAR')return{label:'Requiere revisión',className:'review'};if(status==='ERROR'||status==='REPROBADO')return{label:'No disponible',className:'review'};return{label:'En proceso',className:'pending'}}
  function gradeLabel(value){const grades=Array.isArray(value)?value:[];return grades.length?grades.map(g=>g+'.º').join(', '):'Grados no registrados'}
  function planTitle(item){const raw=String(item.title||'').trim();if(raw)return raw.charAt(0).toUpperCase()+raw.slice(1);return 'Planeación del '+dateLabel(item.created_at)}
  function methodLabel(item){return item.methodology_label||methodology[item.methodology_id]||'Metodología registrada'}

  function shellReady(){
    if(document.getElementById('mpHistoryView'))return;
    const sidebar=document.getElementById('mpSidebar'),main=document.getElementById('mpMain'),legacy=document.getElementById('mpLegacyMain');
    if(!sidebar||!main||!legacy)return setTimeout(shellReady,80);
    const nav=sidebar.querySelector('.mp-nav');
    const link=document.createElement('a');link.href='#mis-planeaciones';link.id='mpHistoryNav';link.innerHTML='<span class="mp-icon">◷</span><span>Mis planeaciones</span>';
    const links=nav.querySelectorAll('a');(links[1]||links[links.length-1])?.insertAdjacentElement('afterend',link);
    const view=document.createElement('section');view.id='mpHistoryView';view.innerHTML='<div class="mp-history-head"><div><h2>Mis planeaciones</h2><p>Consulta las planeaciones vinculadas con tu cuenta.</p></div><button class="mp-history-refresh" id="mpHistoryRefresh">Actualizar</button></div><div id="mpHistoryContent" class="mp-history-state">Cargando tus planeaciones…</div>';
    main.insertBefore(view,legacy);
    link.addEventListener('click',event=>{event.preventDefault();showHistory();});
    document.getElementById('mpHistoryRefresh').addEventListener('click',()=>loadHistory(true));
    nav.querySelectorAll('a:not(#mpHistoryNav)').forEach(a=>a.addEventListener('click',()=>restorePlanner()));
  }

  function showHistory(){
    document.querySelectorAll('.mp-nav a').forEach(a=>a.classList.toggle('active',a.id==='mpHistoryNav'));
    document.getElementById('mpHero')?.style.setProperty('display','none');
    document.querySelector('.mp-kpis')?.style.setProperty('display','none');
    document.getElementById('mpLegacyMain')?.style.setProperty('display','none');
    document.getElementById('mpHistoryView')?.style.setProperty('display','block');
    document.getElementById('mpHistoryView')?.scrollIntoView({behavior:'smooth',block:'start'});
    if(!loaded)loadHistory();
  }

  function restorePlanner(){
    document.getElementById('mpHistoryView')?.style.setProperty('display','none');
    document.getElementById('mpHero')?.style.removeProperty('display');
    document.querySelector('.mp-kpis')?.style.removeProperty('display');
    document.getElementById('mpLegacyMain')?.style.removeProperty('display');
  }

  function renderList(){
    const root=document.getElementById('mpHistoryContent');if(!root)return;
    if(!items.length){root.className='mp-history-state';root.innerHTML='<div class="mp-history-empty-icon">▤</div><b>Aún no hay planeaciones guardadas.</b><div style="margin-top:6px">Cuando generes una, aparecerá aquí automáticamente.</div>';return;}
    root.className='mp-history-list';
    root.innerHTML=items.map(item=>{const status=statusInfo(item.status),title=planTitle(item),sessions=Number(item.session_count||0);return '<article class="mp-history-card"><div><h3>'+esc(title)+'</h3><div class="mp-history-meta"><span class="mp-history-tag">'+esc(dateLabel(item.created_at))+'</span><span class="mp-history-tag">'+esc(gradeLabel(item.grades))+'</span><span class="mp-history-tag">'+esc(methodLabel(item))+'</span>'+(sessions?'<span class="mp-history-tag">'+sessions+' sesión'+(sessions===1?'':'es')+'</span>':'')+'<span class="mp-history-tag mp-history-status '+status.className+'">'+esc(status.label)+'</span></div></div><button class="mp-history-open" data-run="'+esc(item.run_id)+'" data-title="'+esc(title)+'" '+(item.has_output?'':'disabled')+'>'+(item.has_output?'Ver planeación':'Sin resultado')+'</button></article>'}).join('');
    root.querySelectorAll('[data-run]').forEach(button=>button.addEventListener('click',()=>openPlan(button.dataset.run,button.dataset.title)));
  }

  async function loadHistory(force=false){
    if(loaded&&!force){renderList();return;}
    const root=document.getElementById('mpHistoryContent');if(root){root.className='mp-history-state';root.textContent='Cargando tus planeaciones…';}
    try{
      const response=await fetch('/api/history',{headers:{accept:'application/json'}});const data=await response.json();
      if(!response.ok)throw new Error(data.code==='AUTH_REQUIRED'?'Inicia sesión para consultar tu historial.':'No fue posible consultar el historial.');
      items=Array.isArray(data.items)?data.items:[];loaded=true;renderList();
    }catch(error){if(root){root.className='mp-history-state';root.innerHTML='<b>No fue posible cargar tus planeaciones.</b><div style="margin-top:7px">'+esc(error.message||error)+'</div>';}}
  }

  function renderSavedPlan(row,title){
    const data=row.model_output_json||{};
    const plan=document.getElementById('plan');
    if(!plan)throw new Error('La vista de planeación no está disponible.');
    try{state.latestPlanData=data}catch{}
    let banner=document.getElementById('mpHistoryBackBanner');
    if(!banner){banner=document.createElement('div');banner.id='mpHistoryBackBanner';banner.className='mp-history-back';plan.prepend(banner);}
    banner.innerHTML='<button id="mpBackToHistory">← Mis planeaciones</button><span>'+esc(title)+'</span>';
    document.getElementById('mpBackToHistory').onclick=showHistory;
    const set=(id,html)=>{const el=document.getElementById(id);if(el)el.innerHTML=html};
    set('diagnosis',esc(data.diagnosis||'Sin diagnóstico registrado.'));
    const question=document.getElementById('question');if(question)question.textContent=data.guiding_question||'Sin pregunta guía registrada.';
    set('axes',(data.axes||[]).length?(data.axes||[]).map(axis=>'<div class="gradeBlock"><b>'+esc(axis.name||'Eje articulador')+'</b><br><span class="muted">'+esc(axis.reason||'')+'</span>'+(axis.action_in_sequence?'<br><b>Aplicación:</b> '+esc(axis.action_in_sequence):'')+'</div>').join(''):'<p class="muted">No se registraron ejes articuladores.</p>');
    const diff=(data.differentiation||[]).map(item=>'<div class="gradeBlock"><b>'+esc(item.grade||'')+'.º grado</b><br>'+esc(item.guidance||'')+'</div>').join('');
    set('organization','<p>'+esc(data.organization_multigrade||'')+'</p>'+(data.context_application?'<div class="notice"><b>Aplicación del contexto:</b> '+esc(data.context_application)+'</div>':'')+(diff?'<h4>Diferenciación por grado</h4>'+diff:''));
    if(typeof renderSessions==='function')renderSessions(data);
    const products=(data.products||[]).map(product=>'<div class="gradeBlock"><b>'+esc(product.grade||'')+'.º grado</b><br><b>Productos parciales:</b> '+esc((product.partial_products||[]).join(' · ')||'No registrados')+'<br><b>Evidencia final:</b> '+esc(product.final_evidence||'')+'</div>').join('');
    const evaluation=(data.evaluation||[]).map(item=>'<div class="gradeBlock"><b>'+esc(item.grade?item.grade+'.º · ':'')+esc(item.pda_id||'Evaluación')+'</b><br><b>Criterio:</b> '+esc(item.criterion||'')+'<br><b>Evidencia:</b> '+esc(item.evidence||'')+'<br><b>Instrumento:</b> '+esc(item.instrument||'')+'</div>').join('');
    set('evaluation',(products?'<h4>Productos y evidencias</h4>'+products:'')+(evaluation?'<h4>Evaluación alineada</h4>'+evaluation:'<p class="muted">No se registró evaluación.</p>'));
    set('ltgPlan',(data.ltg_use||[]).map(item=>'<div class="notice"><b>Uso del LTG para '+esc(item.pda_id||'el proyecto')+':</b> '+esc(item.usage||'')+(item.adaptation?'<br><b>Adaptación:</b> '+esc(item.adaptation):'')+'</div>').join('')||'<p class="muted">No se registró uso de LTG.</p>');
    const warnings=(data.warnings||[]).map(value=>'<div class="notice warn">'+esc(value)+'</div>').join('');
    const viability=data.viability?'<div class="notice"><b>Viabilidad pedagógica: '+esc(data.viability.level||'registrada')+'</b><br>'+esc(data.viability.reason||'')+'</div>':'';
    set('warnings',viability+warnings);
    document.getElementById('mpHistoryView')?.style.setProperty('display','none');
    document.getElementById('mpHero')?.style.setProperty('display','none');
    document.querySelector('.mp-kpis')?.style.setProperty('display','none');
    document.getElementById('mpLegacyMain')?.style.removeProperty('display');
    plan.classList.remove('hidden');
    plan.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function openPlan(runId,title){
    lastTitle=title||lastTitle;
    const root=document.getElementById('mpHistoryContent');if(root){root.className='mp-history-state';root.textContent='Abriendo la planeación…';}
    try{
      const response=await fetch('/api/history/'+encodeURIComponent(runId),{headers:{accept:'application/json'}});const row=await response.json();
      if(!response.ok)throw new Error(row.code==='PLAN_NOT_FOUND'?'La planeación no existe o no pertenece a esta cuenta.':'No fue posible abrir la planeación.');
      if(!row.model_output_json)throw new Error('Esta ejecución no tiene un resultado disponible.');
      renderSavedPlan(row,lastTitle);
    }catch(error){if(root){root.className='mp-history-state';root.innerHTML='<b>No fue posible abrir la planeación.</b><div style="margin-top:7px">'+esc(error.message||error)+'</div><button class="mp-history-refresh" id="mpHistoryRetry" style="margin-top:12px">Volver al historial</button>';document.getElementById('mpHistoryRetry').onclick=()=>{renderList()};}}
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
      if (html.includes("</body>")) html = html.replace("</body>", HISTORY_UI + "</body>");
      res.writeHead(response.status, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-multiplan-history": "v0.12.1",
      });
      res.end(html);
      return;
    }
    const data = Buffer.from(await response.arrayBuffer());
    const outgoing = { "content-type": type, "cache-control": response.headers.get("cache-control") || "no-store" };
    for (const name of ["x-multiplan-plan-engine", "x-multiplan-safe-fallback", "x-multiplan-v65-promotion", "x-multiplan-methodology-sequence", "x-multiplan-session-count-preserved"]) {
      const value = response.headers.get(name);
      if (value) outgoing[name] = value;
    }
    res.writeHead(response.status, outgoing);
    res.end(data);
  } catch (error) {
    json(res, 502, { code: "V0121_PROXY_ERROR", message: String(error) });
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/api/history") return listHistory(req, res);
  const detail = url.pathname.match(/^\/api\/history\/([0-9a-f-]+)$/i);
  if (req.method === "GET" && detail) return historyDetail(req, res, detail[1]);
  if (req.method === "GET" && url.pathname === "/v0121_health") {
    return json(res, 200, {
      ok: true,
      version: "0.12.1",
      history: "READ_ONLY_OWNER_SCOPED",
      historyLimit: 100,
      base: "0.12.0",
    });
  }
  return proxy(req, res);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan v0.12.1 on ${PORT}; owner-scoped read-only planning history enabled`);
});
