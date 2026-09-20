import http from "node:http";

const PORT=Number(process.env.PORT||3000);
const UPSTREAM="https://planeador-multigrado-ia-v084b-production.up.railway.app/";
const GEMINI_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/evaluate-pda-gemini-lab";
const PLAN_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-gemini-lab";

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}

async function page(){
  const r=await fetch(UPSTREAM,{headers:{"cache-control":"no-cache"}});
  let html=await r.text();
  html=html.replaceAll("Demo V0.8.4b · pertinencia absoluta experimental","Demo V0.8.4c · planeación multigrado contextual");
  html=html.replace("La problemática es la puerta principal. El porcentaje expresa pertinencia absoluta estimada, no posición relativa. Los PDA sin vinculación suficiente quedan fuera de la vista principal, pero puedes revisar opciones relacionadas. La selección final sigue siendo del docente.","La problemática y el contexto orientan la selección de candidatos oficiales. Después de tu selección, el sistema integra justificación, secuencia multigrado, diferenciación, evaluación y viabilidad sin modificar los textos oficiales ni tus decisiones curriculares.");

  const extra=String.raw`<script>
  const drawListBase=drawList;
  drawList=function(){
    drawListBase();
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

  function renderSelected(data){
    const vals=Object.values(state.selected).sort((a,b)=>a.grade-b.grade);
    const just=new Map((data.pda_justifications||[]).map(x=>[x.pda_id,x]));
    $('selectedPlan').innerHTML=state.grades.map(g=>{
      const items=vals.filter(v=>v.grade===g);
      if(!items.length)return '<div class="gradeBlock"><strong>'+g+'.º grado</strong><p class="muted">Sin PDA seleccionado por decisión docente. No se inventa un aprendizaje para completar la planeación.</p></div>';
      const groups=[];
      items.forEach(v=>{let group=groups.find(x=>x.content===v.content_official);if(!group){group={content:v.content_official,field:v.field,pdas:[]};groups.push(group)}group.pdas.push(v)});
      return '<div class="gradeBlock"><strong>'+g+'.º grado</strong>'+groups.map(group=>'<div class="pdaRow"><b>Campo formativo:</b> '+esc(group.field)+'<br><b>Contenido:</b> '+esc(group.content)+'<div style="margin-top:8px">'+group.pdas.map(v=>{const j=just.get(v.pda_id);return '<div style="margin:8px 0 12px"><b>'+esc(v.pda_id)+'</b><br><b>PDA:</b> '+esc(v.pda_official)+'<br><span class="muted"><b>Justificación pedagógica:</b> '+esc(j?.justification||v.gemini_justification||'Revisar la relación pedagógica de este PDA.')+'</span>'+(j?.role_in_common_experience?'<br><span class="muted"><b>Papel en la experiencia común:</b> '+esc(j.role_in_common_experience)+'</span>':'')+'</div>'}).join('')+'</div></div>').join('')+'</div>';
    }).join('');
  }

  function renderSessions(data){
    const sessions=data.sessions||[];
    if(!sessions.length)return;
    $('sessionsPlan').innerHTML=sessions.map(s=>{
      const moments=(s.work_moments||[]).map(m=>{
        const others=(m.other_blocks||[]).map(b=>'<div class="gradeBlock" style="margin:8px 0"><b>'+esc(b.block)+'</b> · '+esc((b.grades||[]).map(g=>g+'.º').join(', '))+'<br><b>Actividad:</b> '+esc(b.activity)+(b.teacher_tone_guidance?'<br><b>Orientación para conducirla:</b> '+esc(b.teacher_tone_guidance):'')+'<br><b>PDA vinculados:</b> '+esc((b.pda_ids||[]).join(', ')||'Sin PDA asignado a este tramo')+'<br><b>Apoyo para autonomía:</b> '+esc(b.autonomy_support)+'<br><b>Recursos:</b> '+esc((b.resources||[]).join(', '))+'<br><b>Evidencia:</b> '+esc(b.evidence)+'<br><b>Seguimiento:</b> '+esc(b.assessment)+'</div>').join('');
        return '<div class="gradeBlock"><b>Momento '+esc(m.moment)+' · '+esc(m.minutes)+' min</b><br><b>Atención directa:</b> '+esc(m.direct_teacher_block)+'<br><b>Intervención docente:</b> '+esc(m.direct_teacher_action)+(others?'<div style="margin-top:8px"><b>Mientras tanto, los demás bloques:</b>'+others+'</div>':'')+'</div>';
      }).join('');
      return '<div class="session"><strong>Sesión '+esc(s.session_number)+' · '+esc(s.total_minutes)+' min</strong><br><b>Propósito:</b> '+esc(s.purpose)+'<br><b>PDA de la sesión:</b> '+esc((s.pda_ids||[]).join(', '))+(s.continuity_from_previous?'<br><b>Continuidad:</b> '+esc(s.continuity_from_previous):'')+'<div class="gradeBlock" style="margin-top:10px"><b>Apertura común · '+esc(s.opening_minutes)+' min</b><br>'+esc(s.common_opening)+'</div>'+moments+'<div class="gradeBlock"><b>Cierre común · '+esc(s.closure_minutes)+' min</b><br>'+esc(s.common_closure)+'</div>'+(s.prepares_next?'<div class="muted"><b>Enlace con la siguiente sesión:</b> '+esc(s.prepares_next)+'</div>':'')+'</div>';
    }).join('');
  }

  function renderProducts(data){
    const products=data.products||[];
    if(!products.length)return '';
    return '<h4>Productos y evidencias por grado</h4>'+products.map(p=>'<div class="gradeBlock"><b>'+esc(p.grade)+'.º grado</b><br><b>Productos parciales:</b> '+esc((p.partial_products||[]).join(' · ')||'No requiere productos parciales')+'<br><b>Evidencia final:</b> '+esc(p.final_evidence)+'</div>').join('');
  }

  async function applyPlanSupport(){
    const vals=Object.values(state.selected).sort((a,b)=>a.grade-b.grade);
    if(!vals.length)return;
    const baseEval=$('evaluation').innerHTML;
    const baseWarnings=$('warnings').innerHTML;
    const baseLtg=$('ltgPlan').innerHTML;
    const baseSessions=$('sessionsPlan').innerHTML;
    const wait=document.createElement('div');wait.id='planWait';wait.className='notice';wait.innerHTML='<b>Construyendo la secuencia didáctica...</b> Se conserva el borrador base mientras termina.';
    $('diagnosis').parentElement.prepend(wait);
    const ltg=Object.entries(state.projects).filter(([,p])=>p?.project_id).map(([pda,p])=>({pda_id:pda,project_id:p.project_id,name:p.name,book:p.book,start_page:p.start_page,end_page:p.end_page}));
    const payload={
      pda_ids:vals.map(v=>v.pda_id),grados:state.grades,alumnos_por_grado:state.students||{},contexto:$('context').value.trim(),situacion_problema:$('problem').value.trim(),lectura:$('reading').value,escritura:$('writing').value,autonomia:$('autonomy').value,conectividad:$('connectivity').value,sesiones:Math.max(1,+$('sessions').value||5),minutos:Math.max(15,+$('minutes').value||90),recursos:$('resources').value.trim(),apoyos:$('supports').value.trim()||'No especificados',ltg
    };
    try{
      const r=await fetch('/api/gemini-plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data=await r.json();
      if(!r.ok)throw new Error(data.message||data.code||'No fue posible completar el análisis pedagógico');
      renderSelected(data);
      $('diagnosis').innerHTML=esc(data.diagnosis||'')+'<br><span class="muted"><b>Análisis del contexto:</b> elaborado a partir de datos observables; no constituye diagnóstico clínico.</span>';
      $('question').textContent=data.guiding_question||$('question').textContent;
      $('axes').innerHTML=(data.axes||[]).length?(data.axes||[]).map(a=>'<div class="gradeBlock"><b>'+esc(a.name)+'</b><br><span class="muted">'+esc(a.reason)+'</span><br><b>Acción concreta donde se trabaja:</b> '+esc(a.action_in_sequence)+'</div>').join(''):'<p class="muted">No se identificó un eje articulador necesario. No se agregan ejes por relleno.</p>';
      const diff=(data.differentiation||[]).map(d=>'<div class="gradeBlock"><b>'+esc(d.grade)+'.º grado</b><br>'+esc(d.guidance)+'</div>').join('');
      $('organization').innerHTML='<p>'+esc(data.organization_multigrade||'')+'</p>'+(data.context_application?'<div class="notice"><b>Aplicación del contexto:</b> '+esc(data.context_application)+'</div>':'')+(diff?'<h4>Diferenciación por grado</h4>'+diff:'');
      renderSessions(data);
      if(!(data.sessions||[]).length)$('sessionsPlan').innerHTML=baseSessions;
      const ev=(data.evaluation||[]).map(e=>{const row=vals.find(v=>v.pda_id===e.pda_id);return '<div class="gradeBlock"><b>'+esc(row?.grade||'')+'.º · '+esc(e.pda_id)+'</b><br><b>Criterio observable:</b> '+esc(e.criterion)+'<br><b>Evidencia:</b> '+esc(e.evidence)+'<br><b>Instrumento:</b> '+esc(e.instrument)+'</div>';}).join('');
      $('evaluation').innerHTML=renderProducts(data)+(ev?'<h4>Evaluación alineada a PDA</h4><p class="muted">Los criterios se derivan directamente de los PDA seleccionados.</p>'+ev:'')+'<h4>Orientación formativa complementaria</h4>'+baseEval;
      const ltgUse=(data.ltg_use||[]).map(x=>'<div class="notice"><b>Uso del LTG para '+esc(x.pda_id)+':</b> '+esc(x.usage)+(x.adaptation?'<br><b>Adaptación al grupo multigrado:</b> '+esc(x.adaptation):'')+'</div>').join('');
      $('ltgPlan').innerHTML=baseLtg+ltgUse;
      const corrections=(data.operational_corrections||[]).length?'<div class="notice"><b>Ajustes operativos realizados antes de entregar la secuencia</b><br>'+data.operational_corrections.map(x=>'• '+esc(x)).join('<br>')+'</div>':'';
      const curricular=(data.curricular_review_required||[]).length?'<div class="notice warn"><b>Decisiones curriculares que requieren revisión docente</b><br>'+data.curricular_review_required.map(x=>'• '+esc(x)).join('<br>')+'</div>':'';
      const warn=(data.warnings||[]).map(w=>'<div class="notice warn">'+esc(w)+'</div>').join('');
      const viability=data.viability?'<div class="notice"><b>Viabilidad pedagógica: '+esc(data.viability.level)+'</b><br>'+esc(data.viability.reason)+'</div>':'';
      $('warnings').innerHTML=viability+corrections+curricular+warn+baseWarnings;
    }catch(error){
      $('warnings').insertAdjacentHTML('afterbegin','<div class="notice warn"><b>No fue posible completar el análisis complementario.</b> Se conserva la versión base. '+esc(String(error))+'</div>');
    }finally{document.getElementById('planWait')?.remove();}
  }

  const buildPlanBase=buildPlan;
  buildPlan=async function(){buildPlanBase();await applyPlanSupport();};
  $('continue').onclick=buildPlan;
  $('rebuild').onclick=buildPlan;
  </script>`;
  return html.replace('</body>',extra+'</body>');
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/'){
    try{const html=await page();res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);}catch(e){res.writeHead(502);res.end(String(e));}return;
  }
  if(req.method==='GET'&&req.url==='/health'){json(res,200,{ok:true,version:'0.8.4c',retrieval:'SEMANTIC-PDA-LAB-V2',planSupport:'PLAN-SEQUENCE-MULTIGRADE-V3-LTG'});return;}
  if(req.method==='POST'&&req.url==='/api/retrieve'){
    let raw='';req.on('data',c=>{raw+=c;if(raw.length>30000)req.destroy();});
    req.on('end',async()=>{try{const body=JSON.parse(raw||'{}');const r=await fetch(GEMINI_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grados:body.grados,contexto:body.contexto,situacion_problema:body.situacion_problema,intereses:body.intereses||[],sesiones:body.sesiones||5,minutos:body.minutos||90})});const data=await r.json();json(res,r.status,data);}catch(e){json(res,500,{code:'RETRIEVAL_PROXY_ERROR',message:String(e)});}});return;
  }
  if(req.method==='POST'&&req.url==='/api/gemini-plan'){
    let raw='';req.on('data',c=>{raw+=c;if(raw.length>80000)req.destroy();});
    req.on('end',async()=>{try{const body=JSON.parse(raw||'{}');const r=await fetch(PLAN_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();json(res,r.status,data);}catch(e){json(res,500,{code:'PLAN_PROXY_ERROR',message:String(e)});}});return;
  }
  json(res,404,{code:'NOT_FOUND'});
});
server.listen(PORT,'0.0.0.0',()=>console.log('V0.8.4c multigrade planning lab listening on '+PORT));