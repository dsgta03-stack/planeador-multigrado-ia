import http from "node:http";
import fs from "node:fs";

const PORT = Number(process.env.PORT || 3000);
const RETRIEVAL_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/planner-demo-v084-v3";

const source = fs.readFileSync(new URL('./server-v084.mjs', import.meta.url), 'utf8');
const marker = 'const html = String.raw`';
const start = source.indexOf(marker) + marker.length;
const end = source.indexOf('`;\nfunction json', start);
if (start < marker.length || end < 0) throw new Error('No se pudo reutilizar la interfaz V0.8.4');
let html = source.slice(start, end);

html = html.replace(
  'La pertinencia es relativa dentro de cada grado. Máximo 4 PDA por grado. Puedes continuar aunque algún grado quede sin PDA seleccionado.',
  'La problemática define qué PDA entran como candidatos. El contexto solo ayuda a ordenar su pertinencia y después se usa para adaptar la planeación. Los PDA de baja pertinencia quedan ocultos por defecto, pero puedes consultarlos. Máximo 4 PDA por grado.'
);

const patch = String.raw`
<script>
state.showLow={};

function v3VisibleRows(g){
  const all=state.data?.candidatesByGrade?.[g]||[];
  return all.filter(r=>{
    const rel=relevance(all,r);
    return rel.label!=='Baja' || state.showLow[g] || !!state.selected[r.pda_id];
  });
}

// Reutiliza el mismo componente LTG de V0.8.4; solo filtra visualmente PDA de baja pertinencia.
drawList=function(){
  const all=state.data?.candidatesByGrade?.[state.active]||[];
  const rows=v3VisibleRows(state.active);
  const low=all.filter(r=>relevance(all,r).label==='Baja' && !state.selected[r.pda_id]);
  let body=rows.length?rows.map(r=>{
    const sel=!!state.selected[r.pda_id],rel=relevance(all,r);
    const chipClass=rel.pct>=70?'good':rel.pct>=40?'mid':'';
    let projects='';
    if(sel&&r.linked_projects?.length){
      const choice=state.projects[r.pda_id];
      projects='<div class="project"><strong>LTG opcional y realmente vinculado</strong>'+r.linked_projects.map(p=>'<label style="display:block;margin-top:7px;font-weight:500"><input type="radio" name="ltg-'+esc(r.pda_id)+'" data-pda="'+esc(r.pda_id)+'" data-project="'+esc(p.project_id)+'" '+(choice?.project_id===p.project_id?'checked':'')+'> '+esc(p.name)+' · '+esc(p.book)+'</label>').join('')+'<button class="'+(choice?.mode==='none'?'primary':'secondary')+' clear-project" data-pda="'+esc(r.pda_id)+'" style="margin-top:8px;padding:6px 9px">No usar LTG</button></div>';
    }
    return '<article class="candidate '+(sel?'sel':'')+'"><div class="head"><div><span class="id">'+esc(r.pda_id)+'</span><h3>'+esc(r.content_official)+'</h3></div><button class="'+(sel?'secondary':'primary')+'" data-id="'+esc(r.pda_id)+'">'+(sel?'Retirar':'Seleccionar')+'</button></div><p>'+esc(r.pda_official)+'</p><div class="meta"><span class="chip">'+esc(r.field)+'</span><span class="chip">'+esc(r.evidence_basis)+'</span><span class="chip '+chipClass+'">Pertinencia '+rel.pct+'% · '+rel.label+'</span></div>'+projects+'</article>';
  }).join(''):'<div class="notice">No se recuperaron candidatos con relación a la problemática para este grado.</div>';

  if(low.length){
    body+='<div class="actions" style="justify-content:flex-start"><button class="secondary" id="toggleLow">'+(state.showLow[state.active]?'Ocultar PDA de baja pertinencia':'Ver otros PDA relacionados ('+low.length+')')+'</button></div>';
  }
  $('list').innerHTML=body;

  $('list').querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.id,row=all.find(r=>r.pda_id===id);
    if(state.selected[id]){delete state.selected[id];delete state.projects[id]}
    else{if(count(row.grade)>=4){showErr('Máximo 4 PDA para '+row.grade+'.º');return}state.selected[id]=row;}
    showErr('');drawTabs();drawList();drawSummary();
  });
  $('list').querySelectorAll('input[data-project]').forEach(i=>i.onchange=()=>{
    const pda=i.dataset.pda,projectId=i.dataset.project,row=state.selected[pda],project=row?.linked_projects?.find(p=>p.project_id===projectId);
    if(project)state.projects[pda]={...project,mode:'project'};
  });
  $('list').querySelectorAll('.clear-project').forEach(b=>b.onclick=()=>{state.projects[b.dataset.pda]={mode:'none'};drawList();});
  const toggle=$('toggleLow'); if(toggle)toggle.onclick=()=>{state.showLow[state.active]=!state.showLow[state.active];drawList();};
};

const originalBuildPlan=buildPlan;
buildPlan=function(){
  originalBuildPlan();
  const context=$('context').value.trim();
  const sessions=[...$('sessionsPlan').querySelectorAll('.session')];
  sessions.forEach((el,i)=>{
    let use='Usar ejemplos, recursos, prácticas y situaciones observables en el contexto descrito para desarrollar el aprendizaje.';
    if(i===0) use='Identificar en el contexto escolar y comunitario evidencias concretas de la problemática y recuperar lo que el alumnado ya observa o vive.';
    else if(i===sessions.length-1) use='Cerrar con propuestas, productos o acciones que sean viables para el contexto escolar y comunitario descrito.';
    el.insertAdjacentHTML('beforeend','<div class="muted" style="margin-top:7px"><b>Aplicación al contexto:</b> '+esc(use)+' <span style="display:block;margin-top:3px">Contexto de referencia: '+esc(context)+'</span></div>');
  });
};
$('continue').onclick=buildPlan;
$('rebuild').onclick=buildPlan;

const originalSearch=$('search').onclick;
$('search').onclick=async()=>{state.showLow={};return originalSearch();};
</script>`;
html=html.replace('</body>',patch+'\n</body>');

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;}
  if(req.method==="GET"&&req.url==="/health"){json(res,200,{ok:true,version:"0.8.4",retrieval:"V3-PROBLEM-FIRST"});return;}
  if(req.method==="POST"&&req.url==="/api/retrieve"){
    let raw="";req.on("data",c=>{raw+=c;if(raw.length>25000)req.destroy();});
    req.on("end",async()=>{try{
      const body=JSON.parse(raw||"{}");
      const response=await fetch(RETRIEVAL_URL,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({grados:body.grados,contexto:body.contexto,situacion_problema:body.situacion_problema,intereses:body.intereses||[]})});
      const data=await response.json();json(res,response.status,data);
    }catch(error){json(res,500,{code:"DEMO_PROXY_ERROR",message:String(error)});}});return;
  }
  json(res,404,{code:"NOT_FOUND"});
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Planeador Multigrado IA v0.8.4 problem-first listening on ${PORT}`));
