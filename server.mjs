import http from "node:http";

const PORT = Number(process.env.PORT || 3000);
const RETRIEVAL_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/planner-demo-v08";

const html = String.raw`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Planeador Multigrado IA</title>
<style>
:root{--bg:#f5f7f4;--card:#fff;--text:#172019;--muted:#657168;--line:#d8e0d8;--green:#1d6a45;--green2:#154e34;--soft:#edf7f1;--red:#8b3030}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}header{position:sticky;top:0;z-index:10;background:#f5f7f4ee;border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}.wrap{width:min(1120px,calc(100% - 24px));margin:auto}.top{min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{font-weight:900}.badge{font-size:12px;color:var(--muted);border:1px solid var(--line);background:white;border-radius:999px;padding:6px 10px}main{padding:28px 0 64px}.hero,.card{background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 8px 24px #1734230d}.hero{padding:25px;margin-bottom:18px}.hero h1{margin:0 0 8px;font-size:clamp(30px,5vw,46px);line-height:1.05}.hero p{margin:0;color:var(--muted);line-height:1.55;max-width:790px}.card{padding:22px;margin-bottom:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.full{grid-column:1/-1}label{display:grid;gap:6px;font-size:13px;font-weight:800}input,textarea,select{width:100%;font:inherit;padding:11px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--text)}textarea{min-height:92px;resize:vertical}.grades,.tabs,.meta{display:flex;flex-wrap:wrap;gap:8px}.grade,.tab,.secondary{border:1px solid var(--line);background:white;border-radius:10px;padding:9px 12px;font-weight:800}.grade.on,.tab.on{background:var(--green);color:white;border-color:var(--green)}.primary{border:0;background:var(--green);color:white;border-radius:10px;padding:11px 15px;font-weight:850}.primary:hover{background:var(--green2)}button{cursor:pointer;font:inherit}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.notice{padding:11px 13px;border-radius:10px;background:#eef5ff;border:1px solid #d6e4fb;color:#274b74;margin:12px 0}.error{background:#fff0f0;border-color:#eccaca;color:var(--red)}.hidden{display:none}.candidate{background:white;border:1px solid var(--line);border-radius:13px;padding:15px;margin:10px 0}.candidate.sel{border-color:var(--green);box-shadow:0 0 0 2px #1d6a4512}.head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.id{font-size:11px;font-weight:900;color:var(--green2);background:var(--soft);border-radius:999px;padding:5px 7px}.candidate h3{font-size:15px;margin:8px 0 5px}.candidate p{line-height:1.55}.chip{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:4px 7px}.summary{margin-top:16px;padding:15px;background:#f0f4ef;border-radius:12px}.muted{color:var(--muted)}.footer{text-align:center;color:var(--muted);font-size:12px;padding-top:15px}@media(max-width:720px){.grid{grid-template-columns:1fr}.full{grid-column:auto}.actions{flex-direction:column}.actions button{width:100%}.head{align-items:stretch;flex-direction:column}.head button{width:100%}}
</style>
</head>
<body>
<header><div class="wrap top"><div class="brand">Planeador Multigrado IA</div><div class="badge">Demo V0.8 · sin API de pago</div></div></header>
<main class="wrap">
<section class="hero"><h1>Planea desde el contexto.</h1><p>Describe una situación real de tu escuela. El sistema recupera PDA oficiales por grado; tú revisas y seleccionas. El ranking ayuda, pero no decide por ti.</p></section>
<section class="card" id="formCard">
<h2>1. Contexto docente</h2>
<p class="muted">Evita nombres de estudiantes o diagnósticos médicos. Describe solo necesidades pedagógicas observables.</p>
<div class="grid">
<div class="full"><label>Grados</label><div class="grades" id="grades"></div></div>
<label class="full">Contexto escolar y comunitario<textarea id="context">Escuela primaria multigrado con un docente y recursos básicos.</textarea></label>
<label class="full">Situación o problema prioritario<textarea id="problem" placeholder="Ej. En la escuela se desperdicia agua y en temporada seca hay escasez en la comunidad."></textarea></label>
<label>Sesiones<input id="sessions" type="number" min="1" max="20" value="5"></label>
<label>Minutos por sesión<input id="minutes" type="number" min="15" value="90"></label>
<label>Conectividad<select id="connectivity"><option value="ninguna">Sin internet</option><option value="intermitente">Intermitente</option><option value="estable">Estable</option></select></label>
<label>Intereses<input id="interests" placeholder="Animales, experimentos, historias..."></label>
<label class="full">Recursos disponibles<input id="resources" value="Pizarrón, cuadernos, libros, entorno"></label>
</div>
<div id="err"></div>
<div class="actions"><button class="primary" id="search">Buscar candidatos oficiales</button></div>
</section>
<section class="card hidden" id="results">
<h2>2. Candidatos oficiales</h2>
<div class="notice">Selecciona solo los PDA que realmente respondan a la situación. Máximo 4 por grado.</div>
<div class="tabs" id="tabs"></div>
<div id="list"></div>
<div class="summary" id="summary"></div>
</section>
<div class="footer">Corpus: 1,333 PDA · 427 proyectos LTG · 1,418 vínculos PDA↔LTG</div>
</main>
<script>
const state={grades:[1,2,3,4,5,6],active:1,data:null,selected:{}};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const split=v=>v.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
function count(g){return Object.values(state.selected).filter(x=>x.grade===g).length}
function drawGrades(){ $('grades').innerHTML=[1,2,3,4,5,6].map(g=>'<button type="button" class="grade '+(state.grades.includes(g)?'on':'')+'" data-g="'+g+'">'+g+'.º</button>').join(''); $('grades').querySelectorAll('button').forEach(b=>b.onclick=()=>{const g=+b.dataset.g;state.grades=state.grades.includes(g)?state.grades.filter(x=>x!==g):[...state.grades,g].sort();drawGrades();});}
function showErr(msg){$('err').innerHTML=msg?'<div class="notice error">'+esc(msg)+'</div>':''}
function drawTabs(){ $('tabs').innerHTML=state.grades.map(g=>'<button class="tab '+(state.active===g?'on':'')+'" data-g="'+g+'">'+g+'.º ('+count(g)+'/4)</button>').join(''); $('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.active=+b.dataset.g;drawTabs();drawList();});}
function drawSummary(){const vals=Object.values(state.selected).sort((a,b)=>a.grade-b.grade);$('summary').innerHTML='<strong>Selección actual: '+vals.length+' PDA</strong><br>'+(vals.length?vals.map(r=>r.grade+'.º '+r.pda_id+' — '+esc(r.content_official)).join('<br>'):'Aún no has seleccionado PDA.');}
function drawList(){const rows=state.data?.candidatesByGrade?.[state.active]||[];$('list').innerHTML=rows.length?rows.map(r=>{const sel=!!state.selected[r.pda_id];return '<article class="candidate '+(sel?'sel':'')+'"><div class="head"><div><span class="id">'+esc(r.pda_id)+'</span><h3>'+esc(r.content_official)+'</h3></div><button class="'+(sel?'secondary':'primary')+'" data-id="'+esc(r.pda_id)+'">'+(sel?'Retirar':'Seleccionar')+'</button></div><p>'+esc(r.pda_official)+'</p><div class="meta"><span class="chip">'+esc(r.field)+'</span><span class="chip">'+esc(r.evidence_basis)+'</span><span class="chip">score '+Number(r.combined_rank||0).toFixed(3)+'</span></div>'+(r.linked_projects?.length?'<p class="muted"><strong>LTG vinculados:</strong> '+r.linked_projects.map(p=>esc(p.name)).join(' · ')+'</p>':'')+'</article>'}).join(''):'<div class="notice">No se recuperaron candidatos para este grado.</div>'; $('list').querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.id,row=rows.find(r=>r.pda_id===id);if(state.selected[id])delete state.selected[id];else{if(count(row.grade)>=4){showErr('Máximo 4 PDA para '+row.grade+'.º');return}state.selected[id]=row;}showErr('');drawTabs();drawList();drawSummary();});}
$('search').onclick=async()=>{showErr('');if(!state.grades.length)return showErr('Selecciona al menos un grado.');const context=$('context').value.trim(),problem=$('problem').value.trim();if(context.length<10||problem.length<5)return showErr('Completa contexto y problema prioritario.');$('search').disabled=true;$('search').textContent='Buscando…';try{const res=await fetch('/api/retrieve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grados:state.grades,contexto:context,situacion_problema:problem,intereses:split($('interests').value)})});const body=await res.json();if(!res.ok)throw new Error(body.message||body.code||'Error');state.data=body;state.active=state.grades[0];state.selected={};$('results').classList.remove('hidden');drawTabs();drawList();drawSummary();$('results').scrollIntoView({behavior:'smooth'});}catch(e){showErr(e.message)}finally{$('search').disabled=false;$('search').textContent='Buscar candidatos oficiales';}};
drawGrades();
</script>
</body></html>`;

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(html);
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, version: "0.8.2" });
    return;
  }

  if (req.method === "POST" && req.url === "/api/retrieve") {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 25_000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const body = JSON.parse(raw || "{}");
        const response = await fetch(RETRIEVAL_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "retrieve",
            grados: body.grados,
            contexto: body.contexto,
            situacion_problema: body.situacion_problema,
            intereses: body.intereses || [],
          }),
        });
        const data = await response.json();
        json(res, response.status, data);
      } catch (error) {
        json(res, 500, { code: "DEMO_PROXY_ERROR", message: String(error) });
      }
    });
    return;
  }

  json(res, 404, { code: "NOT_FOUND" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Planeador Multigrado IA demo listening on ${PORT}`);
});
