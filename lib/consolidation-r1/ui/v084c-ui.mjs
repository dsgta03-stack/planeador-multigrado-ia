export const V084C_PATCH = String.raw`<script>
  state.latestPlanData=null;
  state.materialSuggestions={};
  state.materialSuggestionSeq=0;

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

  function ensureMaterialsSection(){
    if(document.getElementById('materialsSection'))return;
    const evaluationSection=$('evaluation').closest('.section');
    const section=document.createElement('div');
    section.className='section'; section.id='materialsSection';
    section.innerHTML='<h3>Materiales imprimibles seleccionados</h3><p class="muted">La planeación propone materiales dentro de cada actividad. Usa el botón <b>Generar este imprimible</b> únicamente cuando quieras prepararlo. El resultado aparecerá aquí.</p><div id="materialStatus"></div><div id="materialOutput"><p class="muted">Todavía no has generado ningún material.</p></div>';
    evaluationSection.insertAdjacentElement('afterend',section);
  }

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

  function registerPrintable(suggestion,ctx){
    const id='ms'+(++state.materialSuggestionSeq);
    state.materialSuggestions[id]={suggestion,ctx};
    return id;
  }

  function renderMaterialSupport(ms,ctx){
    if(!ms)return '';
    const available=(ms.available_resources||[]).length?'<div style="margin-top:8px"><b>Material que ya podemos utilizar:</b> '+esc(ms.available_resources.join(', '))+'</div>':'';
    const prepare=(ms.to_prepare_or_find||[]).length?'<div style="margin-top:8px"><b>Material que conviene conseguir o preparar:</b>'+ms.to_prepare_or_find.map(x=>'<div class="muted" style="margin:5px 0 0 12px">• <b>'+esc(x.item)+'</b>: '+esc(x.purpose)+(x.alternative?'<br><span style="margin-left:10px"><b>Alternativa:</b> '+esc(x.alternative)+'</span>':'')+'</div>').join('')+'</div>':'';
    const printables=(ms.printable_suggestions||[]).length?'<div style="margin-top:10px"><b>Material imprimible sugerido:</b>'+ms.printable_suggestions.map(p=>{const id=registerPrintable(p,ctx);return '<div class="notice" style="margin-top:7px"><b>'+esc(p.title)+'</b> <span class="muted">('+esc(String(p.format||'material').replaceAll('_',' '))+')</span><br>'+esc(p.description)+'<br><b>Uso:</b> '+esc(p.use)+'<br><b>Para:</b> '+esc((p.grades||[]).map(g=>g+'.º').join(', '))+' · <b>PDA:</b> '+esc((p.pda_ids||[]).join(', '))+(p.optional?'<br><span class="muted">Opcional: puede realizarse sin imprimir si se utiliza una alternativa disponible.</span>':'')+'<div class="actions" style="justify-content:flex-start;margin-top:7px"><button class="secondary" onclick="generateSuggestedMaterial(\''+id+'\')">Generar este imprimible</button></div></div>'}).join('')+'</div>':'';
    return available+prepare+printables;
  }

  function renderSessions(data){
    const sessions=data.sessions||[];
    if(!sessions.length)return;
    state.materialSuggestions={};state.materialSuggestionSeq=0;
    $('sessionsPlan').innerHTML=sessions.map(s=>{
      const moments=(s.work_moments||[]).map(m=>{
        const directCtx={session:s.session_number,moment:m.moment,block:m.direct_teacher_block,activity:m.direct_teacher_action};
        const directMaterials=renderMaterialSupport(m.direct_material_support,directCtx);
        const others=(m.other_blocks||[]).map(b=>{const ctx={session:s.session_number,moment:m.moment,block:b.block,grades:b.grades,activity:b.activity,pda_ids:b.pda_ids};return '<div class="gradeBlock" style="margin:8px 0"><b>'+esc(b.block)+'</b> · '+esc((b.grades||[]).map(g=>g+'.º').join(', '))+'<br><b>Actividad:</b> '+esc(b.activity)+(b.teacher_tone_guidance?'<br><b>Orientación para conducirla:</b> '+esc(b.teacher_tone_guidance):'')+'<br><b>PDA vinculados:</b> '+esc((b.pda_ids||[]).join(', ')||'Sin PDA asignado a este tramo')+'<br><b>Apoyo para autonomía:</b> '+esc(b.autonomy_support)+renderMaterialSupport(b.material_support,ctx)+'<br><b>Evidencia:</b> '+esc(b.evidence)+'<br><b>Seguimiento:</b> '+esc(b.assessment)+'</div>';}).join('');
        return '<div class="gradeBlock"><b>Momento '+esc(m.moment)+' · '+esc(m.minutes)+' min</b><br><b>Atención directa:</b> '+esc(m.direct_teacher_block)+'<br><b>Trabajo acompañado:</b> '+esc(m.direct_teacher_action)+directMaterials+(others?'<div style="margin-top:8px"><b>Mientras tanto, los demás bloques:</b>'+others+'</div>':'')+'</div>';
      }).join('');
      return '<div class="session"><strong>Sesión '+esc(s.session_number)+' · '+esc(s.total_minutes)+' min</strong><br><b>Propósito:</b> '+esc(s.purpose)+'<br><b>PDA de la sesión:</b> '+esc((s.pda_ids||[]).join(', '))+(s.continuity_from_previous?'<br><b>Continuidad:</b> '+esc(s.continuity_from_previous):'')+'<div class="gradeBlock" style="margin-top:10px"><b>Apertura común · '+esc(s.opening_minutes)+' min</b><br>'+esc(s.common_opening)+'</div>'+moments+'<div class="gradeBlock"><b>Cierre común · '+esc(s.closure_minutes)+' min</b><br>'+esc(s.common_closure)+'</div>'+(s.prepares_next?'<div class="muted"><b>Enlace con la siguiente sesión:</b> '+esc(s.prepares_next)+'</div>':'')+'</div>';
    }).join('');
  }

  function renderProducts(data){
    const products=data.products||[];
    if(!products.length)return '';
    return '<h4>Productos y evidencias por grado</h4>'+products.map(p=>'<div class="gradeBlock"><b>'+esc(p.grade)+'.º grado</b><br><b>Productos parciales:</b> '+esc((p.partial_products||[]).join(' · ')||'No requiere productos parciales')+'<br><b>Evidencia final:</b> '+esc(p.final_evidence)+'</div>').join('');
  }

  function materialTypeLabel(type){return ({worksheet:'Hoja de trabajo',manipulative:'Material manipulable',teacher_guide:'Guía breve para el docente',assessment:'Instrumento de evaluación'})[type]||'Material';}
  function typeFromFormat(format){if(['imagenes','tarjetas','recortable','etiquetas'].includes(format))return 'manipulative';if(format==='lista_de_cotejo')return 'assessment';return 'worksheet';}

  function renderMaterial(data){
    const sections=(data.sections||[]).map(s=>'<div class="gradeBlock"><b>'+esc(s.heading)+'</b><div style="white-space:pre-wrap;margin-top:6px">'+esc(s.content)+'</div>'+(s.response_space_hint?'<div class="muted" style="margin-top:6px"><b>Espacio sugerido:</b> '+esc(s.response_space_hint)+'</div>':'')+'</div>').join('');
    const prep=(data.preparation||[]).length?'<p><b>Preparación:</b><br>'+data.preparation.map(x=>'• '+esc(x)).join('<br>')+'</p>':'';
    const teacher=(data.teacher_notes||[]).length?'<p><b>Orientaciones para desarrollarlo:</b><br>'+data.teacher_notes.map(x=>'• '+esc(x)).join('<br>')+'</p>':'';
    const diff=(data.differentiation_notes||[]).length?'<p><b>Ajustes y diferenciación:</b><br>'+data.differentiation_notes.map(x=>'• '+esc(x)).join('<br>')+'</p>':'';
    $('materialOutput').innerHTML='<div class="summary"><div class="muted">'+esc(materialTypeLabel(data.material_type))+'</div><h3 style="margin:5px 0">'+esc(data.title)+'</h3><p><b>Propósito:</b> '+esc(data.purpose)+'</p><p><b>Dirigido a:</b> '+esc(data.applies_to)+'</p>'+prep+(data.student_instructions?'<div class="notice"><b>Consigna:</b> '+esc(data.student_instructions)+'</div>':'')+sections+teacher+diff+'<p><b>Recursos:</b> '+esc((data.resources||[]).join(', '))+'</p><p><b>Evidencia observable:</b> '+esc(data.observable_evidence)+'</p>'+(data.answer_or_reference?'<p><b>Referencia para revisión:</b> '+esc(data.answer_or_reference)+'</p>':'')+(data.printing_notes?'<p class="muted"><b>Preparación/impresión:</b> '+esc(data.printing_notes)+'</p>':'')+'<div class="actions"><button class="secondary" id="printMaterial">Imprimir este material</button></div></div>';
    document.getElementById('printMaterial').onclick=()=>window.print();
    document.getElementById('materialsSection')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function generateSuggestedMaterial(id){
    const item=state.materialSuggestions[id];
    const vals=Object.values(state.selected).sort((a,b)=>a.grade-b.grade);
    if(!item||!vals.length||!state.latestPlanData)return;
    ensureMaterialsSection();
    const p=item.suggestion,ctx=item.ctx||{};
    const type=typeFromFormat(p.format);
    $('materialStatus').innerHTML='<div class="notice">Preparando: <b>'+esc(p.title)+'</b>...</div>';
    $('materialOutput').innerHTML='';
    const requestedIds=(p.pda_ids||[]).filter(id=>vals.some(v=>v.pda_id===id));
    const requestedGrades=(p.grades||[]).filter(g=>vals.some(v=>v.grade===g));
    const payload={type,pda_ids:requestedIds.length?requestedIds:vals.map(v=>v.pda_id),grades:requestedGrades.length?requestedGrades:[...new Set(vals.map(v=>v.grade))],problem:$('problem').value.trim(),context:$('context').value.trim(),reading:$('reading').value,writing:$('writing').value,autonomy:$('autonomy').value,connectivity:$('connectivity').value,resources:$('resources').value.trim(),supports:$('supports').value.trim()||'No especificados',session_context:JSON.stringify(ctx).slice(0,8000),requested_suggestion:p};
    try{
      const r=await fetch('/api/material',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data=await r.json();
      if(!r.ok)throw new Error(data.message||data.code||'No fue posible generar el material');
      $('materialStatus').innerHTML='';renderMaterial(data);
    }catch(error){$('materialStatus').innerHTML='<div class="notice warn">No fue posible generar el material. '+esc(String(error))+'</div>';}
  }
  window.generateSuggestedMaterial=generateSuggestedMaterial;

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
    const payload={pda_ids:vals.map(v=>v.pda_id),grados:state.grades,alumnos_por_grado:state.students||{},contexto:$('context').value.trim(),situacion_problema:$('problem').value.trim(),lectura:$('reading').value,escritura:$('writing').value,autonomia:$('autonomy').value,conectividad:$('connectivity').value,sesiones:Math.max(1,+$('sessions').value||5),minutos:Math.max(15,+$('minutes').value||90),recursos:$('resources').value.trim(),apoyos:$('supports').value.trim()||'No especificados',ltg};
    try{
      const r=await fetch('/api/gemini-plan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const data=await r.json();
      if(!r.ok)throw new Error(data.message||data.code||'No fue posible completar el análisis pedagógico');
      state.latestPlanData=data;
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
      ensureMaterialsSection();
    }catch(error){
      $('warnings').insertAdjacentHTML('afterbegin','<div class="notice warn"><b>No fue posible completar el análisis complementario.</b> Se conserva la versión base. '+esc(String(error))+'</div>');
    }finally{document.getElementById('planWait')?.remove();}
  }

  const buildPlanBase=buildPlan;
  buildPlan=async function(){buildPlanBase();await applyPlanSupport();};
  $('continue').onclick=buildPlan;
  $('rebuild').onclick=buildPlan;
  </script>`;

export function applyV084cUi(input){
 let html=String(input);
 html=html.replaceAll('Demo V0.8.4b · pertinencia absoluta experimental','Demo V0.8.4c · planeación multigrado contextual');
 html=html.replace('La problemática es la puerta principal. El porcentaje expresa pertinencia absoluta estimada, no posición relativa. Los PDA sin vinculación suficiente quedan fuera de la vista principal, pero puedes revisar opciones relacionadas. La selección final sigue siendo del docente.','La problemática y el contexto orientan la selección de candidatos oficiales. Después de tu selección, el sistema integra justificación, secuencia multigrado, diferenciación, evaluación, materiales y viabilidad sin modificar los textos oficiales ni tus decisiones curriculares.');
 return html.replace('</body>',V084C_PATCH+'</body>');
}
