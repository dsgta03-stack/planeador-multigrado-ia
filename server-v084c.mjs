import http from "node:http";

const PORT=Number(process.env.PORT||3000);
const UPSTREAM="https://planeador-multigrado-ia-v084b-production.up.railway.app/";
const GEMINI_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/evaluate-pda-gemini-lab";
const PLAN_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-gemini-lab";

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}

async function page(){
  const r=await fetch(UPSTREAM,{headers:{"cache-control":"no-cache"}});
  let html=await r.text();
  html=html.replaceAll("Demo V0.8.4b · pertinencia absoluta experimental","Demo V0.8.4c · análisis pedagógico contextual");
  html=html.replace("La problemática es la puerta principal. El porcentaje expresa pertinencia absoluta estimada, no posición relativa. Los PDA sin vinculación suficiente quedan fuera de la vista principal, pero puedes revisar opciones relacionadas. La selección final sigue siendo del docente.","La problemática y el contexto orientan la selección de candidatos oficiales. Después de tu selección, el sistema integra justificación, diagnóstico, pregunta articuladora, organización, diferenciación, evaluación y viabilidad sin modificar los textos oficiales.");

  const extra=String.raw`<script>
  const drawListGeminiBase=drawList;
  drawList=function(){
    drawListGeminiBase();
    const all=state.data?.candidatesByGrade?.[state.active]||[];
    document.querySelectorAll('#list article.candidate').forEach(card=>{
      const id=card.querySelector('.id')?.textContent?.trim();
      const row=all.find(r=>r.pda_id===id);
      if(!row?.gemini_justification)return;
      const box=document.createElement('div');
      box.className='notice'; box.style.marginTop='10px';
      box.innerHTML='<b>Fundamento de pertinencia:</b> '+esc(row.gemini_justification)+(row.relation_problem?'<br><span class="muted"><b>Relación con la problemática:</b> '+esc(row.relation_problem)+'</span>':'')+(row.relation_context?'<br><span class="muted"><b>Uso del contexto:</b> '+esc(row.relation_context)+'</span>':'');
      card.appendChild(box);
    });
  };

  function renderSelectedWithGemini(data){
    const vals=Object.values(state.selected).sort((a,b)=>a.grade-b.grade);
    const just=new Map((data.pda_justifications||[]).map(x=>[x.pda_id,x]));
    $('selectedPlan').innerHTML=state.grades.map(g=>{
      const items=vals.filter(v=>v.grade===g);
      if(!items.length)return '<div class="gradeBlock"><strong>'+g+'.º grado</strong><p class="muted">Sin PDA seleccionado por decisión docente. No se inventa un aprendizaje para completar la planeación.</p></div>';
      const groups=[];
      items.forEach(v=>{let group=groups.find(x=>x.content===v.content_official);if(!group){group={content:v.content_official,field:v.field,pdas:[]};groups.push(group)}group.pdas.push(v)});
      return '<div class="gradeBlock"><strong>'+g+'.º grado</strong>'+groups.map(group=>'<div class="pdaRow"><b>Campo formativo:</b> '+esc(group.field)+'<br><b>Contenido:</b> '+esc(group.content)+'<div style="margin-top:8px">'+group.pdas.map(v=>{const j=just.get(v.pda_id);return '<div style="margin:8px 0 12px"><b>'+esc(v.pda_id)+'</b><br><b>PDA:</b> '+esc(v.pda_official)+'<br><span class="muted"><b>Justificación pedagógica:</b> '+esc(j?.justification||v.gemini_justification||'No se recibió una justificación válida; revisar manualmente.')+'</span>'+(j?.role_in_common_experience?'<br><span class="muted"><b>Papel en la experiencia común:</b> '+esc(j.role_in_common_experience)+'</span>':'')+'</div>'}).join('')+'</div></div>').join('')+'</div>';
    }).join('');
  }

  async function applyGeminiPlanSupport(){
    const vals=Object.values(state.selected).sort((a,b)=>a.grade-b.grade);
    if(!vals.length)return;
    const baseEval=$('evaluation').innerHTML;
    const baseWarnings=$('warnings').innerHTML;
    const baseLtg=$('ltgPlan').innerHTML;
    const wait=document.createElement('div');wait.id='geminiPlanWait';wait.className='notice';wait.innerHTML='<b>Analizando la selección...</b> Se conserva el borrador base mientras termina.';
    $('diagnosis').parentElement.prepend(wait);
    const ltg=Object.entries(state.projects).filter(([,p])=>p?.project_id).map(([pda,p])=>({pda_id:pda,project_id:p.project_id,name:p.name,book:p.book,start_page:p.start_page,end_page:p.end_page}));
    const payload={
      pda_ids:vals.map(v=>v.pda_id),
      grados:state.grades,
      alumnos_por_grado:state.students||{},
      contexto:$('context').value.trim(),
      situacion_problema:$('problem').value.trim(),
      lectura:$('reading').value,
      escritura:$('writing').value,
      autonomia:$('autonomy').value,
      sesiones:Math.max(1,+$('sessions').value||5),
      minutos:Math.max(15,+$('minutes').value||90),
      recursos:$('resources').value.trim(),
      apoyos:$('supports').value.trim()||'No especificados',
      ltg
    };
    try{
      const r=await fetch('/api/gemini-plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data=await r.json();
      if(!r.ok)throw new Error(data.message||data.code||'No fue posible completar el análisis pedagógico');
      renderSelectedWithGemini(data);
      $('diagnosis').innerHTML=esc(data.diagnosis||'')+'<br><span class="muted"><b>Análisis del contexto:</b> elaborado a partir de los datos observables capturados; no constituye un diagnóstico clínico.</span>';
      $('question').textContent=data.guiding_question||$('question').textContent;
      $('axes').innerHTML=(data.axes||[]).length?(data.axes||[]).map(a=>'<div class="gradeBlock"><b>'+esc(a.name)+'</b><br><span class="muted">'+esc(a.reason)+'</span></div>').join(''):'<p class="muted">No se identificó un eje articulador que deba activarse de forma necesaria. No se agregan ejes por relleno.</p>';
      const diff=(data.differentiation||[]).map(d=>'<div class="gradeBlock"><b>'+esc(d.grade)+'.º grado</b><br>'+esc(d.guidance)+'</div>').join('');
      $('organization').innerHTML='<p>'+esc(data.organization_multigrade||'')+'</p>'+(data.context_application?'<div class="notice"><b>Cómo entra el contexto:</b> '+esc(data.context_application)+'</div>':'')+(diff?'<h4>Diferenciación por grado</h4>'+diff:'');
      const ev=(data.evaluation||[]).map(e=>{const row=vals.find(v=>v.pda_id===e.pda_id);return '<div class="gradeBlock"><b>'+esc(row?.grade||'')+'.º · '+esc(e.pda_id)+'</b><br><b>Criterio observable:</b> '+esc(e.criterion)+'<br><b>Evidencia:</b> '+esc(e.evidence)+'<br><b>Instrumento:</b> '+esc(e.instrument)+'</div>';}).join('');
      $('evaluation').innerHTML=(ev?'<p class="muted">Criterios derivados directamente de los PDA seleccionados.</p>'+ev:'')+'<h4>Orientación formativa complementaria</h4>'+baseEval;
      const ltgUse=(data.ltg_use||[]).map(x=>'<div class="notice"><b>Uso sugerido para '+esc(x.pda_id)+':</b> '+esc(x.usage)+'</div>').join('');
      $('ltgPlan').innerHTML=baseLtg+ltgUse;
      const warn=(data.warnings||[]).map(w=>'<div class="notice warn">'+esc(w)+'</div>').join('');
      const viability=data.viability?'<div class="notice"><b>Viabilidad pedagógica: '+esc(data.viability.level)+'</b><br>'+esc(data.viability.reason)+'</div>':'';
      $('warnings').innerHTML=viability+warn+baseWarnings;
    }catch(error){
      $('warnings').insertAdjacentHTML('afterbegin','<div class="notice warn"><b>No fue posible completar el análisis complementario.</b> Se conserva la versión base. '+esc(String(error))+'</div>');
    }finally{document.getElementById('geminiPlanWait')?.remove();}
  }

  const buildPlanGeminiBase=buildPlan;
  buildPlan=async function(){buildPlanGeminiBase();await applyGeminiPlanSupport();};
  $('continue').onclick=buildPlan;
  $('rebuild').onclick=buildPlan;
  </script>`;
  return html.replace('</body>',extra+'</body>');
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/'){
    try{const html=await page();res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);}catch(e){res.writeHead(502);res.end(String(e));}return;
  }
  if(req.method==='GET'&&req.url==='/health'){json(res,200,{ok:true,version:'0.8.4c',retrieval:'GEMINI-PDA-LAB-V2',planSupport:'GEMINI-PLAN-SUPPORT-V1',model:'gemini-3.5-flash-lite'});return;}
  if(req.method==='POST'&&req.url==='/api/retrieve'){
    let raw='';req.on('data',c=>{raw+=c;if(raw.length>30000)req.destroy();});
    req.on('end',async()=>{try{const body=JSON.parse(raw||'{}');const r=await fetch(GEMINI_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grados:body.grados,contexto:body.contexto,situacion_problema:body.situacion_problema,intereses:body.intereses||[],sesiones:body.sesiones||5,minutos:body.minutos||90})});const data=await r.json();json(res,r.status,data);}catch(e){json(res,500,{code:'GEMINI_PROXY_ERROR',message:String(e)});}});return;
  }
  if(req.method==='POST'&&req.url==='/api/gemini-plan'){
    let raw='';req.on('data',c=>{raw+=c;if(raw.length>60000)req.destroy();});
    req.on('end',async()=>{try{const body=JSON.parse(raw||'{}');const r=await fetch(PLAN_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();json(res,r.status,data);}catch(e){json(res,500,{code:'GEMINI_PLAN_PROXY_ERROR',message:String(e)});}});return;
  }
  json(res,404,{code:'NOT_FOUND'});
});
server.listen(PORT,'0.0.0.0',()=>console.log('V0.8.4c Gemini lab listening on '+PORT));