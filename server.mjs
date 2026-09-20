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
:root{--bg:#f5f7f4;--card:#fff;--text:#172019;--muted:#657168;--line:#d8e0d8;--green:#1d6a45;--green2:#154e34;--soft:#edf7f1;--red:#8b3030;--amber:#8a5a10}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}header{position:sticky;top:0;z-index:10;background:#f5f7f4ee;border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}.wrap{width:min(1120px,calc(100% - 24px));margin:auto}.top{min-height:64px;display:flex;align-items:center;justify-content:space-between;gap:12px}.brand{font-weight:900}.badge{font-size:12px;color:var(--muted);border:1px solid var(--line);background:white;border-radius:999px;padding:6px 10px}main{padding:28px 0 64px}.hero,.card{background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 8px 24px #1734230d}.hero{padding:25px;margin-bottom:18px}.hero h1{margin:0 0 8px;font-size:clamp(30px,5vw,46px);line-height:1.05}.hero p{margin:0;color:var(--muted);line-height:1.55;max-width:790px}.card{padding:22px;margin-bottom:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.full{grid-column:1/-1}label{display:grid;gap:6px;font-size:13px;font-weight:800}input,textarea,select{width:100%;font:inherit;padding:11px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--text)}textarea{min-height:92px;resize:vertical}.grades,.tabs,.meta{display:flex;flex-wrap:wrap;gap:8px}.grade,.tab,.secondary{border:1px solid var(--line);background:white;border-radius:10px;padding:9px 12px;font-weight:800}.grade.on,.tab.on{background:var(--green);color:white;border-color:var(--green)}.primary{border:0;background:var(--green);color:white;border-radius:10px;padding:11px 15px;font-weight:850}.primary:hover{background:var(--green2)}button{cursor:pointer;font:inherit}.actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.notice{padding:11px 13px;border-radius:10px;background:#eef5ff;border:1px solid #d6e4fb;color:#274b74;margin:12px 0}.warn{background:#fff7e8;border-color:#efd6a7;color:#71460b}.error{background:#fff0f0;border-color:#eccaca;color:var(--red)}.hidden{display:none}.candidate{background:white;border:1px solid var(--line);border-radius:13px;padding:15px;margin:10px 0}.candidate.sel{border-color:var(--green);box-shadow:0 0 0 2px #1d6a4512}.head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.id{font-size:11px;font-weight:900;color:var(--green2);background:var(--soft);border-radius:999px;padding:5px 7px}.candidate h3{font-size:15px;margin:8px 0 5px}.candidate p{line-height:1.55}.chip{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:4px 7px}.chip.good{color:var(--green2);border-color:#a8ceb9;background:#f0f8f3}.chip.mid{color:var(--amber);border-color:#dfc590;background:#fff9ec}.summary{margin-top:16px;padding:15px;background:#f0f4ef;border-radius:12px}.muted{color:var(--muted)}.project{margin:8px 0 0;padding:10px;border-radius:9px;background:#f7f9f7;border:1px solid var(--line)}.planGrid{display:grid;grid-template-columns:1.4fr .7fr;gap:16px}.section{border-top:1px solid var(--line);padding-top:15px;margin-top:15px}.section h3{margin:0 0 8px}.pdaRow{border-left:3px solid var(--green);padding-left:11px;margin:11px 0}.gradeBlock{background:#f7faf7;border:1px solid var(--line);padding:13px;border-radius:11px;margin:10px 0}.session{padding:10px 0;border-bottom:1px solid var(--line)}.session:last-child{border-bottom:0}.status{font-size:24px;font-weight:900;color:var(--green)}.footer{text-align:center;color:var(--muted);font-size:12px;padding-top:15px}@media(max-width:760px){.grid,.planGrid{grid-template-columns:1fr}.full{grid-column:auto}.actions{flex-direction:column}.actions button{width:100%}.head{align-items:stretch;flex-direction:column}.head button{width:100%}}
</style>
</head>
<body>
<header><div class="wrap top"><div class="brand">Planeador Multigrado IA</div><div class="badge">Demo V0.8.3 · sin API de pago</div></div></header>
<main class="wrap">
<section class="hero"><h1>Planea desde el contexto.</h1><p>Describe una situación real. El sistema recupera PDA oficiales por grado; tú eliges y después construimos un borrador multigrado trazable.</p></section>

<section class="card" id="formCard">
<h2>1. Contexto docente</h2>
<p class="muted">Evita nombres de estudiantes o diagnósticos médicos. Describe necesidades pedagógicas observables.</p>
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
<div class="notice">La pertinencia es <strong>relativa dentro de cada grado</strong>: el mejor candidato recuperado de ese grado se muestra como 100%. No es una calificación curricular. Máximo 4 PDA por grado.</div>
<div class="tabs" id="tabs"></div>
<div id="list"></div>
<div class="summary" id="summary"></div>
<div class="actions"><button class="primary" id="continue" disabled>Continuar con la selección</button></div>
</section>

<section class="card hidden" id="plan">
<h2>3. Borrador multigrado</h2>
<div class="notice warn">Este borrador no usa IA generativa de pago. Organiza tus PDA oficiales con reglas del Motor V2 y deja claro qué falta afinar.</div>
<div class="planGrid">
<div>
<div class="section"><h3>Pregunta articuladora</h3><p id="question"></p></div>
<div class="section"><h3>PDA seleccionados por grado</h3><div id="selectedPlan"></div></div>
<div class="section"><h3>Organización multigrado sugerida</h3><div id="organization"></div></div>
<div class="section"><h3>Secuencia base</h3><div id="sessionsPlan"></div></div>
<div class="section"><h3>Evaluación inicial</h3><div id="evaluation"></div></div>
</div>
<aside>
<div class="summary"><div class="muted">Validación estructural</div><div class="status" id="status">REVISAR</div><div id="checks"></div></div>
<div class="section"><h3>¿Qué sigue?</h3><p class="muted">El siguiente desarrollo convertirá esta estructura en actividades detalladas, productos, instrumentos y versión imprimible. La selección curricular ya queda trazable.</p></div>
</aside>
</div>
<div class="actions"><button class="secondary" id="back">Ajustar PDA</button><button class="primary" id="rebuild">Reconstruir borrador</button></div>
</section>

<div class="footer">Corpus: 1,333 PDA · 427 proyectos LTG · 1,418 vínculos PDA↔LTG</div>
</main>
<script>
const state={grades:[1,2,3,4,5,6],active:1,data:null,selected:{},projects:{}};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const split=v=>v.split(/[,;\\n]/).map(x=>x.trim()).filter(Boolean);
function count(g){return Object.values(state.selected).filter(x=>x.grade===g).length}
function drawGrades(){$('grades').innerHTML=[1,2,3,4,5,6].map(g=>'<button type="button" class="grade '+(state.grades.includes(g)?'on':'')+'" data-g="'+g+'">'+g+'.º</button>').join('');$('grades').querySelectorAll('button').forEach(b=>b.onclick=()=>{const g=+b.dataset.g;state.grades=state.grades.includes(g)?state.grades.filter(x=>x!==g):[...state.grades,g].sort();drawGrades();});}
function showErr(msg){$('err').innerHTML=msg?'<div class="notice error">'+esc(msg)+'</div>':''}
function drawTabs(){$('tabs').innerHTML=state.grades.map(g=>'<button class="tab '+(state.active===g?'on':'')+'" data-g="'+g+'">'+g+'.º ('+count(g)+'/4)</button>').join('');$('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.active=+b.dataset.g;drawTabs();drawList();});}
function relevance(rows,row){const max=Math.max(...rows.map(r=>Number(r.combined_rank||0)),0);const pct=max>0?Math.max(1,Math.round(Number(row.combined_rank||0)/max*100)):0;return {pct,label:pct>=70?'Alta':pct>=40?'Media':'Baja'};}
function drawSummary(){const vals=Object.values(state.selected).sort((a,b)=>a.grade-b.grade);$('summary').innerHTML='<strong>Selección actual: '+vals.length+' PDA</strong><br>'+(vals.length?vals.map(r=>r.grade+'.º '+r.pda_id+' — '+esc(r.content_official)).join('<br>'):'Aún no has seleccionado PDA.');$('continue').disabled=!vals.length;}
function drawList(){const rows=state.data?.candidatesByGrade?.[state.active]||[];$('list').innerHTML=rows.length?rows.map(r=>{const sel=!!state.selected[r.pda_id],rel=relevance(rows,r);const chipClass=rel.pct>=70?'good':rel.pct>=40?'mid':'';let projects='';if(sel&&r.linked_projects?.length){projects='<div class="project"><strong>LTG opcional y realmente vinculado</strong>'+r.linked_projects.map(p=>'<label style="display:block;margin-top:7px;font-weight:500"><input type="radio" name="ltg-'+esc(r.pda_id)+'" data-pda="'+esc(r.pda_id)+'" data-project="'+esc(p.project_id)+'" '+(state.projects[r.pda_id]?.project_id===p.project_id?'checked':'')+'> '+esc(p.name)+' · '+esc(p.book)+'</label>').join('')+'<button class="secondary clear-project" data-pda="'+esc(r.pda_id)+'" style="margin-top:8px;padding:6px 9px">No usar LTG</button></div>';}return '<article class="candidate '+(sel?'sel':'')+'"><div class="head"><div><span class="id">'+esc(r.pda_id)+'</span><h3>'+esc(r.content_official)+'</h3></div><button class="'+(sel?'secondary':'primary')+'" data-id="'+esc(r.pda_id)+'">'+(sel?'Retirar':'Seleccionar')+'</button></div><p>'+esc(r.pda_official)+'</p><div class="meta"><span class="chip">'+esc(r.field)+'</span><span class="chip">'+esc(r.evidence_basis)+'</span><span class="chip '+chipClass+'">Pertinencia '+rel.pct+'% · '+rel.label+'</span></div>'+projects+'</article>'}).join(''):'<div class="notice">No se recuperaron candidatos para este grado.</div>';
$('list').querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.id,row=rows.find(r=>r.pda_id===id);if(state.selected[id]){delete state.selected[id];delete state.projects[id]}else{if(count(row.grade)>=4){showErr('Máximo 4 PDA para '+row.grade+'.º');return}state.selected[id]=row;}showErr('');drawTabs();drawList();drawSummary();});
$('list').querySelectorAll('input[data-project]').forEach(i=>i.onchange=()=>{const pda=i.dataset.pda,projectId=i.dataset.project,row=state.selected[pda],project=row?.linked_projects?.find(p=>p.project_id===projectId);if(project)state.projects[pda]=project;});
$('list').querySelectorAll('.clear-project').forEach(b=>b.onclick=()=>{delete state.projects[b.dataset.pda];drawList();});}
function blocks(){const pairs=[[1,2],[3,4],[5,6]];return pairs.map(p=>p.filter(g=>state.grades.includes(g))).filter(x=>x.length);}
function buildPlan(){const vals=Object.values(state.selected).sort((a,b)=>a.grade-b.grade),problem=$('problem').value.trim(),sessions=Math.max(1,Number($('sessions').value)||5),minutes=Math.max(15,Number($('minutes').value)||90);$('question').textContent='¿Qué podemos hacer en nuestra escuela y comunidad frente a: '+problem+'?';
$('selectedPlan').innerHTML=state.grades.map(g=>{const items=vals.filter(v=>v.grade===g);return '<div class="gradeBlock"><strong>'+g+'.º grado</strong>'+(items.length?items.map(v=>'<div class="pdaRow"><b>'+esc(v.pda_id)+'</b><br>'+esc(v.pda_official)+(state.projects[v.pda_id]?'<div class="muted">LTG elegido: '+esc(state.projects[v.pda_id].name)+'</div>':'<div class="muted">Sin LTG forzado</div>')+'</div>').join(''):'<p class="muted">Sin PDA seleccionado: requiere revisión.</p>')+'</div>'}).join('');
$('organization').innerHTML='<p>Trabajar en '+blocks().length+' bloque(s): <strong>'+blocks().map(b=>b.map(g=>g+'.º').join('–')).join(', ')+'</strong>. Apertura y cierre comunes; el docente rota entre bloques y deja tareas de autonomía creciente.</p>';
$('sessionsPlan').innerHTML=Array.from({length:sessions},(_,i)=>'<div class="session"><strong>Sesión '+(i+1)+' · '+minutes+' min</strong><br>'+(i===0?'Explorar el problema, recuperar saberes previos y acordar la pregunta común.':i===sessions-1?'Socializar productos, recuperar evidencias y valorar lo aprendido.':'Desarrollar una experiencia común con actividades diferenciadas por bloque y grado.')+'</div>').join('');
$('evaluation').innerHTML=state.grades.map(g=>'<p><strong>'+g+'.º:</strong> observar una evidencia directamente relacionada con los PDA seleccionados; usar producto, desempeño, explicación oral/escrita o registro según el PDA.</p>').join('');
const missing=state.grades.filter(g=>!vals.some(v=>v.grade===g)),over=state.grades.filter(g=>vals.filter(v=>v.grade===g).length>4),badLtg=Object.keys(state.projects).filter(id=>!state.selected[id]);const findings=[];if(missing.length)findings.push('Faltan PDA en: '+missing.map(g=>g+'.º').join(', '));if(over.length)findings.push('Sobrecarga en: '+over.join(', '));if(badLtg.length)findings.push('Hay LTG sin PDA activo.');const ok=!findings.length;$('status').textContent=ok?'APROBADO':'REVISAR';$('status').style.color=ok?'var(--green)':'var(--amber)';$('checks').innerHTML=ok?'<p>✓ Todos los grados tienen selección.<br>✓ Máximo 4 PDA por grado.<br>✓ LTG solo desde vínculos oficiales.</p>':'<ul>'+findings.map(f=>'<li>'+esc(f)+'</li>').join('')+'</ul>';
$('plan').classList.remove('hidden');$('plan').scrollIntoView({behavior:'smooth'});}
$('search').onclick=async()=>{showErr('');if(!state.grades.length)return showErr('Selecciona al menos un grado.');const context=$('context').value.trim(),problem=$('problem').value.trim();if(context.length<10||problem.length<5)return showErr('Completa contexto y problema prioritario.');$('search').disabled=true;$('search').textContent='Buscando…';try{const res=await fetch('/api/retrieve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grados:state.grades,contexto:context,situacion_problema:problem,intereses:split($('interests').value)})});const body=await res.json();if(!res.ok)throw new Error(body.message||body.code||'Error');state.data=body;state.active=state.grades[0];state.selected={};state.projects={};$('results').classList.remove('hidden');$('plan').classList.add('hidden');drawTabs();drawList();drawSummary();$('results').scrollIntoView({behavior:'smooth'});}catch(e){showErr(e.message)}finally{$('search').disabled=false;$('search').textContent='Buscar candidatos oficiales';}};
$('continue').onclick=buildPlan;$('rebuild').onclick=buildPlan;$('back').onclick=()=>{$('results').scrollIntoView({behavior:'smooth'})};drawGrades();
</script>
</body></html>`;

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
 if(req.method==="GET"&&req.url==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;}
 if(req.method==="GET"&&req.url==="/health"){json(res,200,{ok:true,version:"0.8.3"});return;}
 if(req.method==="POST"&&req.url==="/api/retrieve"){let raw="";req.on("data",c=>{raw+=c;if(raw.length>25000)req.destroy();});req.on("end",async()=>{try{const body=JSON.parse(raw||"{}");const response=await fetch(RETRIEVAL_URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"retrieve",grados:body.grados,contexto:body.contexto,situacion_problema:body.situacion_problema,intereses:body.intereses||[]})});const data=await response.json();json(res,response.status,data);}catch(error){json(res,500,{code:"DEMO_PROXY_ERROR",message:String(error)});}});return;}
 json(res,404,{code:"NOT_FOUND"});
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Planeador Multigrado IA demo listening on ${PORT}`));
