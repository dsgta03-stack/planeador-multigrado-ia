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

html = html.replace(
  '<div class="full"><label>Grados</label><div class="grades" id="grades"></div></div>',
  '<div class="full"><label>Grados</label><div class="grades" id="grades"></div></div><div class="full"><label>Número de estudiantes por grado</label><div id="studentCounts" class="grades" style="align-items:flex-end"></div><div class="muted" style="margin-top:6px">Captura únicamente los grados seleccionados. Este dato se usará para organizar bloques, atención docente y evaluación formativa.</div></div>'
);

const patch = String.raw`
<script>
state.showLow={};
state.students=state.students||{};

function renderStudentCounts(){
  const box=$('studentCounts'); if(!box)return;
  box.innerHTML=state.grades.map(g=>'<label style="min-width:120px">'+g+'.º grado<input class="student-count" data-g="'+g+'" type="number" min="1" max="60" placeholder="Alumnos" value="'+esc(state.students[g]||'')+'"></label>').join('');
  box.querySelectorAll('.student-count').forEach(i=>i.oninput=()=>{const g=+i.dataset.g;const n=Math.max(0,Number(i.value)||0);state.students[g]=n||'';});
}

const originalDrawGradesV3=drawGrades;
drawGrades=function(){originalDrawGradesV3();renderStudentCounts();};
renderStudentCounts();

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

function evaluationForBlock(grades, vals){
  const min=Math.min(...grades);
  const total=grades.reduce((s,g)=>s+(Number(state.students[g])||0),0);
  const rows=grades.flatMap(g=>vals.filter(v=>v.grade===g));
  const pdaList=rows.length?rows.map(v=>'<div style="margin-top:6px"><b>'+v.grade+'.º · '+esc(v.pda_id)+'</b>: '+esc(v.pda_official)+'</div>').join(''):'<div class="muted">Sin PDA seleccionado en este bloque; no se fija criterio curricular hasta que el docente seleccione uno.</div>';
  let instrument='',how='',emerging='';
  if(min<=2){
    instrument='Registro anecdótico + guía de observación + revisión de productos o evidencias.';
    how='Observar participación oral, clasificación, dibujo, manipulación, explicación con sus propias palabras y uso de apoyos. Registrar avances breves por estudiante y revisar la evidencia producida durante la actividad.';
    emerging='No penalizar lectura o escritura no convencional. Aceptar respuestas orales, señalamiento, dibujo, dictado al docente, selección de imágenes o uso de material manipulable cuando permitan evidenciar el aprendizaje.';
  }else if(min<=4){
    instrument='Lista de cotejo breve + revisión de producto + notas de observación.';
    how='Usar indicadores derivados de la acción del PDA: comprensión de la situación, uso de información o evidencias, explicación del proceso y elaboración del producto. Complementar con una nota breve cuando el desempeño requiera contexto.';
    emerging='Valorar el avance respecto al PDA y la calidad de la evidencia, no la extensión del texto ni la ortografía como criterio principal cuando esos aspectos no formen parte del aprendizaje evaluado.';
  }else{
    instrument='Lista de cotejo por PDA + revisión de evidencias/producto + autoevaluación breve.';
    how='Verificar si el alumnado analiza información, fundamenta sus explicaciones, usa evidencias del contexto, comunica resultados y plantea acciones o conclusiones congruentes con el PDA. Cerrar con una autoevaluación breve sobre qué comprendió, qué evidencia utilizó y qué necesita mejorar.';
    emerging='No convertir la forma de escritura en el centro de la calificación cuando el PDA evalúa otra capacidad. Permitir apoyos de organización, borradores y revisión entre pares; valorar principalmente el aprendizaje curricular demostrado.';
  }
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
  sessions.forEach((el,i)=>{
    let use='Usar ejemplos, recursos, prácticas y situaciones observables en el contexto descrito para desarrollar el aprendizaje.';
    if(i===0) use='Identificar en el contexto escolar y comunitario evidencias concretas de la problemática y recuperar lo que el alumnado ya observa o vive.';
    else if(i===sessions.length-1) use='Cerrar con propuestas, productos o acciones que sean viables para el contexto escolar y comunitario descrito.';
    el.insertAdjacentHTML('beforeend','<div class="muted" style="margin-top:7px"><b>Aplicación al contexto:</b> '+esc(use)+' <span style="display:block;margin-top:3px">Contexto de referencia: '+esc(context)+'</span></div>');
  });

  const evalBlocks=[[1,2],[3,4],[5,6]].map(pair=>pair.filter(g=>state.grades.includes(g))).filter(x=>x.length);
  $('evaluation').innerHTML='<p class="muted">Los instrumentos siguientes son propuestas del motor para evaluación formativa; los PDA y sus textos permanecen oficiales y sin modificaciones.</p>'+evalBlocks.map(b=>evaluationForBlock(b,vals)).join('');
};
$('continue').onclick=buildPlan;
$('rebuild').onclick=buildPlan;

const originalSearch=$('search').onclick;
$('search').onclick=async()=>{
  state.showLow={};
  const missingStudents=state.grades.filter(g=>(Number(state.students[g])||0)<1);
  if(missingStudents.length){showErr('Captura el número de estudiantes de '+missingStudents.map(g=>g+'.º').join(', ')+'.');return;}
  return originalSearch();
};
</script>`;
html=html.replace('</body>',patch+'\n</body>');

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;}
  if(req.method==="GET"&&req.url==="/health"){json(res,200,{ok:true,version:"0.8.4",retrieval:"V3-PROBLEM-FIRST",studentsByGrade:true,formativeEvaluation:true});return;}
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