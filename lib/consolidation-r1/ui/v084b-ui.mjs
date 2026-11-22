export const V084B_PATCH = String.raw`
<script>
state.showOther={};
state.students=state.students||{};

function renderStudentCounts(){
  const box=$('studentCounts'); if(!box)return;
  box.innerHTML=state.grades.map(g=>'<label style="min-width:120px">'+g+'.º grado<input class="student-count" data-g="'+g+'" type="number" min="1" max="60" placeholder="Alumnos" value="'+esc(state.students[g]||'')+'"></label>').join('');
  box.querySelectorAll('.student-count').forEach(i=>i.oninput=()=>{const g=+i.dataset.g;const n=Math.max(0,Number(i.value)||0);state.students[g]=n||'';});
}
const originalDrawGradesB=drawGrades;
drawGrades=function(){originalDrawGradesB();renderStudentCounts();};
renderStudentCounts();

function absRel(r){
  const pct=Math.max(0,Math.min(100,Math.round(Number(r.absolute_relevance||0))));
  const label=String(r.relevance_label|| (pct>=80?'Alta':pct>=70?'Media':pct>=60?'Débil':'No recomendado'));
  const status=String(r.recommendation_status||'REVISAR');
  return {pct,label,status};
}
function mainRows(g){
  const all=state.data?.candidatesByGrade?.[g]||[];
  return all.filter(r=>r.recommendation_status==='RECOMENDADO' || !!state.selected[r.pda_id] || state.showOther[g]);
}

// Conserva el componente LTG dentro de cada tarjeta PDA y su decisión opcional.
drawList=function(){
  const all=state.data?.candidatesByGrade?.[state.active]||[];
  const recommended=all.filter(r=>r.recommendation_status==='RECOMENDADO');
  const others=all.filter(r=>r.recommendation_status!=='RECOMENDADO' && !state.selected[r.pda_id]);
  const rows=mainRows(state.active);
  let lead='';
  if(!recommended.length){
    lead='<div class="notice warn"><b>No se encontró un PDA con vinculación directa suficiente para este grado.</b><br>Esto no obliga a seleccionar uno. Puedes revisar opciones relacionadas y decidir pedagógicamente si alguna resulta útil.</div>';
  }
  let body=rows.length?rows.map(r=>{
    const sel=!!state.selected[r.pda_id],rel=absRel(r);
    const chipClass=rel.pct>=80?'good':rel.pct>=70?'mid':'';
    let projects='';
    if(sel&&r.linked_projects?.length){
      const choice=state.projects[r.pda_id];
      projects='<div class="project"><strong>LTG opcional y realmente vinculado</strong>'+r.linked_projects.map(p=>'<label style="display:block;margin-top:7px;font-weight:500"><input type="radio" name="ltg-'+esc(r.pda_id)+'" data-pda="'+esc(r.pda_id)+'" data-project="'+esc(p.project_id)+'" '+(choice?.project_id===p.project_id?'checked':'')+'> '+esc(p.name)+' · '+esc(p.book)+'</label>').join('')+'<button class="'+(choice?.mode==='none'?'primary':'secondary')+' clear-project" data-pda="'+esc(r.pda_id)+'" style="margin-top:8px;padding:6px 9px">No usar LTG</button></div>';
    }
    const statusText=rel.status==='RECOMENDADO'?'Recomendado':rel.status==='REVISAR'?'Revisar relación':'Sin vinculación directa suficiente';
    return '<article class="candidate '+(sel?'sel':'')+'"><div class="head"><div><span class="id">'+esc(r.pda_id)+'</span><h3>'+esc(r.content_official)+'</h3></div><button class="'+(sel?'secondary':'primary')+'" data-id="'+esc(r.pda_id)+'">'+(sel?'Retirar':'Seleccionar')+'</button></div><p>'+esc(r.pda_official)+'</p><div class="meta"><span class="chip">'+esc(r.field)+'</span><span class="chip">'+esc(r.evidence_basis||'')+'</span><span class="chip '+chipClass+'">Pertinencia '+rel.pct+'% · '+esc(rel.label)+'</span><span class="chip">'+esc(statusText)+'</span></div>'+projects+'</article>';
  }).join(''):'<div class="notice">No hay candidatos para mostrar en este grado.</div>';
  if(others.length){body+='<div class="actions" style="justify-content:flex-start"><button class="secondary" id="toggleOther">'+(state.showOther[state.active]?'Ocultar otros PDA relacionados':'Ver otros PDA relacionados ('+others.length+')')+'</button></div>';}
  $('list').innerHTML=lead+body;

  $('list').querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.id,row=all.find(r=>r.pda_id===id);
    if(state.selected[id]){delete state.selected[id];delete state.projects[id]}
    else{if(count(row.grade)>=4){showErr('Máximo 4 PDA seleccionados manualmente para '+row.grade+'.º');return}state.selected[id]=row;}
    showErr('');drawTabs();drawList();drawSummary();
  });
  $('list').querySelectorAll('input[data-project]').forEach(i=>i.onchange=()=>{
    const pda=i.dataset.pda,projectId=i.dataset.project,row=state.selected[pda],project=row?.linked_projects?.find(p=>p.project_id===projectId);
    if(project)state.projects[pda]={...project,mode:'project'};
  });
  $('list').querySelectorAll('.clear-project').forEach(b=>b.onclick=()=>{state.projects[b.dataset.pda]={mode:'none'};drawList();});
  const toggle=$('toggleOther'); if(toggle)toggle.onclick=()=>{state.showOther[state.active]=!state.showOther[state.active];drawList();};
};

function evaluationForBlock(grades, vals){
  const min=Math.min(...grades);
  const total=grades.reduce((s,g)=>s+(Number(state.students[g])||0),0);
  const rows=grades.flatMap(g=>vals.filter(v=>v.grade===g));
  const pdaList=rows.length?rows.map(v=>'<div style="margin-top:6px"><b>'+v.grade+'.º · '+esc(v.pda_id)+'</b>: '+esc(v.pda_official)+'</div>').join(''):'<div class="muted">Sin PDA seleccionado en este bloque; no se fija criterio curricular hasta que el docente seleccione uno.</div>';
  let instrument='',how='',emerging='';
  if(min<=2){instrument='Registro anecdótico + guía de observación + revisión de productos o evidencias.';how='Observar participación oral, clasificación, dibujo, manipulación, explicación con sus propias palabras y uso de apoyos. Registrar avances breves por estudiante y revisar la evidencia producida durante la actividad.';emerging='No penalizar lectura o escritura no convencional. Aceptar respuestas orales, señalamiento, dibujo, dictado al docente, selección de imágenes o material manipulable cuando permitan evidenciar el aprendizaje.';}
  else if(min<=4){instrument='Lista de cotejo breve + revisión de producto + notas de observación.';how='Usar indicadores derivados de la acción del PDA: comprensión de la situación, uso de información o evidencias, explicación del proceso y elaboración del producto. Complementar con una nota breve cuando el desempeño requiera contexto.';emerging='Valorar el avance respecto al PDA y la calidad de la evidencia, no la extensión del texto ni la ortografía como criterio principal cuando esos aspectos no formen parte del aprendizaje evaluado.';}
  else{instrument='Lista de cotejo por PDA + revisión de evidencias/producto + autoevaluación breve.';how='Verificar si el alumnado analiza información, fundamenta sus explicaciones, usa evidencias del contexto, comunica resultados y plantea acciones o conclusiones congruentes con el PDA. Cerrar con una autoevaluación breve.';emerging='No convertir la forma de escritura en el centro de la calificación cuando el PDA evalúa otra capacidad. Permitir apoyos de organización, borradores y revisión entre pares; valorar principalmente el aprendizaje curricular demostrado.';}
  return '<div class="gradeBlock"><strong>Bloque '+grades.map(g=>g+'.º').join('–')+' · '+total+' estudiante'+(total===1?'':'s')+'</strong><p><b>Instrumento sugerido por el motor:</b> '+instrument+'</p><p><b>Cómo se evaluará:</b> '+how+'</p><p><b>Criterios curriculares de referencia:</b></p>'+pdaList+'<p class="muted"><b>Evaluación formativa e inclusiva:</b> '+emerging+'</p></div>';
}

const originalBuildPlan=buildPlan;
buildPlan=function(){
  originalBuildPlan();
  const context=$('context').value.trim();
  const vals=Object.values(state.selected).sort((a,b)=>a.grade-b.grade);
  const totalStudents=state.grades.reduce((s,g)=>s+(Number(state.students[g])||0),0);
  const distribution=state.grades.map(g=>g+'.º: '+(Number(state.students[g])||0)).join(', ');
  $('diagnosis').insertAdjacentHTML('beforeend','<br><br><b>Matrícula considerada:</b> '+esc(distribution)+' · <b>Total:</b> '+totalStudents+' estudiantes. El tamaño de cada grado se considera para distribuir atención directa, trabajo autónomo y seguimiento formativo.');
  const sessions=[...$('sessionsPlan').querySelectorAll('.session')];
  sessions.forEach((el,i)=>{let use='Usar ejemplos, recursos, prácticas y situaciones observables en el contexto descrito para desarrollar el aprendizaje.';if(i===0)use='Identificar en el contexto escolar y comunitario evidencias concretas de la problemática y recuperar lo que el alumnado ya observa o vive.';else if(i===sessions.length-1)use='Cerrar con propuestas, productos o acciones viables para el contexto escolar y comunitario descrito.';el.insertAdjacentHTML('beforeend','<div class="muted" style="margin-top:7px"><b>Aplicación al contexto:</b> '+esc(use)+' <span style="display:block;margin-top:3px">Contexto de referencia: '+esc(context)+'</span></div>');});
  const evalBlocks=[[1,2],[3,4],[5,6]].map(pair=>pair.filter(g=>state.grades.includes(g))).filter(x=>x.length);
  $('evaluation').innerHTML='<p class="muted">Los instrumentos siguientes son propuestas del motor para evaluación formativa; los PDA y sus textos permanecen oficiales y sin modificaciones.</p>'+evalBlocks.map(b=>evaluationForBlock(b,vals)).join('');
};
$('continue').onclick=buildPlan;
$('rebuild').onclick=buildPlan;

const originalSearch=$('search').onclick;
$('search').onclick=async()=>{
  state.showOther={};
  const missingStudents=state.grades.filter(g=>(Number(state.students[g])||0)<1);
  if(missingStudents.length){showErr('Captura el número de estudiantes de '+missingStudents.map(g=>g+'.º').join(', ')+'.');return;}
  return originalSearch();
};
</script>`;

export function applyV084bUi(input){
 let html=String(input);
 html=html.replace('Demo V0.8.4 · base V0.8.3','Demo V0.8.4b · pertinencia absoluta experimental');
 html=html.replace('La pertinencia es relativa dentro de cada grado. Máximo 4 PDA por grado. Puedes continuar aunque algún grado quede sin PDA seleccionado.','La problemática es la puerta principal. El porcentaje expresa pertinencia absoluta estimada, no posición relativa. Los PDA sin vinculación suficiente quedan fuera de la vista principal, pero puedes revisar opciones relacionadas. La selección final sigue siendo del docente.');
 html=html.replace('<div class="full"><label>Grados</label><div class="grades" id="grades"></div></div>','<div class="full"><label>Grados</label><div class="grades" id="grades"></div></div><div class="full"><label>Número de estudiantes por grado</label><div id="studentCounts" class="grades" style="align-items:flex-end"></div><div class="muted" style="margin-top:6px">Captura únicamente los grados seleccionados. Este dato se usará para organizar bloques, atención docente y evaluación formativa.</div></div>');
 return html.replace('</body>',V084B_PATCH+'\n</body>');
}
