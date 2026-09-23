import http from "node:http";
import { spawn } from "node:child_process";

// v0.12.3 is a workflow-guidance layer over v0.12.2.
// It preserves every API, planner rule, methodology rule and persistence behavior from v0.12.2.
const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V0123_CHILD_PORT || 6801);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;

const child = spawn(process.execPath, ["server-v0122-methodology-ui-freeze-fix.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[v0123] child exited code=${code} signal=${signal}`);
  if (!stopping) setTimeout(() => process.exit(code || 1), 50);
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    stopping = true;
    try { child.kill(signal); } catch {}
    process.exit(0);
  });
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
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

const WORKFLOW_UI = String.raw`
<style id="mp-workflow-v0123-style">
.mp-workflow{background:linear-gradient(120deg,#0c3154,#0e416d);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px 20px;margin:0 0 18px;color:#fff;box-shadow:0 12px 30px rgba(16,50,82,.12)}
.mp-workflow-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:14px}.mp-workflow-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#8de0d3}.mp-workflow-title{font-size:16px;font-weight:850;margin-top:3px}.mp-workflow-help{max-width:560px;font-size:12px;line-height:1.45;color:#c9d9e7;text-align:right}
.mp-workflow-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.mp-workflow-step{position:relative;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);border-radius:12px;padding:11px 10px;min-height:67px;color:#dce9f4;cursor:pointer;text-align:left;transition:.18s ease}.mp-workflow-step:hover{background:rgba(255,255,255,.1);transform:translateY(-1px)}.mp-workflow-step.is-active{background:#fff;color:#153957;border-color:#fff;box-shadow:0 7px 18px rgba(0,0,0,.13)}.mp-workflow-step.is-done{background:rgba(25,183,164,.16);border-color:rgba(86,222,202,.38);color:#effffc}.mp-workflow-num{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:999px;background:rgba(255,255,255,.12);font-size:11px;font-weight:900;margin-right:6px}.mp-workflow-step.is-active .mp-workflow-num{background:#e8f3ff;color:#1469bd}.mp-workflow-step.is-done .mp-workflow-num{background:#19b7a4;color:#fff}.mp-workflow-label{font-size:12px;font-weight:850}.mp-workflow-state{display:block;margin-top:7px;font-size:10px;line-height:1.25;opacity:.78}.mp-workflow-step.is-active .mp-workflow-state{color:#60798f;opacity:1}.mp-workflow-step.is-done .mp-workflow-state{color:#bff5ec;opacity:1}
.mp-guide-note{display:none;margin:-6px 0 18px;padding:12px 15px;border:1px solid #dce8f3;background:#fff;border-radius:13px;color:#52697f;font-size:12px;line-height:1.5}.mp-guide-note strong{color:#173b5d}.mp-guide-note.is-visible{display:block}.mp-topbar .mp-pill{white-space:nowrap}
@media(max-width:920px){.mp-workflow-head{display:block}.mp-workflow-help{text-align:left;margin-top:7px}.mp-workflow-steps{grid-template-columns:repeat(5,minmax(115px,1fr));overflow-x:auto;padding-bottom:4px}}
@media(max-width:760px){.mp-workflow{padding:15px;margin-bottom:14px}.mp-workflow-steps{grid-template-columns:repeat(5,128px)}.mp-workflow-step{min-height:64px}.mp-workflow-help{font-size:11px}}
</style>
<script id="mp-workflow-v0123-script">(()=>{
  const STEPS=[
    {id:'context',label:'Contexto',target:'contextCard',ready:()=>contextReady(),waiting:'Completa contexto, situación y grados.',done:'Contexto válido.'},
    {id:'pda',label:'PDA',target:'results',ready:()=>selectedPdas()>0,waiting:'Busca y selecciona los PDA pertinentes.',done:'PDA seleccionados.'},
    {id:'method',label:'Metodología',target:'mpMethodologyStep',ready:()=>methodChosen(),waiting:'Revisa la recomendación y decide.',done:'Metodología elegida.'},
    {id:'plan',label:'Planeación',target:'plan',ready:()=>planReady(),waiting:'Genera la secuencia didáctica.',done:'Planeación generada.'},
    {id:'review',label:'Revisión',target:'plan',ready:()=>reviewReady(),waiting:'Ejecuta la revisión pedagógica antes de considerar validada la planeación.',done:'Revisión pedagógica vigente.'},
  ];
  function textAtLeast(id,min){const el=document.getElementById(id);return String(el?.value||'').trim().length>=min}
  function contextReady(){return textAtLeast('context',10)&&textAtLeast('problem',5)&&selectedGrades()>0}
  function selectedGrades(){try{return Array.isArray(state?.grades)?state.grades.length:document.querySelectorAll('.grade.on').length}catch{return document.querySelectorAll('.grade.on').length}}
  function selectedPdas(){try{return Object.values(state?.selected||{}).filter(Boolean).length}catch{return document.querySelectorAll('.candidate.sel').length}}
  function methodChosen(){return !!document.querySelector('#mpMethodologyStep input[name="mpMethod"]:checked')||!!document.getElementById('mpPlanMethodHeader')}
  function planReady(){try{if(state?.latestPlanData&&Object.keys(state.latestPlanData).length)return true}catch{}const plan=document.getElementById('plan');if(!plan)return false;return !plan.classList.contains('hidden')&&plan.textContent.trim().length>120}
  function reviewReady(){try{return !!(state?.pedagogicalReview||state?.reviewResult)?.status}catch{return false}}
  function historyVisible(){const view=document.getElementById('mpHistoryView');return !!view&&getComputedStyle(view).display!=='none'}
  function visible(el){if(!el)return false;if(el.classList?.contains('hidden'))return false;return !!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)}
  function clearSavedHistoryBanner(){const banner=document.getElementById('mpHistoryBackBanner');if(banner)banner.remove()}
  function build(){
    if(document.getElementById('mpWorkflowV0123'))return;
    const main=document.getElementById('mpMain'),hero=document.getElementById('mpHero');if(!main||!hero)return setTimeout(build,100);
    const shell=document.createElement('section');shell.id='mpWorkflowV0123';shell.className='mp-workflow';shell.setAttribute('aria-label','Ruta de planeación');
    shell.innerHTML='<div class="mp-workflow-head"><div><div class="mp-workflow-kicker">Ruta de planeación</div><div class="mp-workflow-title">Construye el proyecto paso a paso</div></div><div class="mp-workflow-help">Multiplan te guía sin sustituir tu decisión docente. Cada paso prepara el siguiente.</div></div><div class="mp-workflow-steps" id="mpWorkflowSteps"></div>';
    hero.insertAdjacentElement('afterend',shell);
    const note=document.createElement('div');note.id='mpWorkflowNote';note.className='mp-guide-note';shell.insertAdjacentElement('afterend',note);
    const steps=document.getElementById('mpWorkflowSteps');
    STEPS.forEach((step,i)=>{const b=document.createElement('button');b.type='button';b.className='mp-workflow-step';b.dataset.step=step.id;b.innerHTML='<span class="mp-workflow-num">'+(i+1)+'</span><span class="mp-workflow-label">'+step.label+'</span><span class="mp-workflow-state"></span>';b.addEventListener('click',()=>go(step));steps.appendChild(b)});
    const pill=document.querySelector('.mp-topbar .mp-pill');if(pill)pill.textContent='Multiplan v0.12.3 · V6.5 Beta.10';
    document.addEventListener('input',scheduleUpdate,true);document.addEventListener('change',scheduleUpdate,true);document.addEventListener('click',event=>{if(event.target?.closest?.('#search,#continue,#rebuild'))clearSavedHistoryBanner();setTimeout(scheduleUpdate,120)},true);
    update();setInterval(update,1200);
  }
  function currentIndex(){for(let i=0;i<STEPS.length-1;i++)if(!STEPS[i].ready())return i;return 4}
  function update(){
    const root=document.getElementById('mpWorkflowV0123'),note=document.getElementById('mpWorkflowNote');if(!root)return;
    const hide=historyVisible();root.style.display=hide?'none':'';if(hide){if(note)note.classList.remove('is-visible');return}
    const active=currentIndex();
    root.querySelectorAll('.mp-workflow-step').forEach((button,i)=>{const step=STEPS[i],done=step.ready()&&i<=active;button.classList.toggle('is-done',done);button.classList.toggle('is-active',i===active&&!step.ready());button.setAttribute('aria-current',i===active&&!step.ready()?'step':'false');const stateEl=button.querySelector('.mp-workflow-state');if(stateEl)stateEl.textContent=done?step.done:step.waiting});
    const step=STEPS[active];if(note){note.classList.add('is-visible');note.innerHTML=step.ready()?'<strong>Ruta completa.</strong> La revisión pedagógica está vigente.':'<strong>Siguiente paso: '+step.label+'.</strong> '+step.waiting}
  }
  let queued=false;function scheduleUpdate(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update()})}
  function targetFor(step){
    const primary=document.getElementById(step.target);if(visible(primary))return primary;
    if(step.id==='context')return document.getElementById('contextCard')||document.getElementById('context');
    if(step.id==='pda')return visible(document.getElementById('results'))?document.getElementById('results'):document.getElementById('contextCard')||document.getElementById('search');
    if(step.id==='method')return visible(document.getElementById('mpMethodologyStep'))?document.getElementById('mpMethodologyStep'):document.getElementById('results');
    if(step.id==='plan')return visible(document.getElementById('plan'))?document.getElementById('plan'):document.getElementById('mpMethodologyStep')||document.getElementById('results');
    return visible(document.getElementById('plan'))?document.getElementById('plan'):null;
  }
  function go(step){if(historyVisible())return;const target=targetFor(step);if(visible(target))target.scrollIntoView({behavior:'smooth',block:'start'})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
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
      if (html.includes("</body>")) html = html.replace("</body>", WORKFLOW_UI + "</body>");
      res.writeHead(response.status, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-multiplan-workflow-ui": "v0.12.3",
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
      "x-multiplan-plan-engine",
      "x-multiplan-safe-fallback",
      "x-multiplan-v65-promotion",
      "x-multiplan-methodology-sequence",
      "x-multiplan-session-count-preserved",
    ]) {
      const value = response.headers.get(name);
      if (value) outgoing[name] = value;
    }
    res.writeHead(response.status, outgoing);
    res.end(data);
  } catch (error) {
    json(res, 502, { code: "V0123_PROXY_ERROR", message: String(error) });
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/v0123_health") {
    return json(res, 200, {
      ok: true,
      version: "0.12.3",
      change: "WORKFLOW_GUIDANCE_UI_HARDENED",
      base: "0.12.2",
      backendBehaviorModified: false,
      plannerRulesModified: false,
      dataChanges: "NONE",
    });
  }
  return proxy(req, res);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan v0.12.3 on ${PORT}; hardened workflow guidance UI over v0.12.2`);
});
