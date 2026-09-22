import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_UI_CHILD_PORT || 5601);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;

// UI-only wrapper. It leaves the v0.11.2 application logic untouched and only
// decorates GET / with a professional visual shell.
const child = spawn(process.execPath, ["server-v0112-v64guard-v65beta10-shadow.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[ui-v0113] child exited code=${code} signal=${signal}`);
  if (!stopping) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    stopping = true;
    try { child.kill(sig); } catch {}
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

function readBody(req, max = 520000) {
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

function icon(name) {
  const paths = {
    home: '<path d="M3 10.8 12 3l9 7.8v9.7a1.5 1.5 0 0 1-1.5 1.5h-5v-7h-5v7h-5A1.5 1.5 0 0 1 3 20.5z"/>',
    plan: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>',
    pda: '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="8" r="2"/><path d="M4 20c.7-4 2.7-6 5-6s4.3 2 5 6M14 14c2.4.1 4 1.8 4.8 5"/>',
    draft: '<path d="M4 20h16M6 16l9.8-9.8 2 2L8 18l-3 .8z"/>',
    multi: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.home}</svg>`;
}

function uiStyle() {
  return String.raw`<style id="mp-professional-ui">
:root{
  --mp-navy:#0b2d4f;--mp-navy-2:#123f68;--mp-blue:#1674e8;--mp-blue-2:#0f62cc;
  --mp-teal:#19b7a4;--mp-green:#2ea66f;--mp-bg:#f4f7fb;--mp-card:#fff;
  --mp-text:#10233c;--mp-muted:#6f7f92;--mp-line:#dfe7f1;--mp-soft:#eef5fd;
  --mp-shadow:0 14px 36px rgba(26,58,92,.08);--mp-radius:18px;
}
html{scroll-behavior:smooth}
body{background:var(--mp-bg)!important;color:var(--mp-text)!important;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif!important}
body.mp-ui-ready{overflow-x:hidden}
#mpShell{min-height:100vh;display:grid;grid-template-columns:238px minmax(0,1fr)}
#mpSidebar{position:sticky;top:0;height:100vh;background:linear-gradient(180deg,#0a2b4a 0%,#0d3559 55%,#0a2947 100%);color:#fff;padding:24px 14px;display:flex;flex-direction:column;z-index:40;box-shadow:10px 0 30px rgba(7,32,56,.08)}
.mp-brand{display:flex;align-items:center;gap:12px;padding:0 12px 22px}.mp-logo{width:42px;height:42px;border-radius:13px;background:linear-gradient(145deg,#14c8ae,#1d7be8);display:grid;place-items:center;box-shadow:0 10px 24px rgba(20,200,174,.22)}.mp-logo svg{width:25px;height:25px;fill:none;stroke:#fff;stroke-width:1.8}.mp-brand-title{font-size:23px;font-weight:850;letter-spacing:-.4px}.mp-brand-sub{font-size:11px;color:#c4d5e4;margin-top:2px}.mp-nav{display:grid;gap:6px}.mp-nav a{color:#dce9f4;text-decoration:none;display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:11px;font-weight:700;font-size:14px;transition:.18s ease}.mp-nav a:hover{background:rgba(255,255,255,.08);color:#fff}.mp-nav a.active{background:linear-gradient(90deg,#1767bb,#187ee8);color:#fff;box-shadow:0 8px 22px rgba(11,92,169,.28)}.mp-nav svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.mp-side-spacer{flex:1}.mp-side-card{margin:16px 2px 0;padding:18px 16px;border-radius:16px;background:linear-gradient(160deg,rgba(25,183,164,.19),rgba(22,116,232,.12));border:1px solid rgba(255,255,255,.12)}.mp-side-card strong{display:block;font-size:14px;line-height:1.35}.mp-side-card span{display:block;color:#c7d8e7;font-size:12px;line-height:1.45;margin-top:6px}
#mpContent{min-width:0}.mp-topbar{height:64px;background:rgba(255,255,255,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--mp-line);display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:30}.mp-search{width:min(520px,50vw);height:40px;border:1px solid var(--mp-line);background:#f8fbff;border-radius:12px;display:flex;align-items:center;gap:10px;padding:0 13px;color:var(--mp-muted);font-size:13px}.mp-search svg{width:18px;height:18px;fill:none;stroke:#59708a;stroke-width:2}.mp-top-meta{display:flex;align-items:center;gap:12px}.mp-pill{font-size:12px;font-weight:800;color:#315c83;background:#eef6ff;border:1px solid #d8e8f8;border-radius:999px;padding:6px 10px}.mp-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(145deg,#cde5ff,#d9f6ef);display:grid;place-items:center;font-weight:900;color:#14537f}.mp-user{display:grid;line-height:1.1}.mp-user strong{font-size:13px}.mp-user span{font-size:11px;color:var(--mp-muted);margin-top:4px}
#mpMain{padding:28px;max-width:1500px;margin:0 auto}.mp-hero{position:relative;overflow:hidden;background:linear-gradient(110deg,#fff 0%,#f7fbff 58%,#e8f6fb 100%);border:1px solid var(--mp-line);border-radius:22px;padding:28px 30px;margin-bottom:18px;box-shadow:var(--mp-shadow)}.mp-hero:after{content:"";position:absolute;width:320px;height:320px;border-radius:50%;right:-80px;top:-160px;background:radial-gradient(circle,rgba(25,183,164,.15),rgba(22,116,232,.05) 52%,transparent 70%)}.mp-hero h1{color:var(--mp-text)!important;font-size:clamp(30px,3.2vw,48px)!important;letter-spacing:-1.3px!important;margin:0 0 8px!important}.mp-hero p{max-width:820px;color:var(--mp-muted)!important;margin:0!important}.mp-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.mp-kpi{background:#fff;border:1px solid var(--mp-line);border-radius:15px;padding:16px;box-shadow:0 8px 22px rgba(26,58,92,.05);display:flex;align-items:center;gap:12px}.mp-kpi-ico{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:19px;font-weight:900}.mp-kpi:nth-child(1) .mp-kpi-ico{background:#eaf3ff;color:#1674e8}.mp-kpi:nth-child(2) .mp-kpi-ico{background:#e7f8f4;color:#159a87}.mp-kpi:nth-child(3) .mp-kpi-ico{background:#f1ebff;color:#7a4be7}.mp-kpi:nth-child(4) .mp-kpi-ico{background:#e9f6ff;color:#1772c8}.mp-kpi strong{display:block;font-size:21px;line-height:1}.mp-kpi span{display:block;font-size:11px;color:var(--mp-muted);margin-top:5px}
#mpContent header{position:static!important;background:transparent!important;border:0!important;backdrop-filter:none!important}.wrap{width:100%!important;max-width:none!important}.top{min-height:auto!important}.top>.brand,.top>.badge{display:none!important}main.wrap{padding:0!important}.hero{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;margin:0!important}.hero h1,.hero p{display:none!important}.card{background:var(--mp-card)!important;border:1px solid var(--mp-line)!important;border-radius:var(--mp-radius)!important;box-shadow:var(--mp-shadow)!important;padding:22px!important;margin-bottom:18px!important}.card h2{font-size:19px!important;letter-spacing:-.25px;margin-top:0!important}.card h2:before{content:"";display:inline-block;width:4px;height:20px;background:linear-gradient(180deg,var(--mp-blue),var(--mp-teal));border-radius:99px;margin-right:10px;vertical-align:-3px}.muted{color:var(--mp-muted)!important}.grid{gap:14px!important}label{color:#29425e!important;font-weight:800!important}input,textarea,select{background:#fbfdff!important;border:1px solid #dbe5ef!important;border-radius:11px!important;padding:12px!important;color:var(--mp-text)!important;outline:none;transition:border-color .18s,box-shadow .18s}input:focus,textarea:focus,select:focus{border-color:#6ca8e9!important;box-shadow:0 0 0 3px rgba(22,116,232,.10)!important}.grade,.tab,.secondary{border:1px solid #d9e4ee!important;border-radius:10px!important;background:#fff!important;color:#29425e!important}.grade.on,.tab.on{background:linear-gradient(90deg,var(--mp-blue-2),var(--mp-blue))!important;color:#fff!important;border-color:var(--mp-blue)!important;box-shadow:0 6px 14px rgba(22,116,232,.20)}.primary{background:linear-gradient(90deg,var(--mp-blue-2),var(--mp-blue))!important;border-radius:11px!important;padding:12px 17px!important;box-shadow:0 8px 18px rgba(22,116,232,.18)!important}.primary:hover{filter:brightness(.96)!important}.notice{border-radius:11px!important}.candidate{border-radius:14px!important;border-color:var(--mp-line)!important;box-shadow:0 4px 12px rgba(26,58,92,.035)}.candidate.sel{border-color:#72c6a6!important;box-shadow:0 0 0 3px rgba(46,166,111,.08)!important}.id{background:#eaf4ff!important;color:#145eaa!important}.summary{background:#f5f9fd!important;border:1px solid #e0e9f2}.project{background:#f8fbfe!important;border-color:#dfe8f1!important}.planGrid{grid-template-columns:minmax(0,1.5fr) minmax(260px,.6fr)!important}.section{border-top-color:#e4ebf2!important}.pdaRow{border-left-color:var(--mp-blue)!important}.gradeBlock{background:#f8fbfe!important;border-color:#dfe8f1!important}.checks div{border-color:#dfe8f1!important;background:#fff}.footer{color:#8896a6!important;padding:4px 0 18px!important}
@media(max-width:1100px){#mpShell{grid-template-columns:86px minmax(0,1fr)}.mp-brand-text,.mp-nav span,.mp-side-card{display:none}.mp-brand{justify-content:center;padding-inline:0}.mp-nav a{justify-content:center;padding:12px}.mp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){#mpShell{display:block}#mpSidebar{position:static;height:auto;padding:10px}.mp-brand,.mp-side-card{display:none}.mp-nav{grid-template-columns:repeat(5,1fr)}.mp-nav a{padding:9px}.mp-nav a:nth-child(n+6){display:none}.mp-topbar{padding:0 12px}.mp-search{width:55vw}.mp-user{display:none}#mpMain{padding:14px}.mp-kpis{grid-template-columns:1fr 1fr}.planGrid{grid-template-columns:1fr!important}}
</style>`;
}

function uiScript() {
  const icons = {
    home: icon("home"),
    plan: icon("plan"),
    pda: icon("pda"),
    draft: icon("draft"),
    multi: icon("multi"),
  };
  return String.raw`<script id="mp-professional-script">
(()=>{
  const I=${JSON.stringify(icons)};
  const ready=()=>{
    if(document.getElementById('mpShell')) return;
    const oldHeader=document.querySelector('body > header');
    const oldMain=document.querySelector('body > main');
    if(!oldMain) return;

    const shell=document.createElement('div'); shell.id='mpShell';
    const sidebar=document.createElement('aside'); sidebar.id='mpSidebar';
    sidebar.innerHTML=`<div class="mp-brand"><div class="mp-logo"><svg viewBox="0 0 24 24"><path d="M4 5c3.2 0 5.4 1.1 8 3.2C14.6 6.1 16.8 5 20 5v13c-3.2 0-5.4 1-8 3-2.6-2-4.8-3-8-3z"/></svg></div><div class="mp-brand-text"><div class="mp-brand-title">Multiplan</div><div class="mp-brand-sub">Planea hoy. Enseña mejor mañana.</div></div></div><nav class="mp-nav"><a class="active" href="#mpHero">${I.home}<span>Inicio</span></a><a href="#contextCard">${I.plan}<span>Planeación</span></a><a href="#results">${I.pda}<span>PDA oficiales</span></a><a href="#plan">${I.draft}<span>Borrador</span></a><a href="#organization">${I.multi}<span>Multigrado</span></a></nav><div class="mp-side-spacer"></div><div class="mp-side-card"><strong>Juntos por una educación más humana</strong><span>Nueva Escuela Mexicana · proyectos, PDA y LTG con trazabilidad.</span></div>`;

    const content=document.createElement('div'); content.id='mpContent';
    const top=document.createElement('div'); top.className='mp-topbar';
    top.innerHTML=`<div class="mp-search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><span>Multiplan · planeación curricular y multigrado</span></div><div class="mp-top-meta"><span class="mp-pill">UI Beta · motor intacto</span><div class="mp-avatar">M</div><div class="mp-user"><strong>Docente</strong><span>Espacio de trabajo</span></div></div>`;
    content.appendChild(top);

    const mainWrap=document.createElement('div'); mainWrap.id='mpMain';
    const hero=document.createElement('section'); hero.id='mpHero'; hero.className='mp-hero';
    hero.innerHTML=`<h1>Gestiona tus planeaciones con precisión</h1><p>Construye proyectos contextualizados, selecciona PDA oficiales y articula LTG sin perder la decisión docente ni la trazabilidad curricular.</p>`;
    mainWrap.appendChild(hero);

    const kpis=document.createElement('section'); kpis.className='mp-kpis';
    kpis.innerHTML=`<article class="mp-kpi"><div class="mp-kpi-ico">1–6</div><div><strong>6 grados</strong><span>Selección flexible</span></div></article><article class="mp-kpi"><div class="mp-kpi-ico">P</div><div><strong>1,333 PDA</strong><span>Corpus oficial</span></div></article><article class="mp-kpi"><div class="mp-kpi-ico">LTG</div><div><strong>427 proyectos</strong><span>Vinculación opcional</span></div></article><article class="mp-kpi"><div class="mp-kpi-ico">↔</div><div><strong>1,418 vínculos</strong><span>PDA ↔ LTG</span></div></article>`;
    mainWrap.appendChild(kpis);

    if(oldHeader) content.appendChild(oldHeader);
    oldMain.id='mpLegacyMain';
    mainWrap.appendChild(oldMain);
    content.appendChild(mainWrap);
    shell.append(sidebar,content);
    document.body.appendChild(shell);

    const cards=oldMain.querySelectorAll(':scope > section.card');
    if(cards[0]) cards[0].id='contextCard';
    document.body.classList.add('mp-ui-ready');

    document.querySelectorAll('.mp-nav a').forEach(a=>a.addEventListener('click',()=>{
      document.querySelectorAll('.mp-nav a').forEach(x=>x.classList.remove('active'));a.classList.add('active');
    }));
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ready); else ready();
})();
</script>`;
}

async function proxy(req, res) {
  try {
    const headers = {};
    for (const name of ["content-type", "authorization", "accept", "cookie"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const upstream = await fetch(CHILD_ORIGIN + req.url, init);
    const type = upstream.headers.get("content-type") || "application/octet-stream";

    if (req.method === "GET" && req.url === "/" && type.includes("text/html")) {
      let html = await upstream.text();
      html = html.replace("</head>", uiStyle() + "</head>");
      html = html.replace("</body>", uiScript() + "</body>");
      res.writeHead(upstream.status, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-multiplan-ui": "professional-beta-v1",
      });
      res.end(html);
      return;
    }

    const data = Buffer.from(await upstream.arrayBuffer());
    const outHeaders = {
      "content-type": type,
      "cache-control": upstream.headers.get("cache-control") || "no-store",
    };
    const engine = upstream.headers.get("x-multiplan-plan-engine");
    if (engine) outHeaders["x-multiplan-plan-engine"] = engine;
    res.writeHead(upstream.status, outHeaders);
    res.end(data);
  } catch (error) {
    json(res, 502, { code: "UI_BETA_PROXY_ERROR", message: String(error) });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/ui-health") {
    return json(res, 200, {
      ok: true,
      version: "0.11.3-ui-beta",
      ui: "PROFESSIONAL-DASHBOARD-V1",
      base: "0.11.2",
      productionModified: false,
      backendBehaviorModified: false,
    });
  }
  return proxy(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan UI Beta v0.11.3 on ${PORT}; visual-only wrapper over v0.11.2`);
});
