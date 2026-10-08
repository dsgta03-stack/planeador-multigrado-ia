export function renderTeacherActivity(block){
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const arr=v=>Array.isArray(v)?v:[];
 const field=(label,value)=>value?'<p><b>'+esc(label)+':</b> '+esc(value)+'</p>':'';
 const list=(label,values)=>arr(values).length?'<div><b>'+esc(label)+':</b><ul>'+values.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul></div>':'';
 const e=block.execution;
 let body='';
 if(e){
  body=field('Desarrollo',block.development);
  let procedure=field('Preparación',e.preparation)+field('Consigna',e.instruction)+field('Organización',e.grouping);
  procedure+='<ol>'+arr(e.student_steps).map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol>'+field('Acción docente',block.teacher_role)+list('Preguntas y modelado',e.guidance);
  body+=arr(block.grade_participation).map(g=>'<section class="mpTeacherGrade"><b>'+esc(g.grade)+'.º grado</b>'+field('Acción',g.student_action)+field('Diferenciación',g.differentiation)+field('Evidencia por grado',g.evidence)+'</section>').join('');
  procedure+=list('Materiales y uso',arr(e.resource_use).map(r=>r.resource+': '+r.use))+list('Apoyos autorizados',block.supports)+field('Si no avanza',e.contingency);
  body+=field('Producto',block.output)+field('Evidencia',block.evidence)+list('Criterios',block.assessment_criteria);
  body+='<details class="mpTeacherProcedure" open><summary>Preparación, acompañamiento y recursos</summary>'+procedure+'</details>';
  body+=arr(block.ltg_use).map(u=>{const r=u.reference||{},pages=r.pages?String(r.pages.start)+'–'+String(r.pages.end):'';return '<section class="mpTeacherLTG"><b>Uso LTG</b>'+field('Libro/proyecto',[r.book,r.project].filter(Boolean).join(' · '))+field('Grado',r.grade)+field('Páginas verificadas',pages)+field('Actividad verificada',r.verified_activity?.summary)+field('Acción del alumnado',u.student_action)+field('Momento',u.moment)+field('Aporte al PDA/proyecto',u.purpose)+'</section>';}).join('');
  body+=field('Cierre/conexión',e.connection);
 }else{
  body=field('Desarrollo',block.narrative)+field('Acción docente',block.teacher_role)+list('Materiales',block.resources)+list('Apoyos',block.supports)+field('Evidencia',block.evidence)+list('Criterios',block.assessment_criteria);
 }
 return '<div class="mpTeacherBlock"><h5>'+esc(block.label||'Actividad')+(arr(block.grades).length?' · '+esc(block.grades.map(g=>g+'.º').join(', ')):'')+(block.minutes?' · '+esc(block.minutes)+' min':'')+'</h5>'+body+'</div>';
}
export function renderTeacherSessions(presentation){
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 return presentation.sessions.map(s=>'<div class="mpTeacherSession">'+(s.phase?'<span class="mpTeacherPhase">'+esc(s.phase)+'</span>':'')+'<h4>Sesión '+esc(s.session_number)+'</h4>'+(s.purpose?'<p><b>Propósito:</b> '+esc(s.purpose)+'</p>':'')+((s.activity_blocks||[]).some(b=>b.execution)?'':(s.teacher_narrative?'<p class="mpTeacherNarrative">'+esc(s.teacher_narrative)+'</p>':''))+(s.activity_blocks||[]).map(renderTeacherActivity).join('')+(s.ltg_decisions||[]).map(d=>'<p class="mpTeacherLTG"><b>Decisión LTG '+esc(d.project_id)+' · '+esc(d.decision)+':</b> '+esc(d.reason)+'</p>').join('')+(s.closure_narrative&&s.closure_narrative!==(s.activity_blocks||[]).at(-1)?.execution?.connection?'<p class="mpTeacherNarrative"><b>Cierre:</b> '+esc(s.closure_narrative)+'</p>':'')+'</div>').join('');
}

export const TEACHER_PRESENTATION_UI=String.raw`
<style id="mp-teacher-style">
#mpTeacherVoiceNote{margin:10px 0;padding:10px 12px;border-radius:10px;background:#f0faf7;border:1px solid #cfe7df;color:#235a4a;font-size:13px;line-height:1.45}.mpTeacherSession{padding:15px 0;border-bottom:1px solid #dfe7f1}.mpTeacherSession:last-child{border-bottom:0}.mpTeacherSession h4{margin:0 0 8px;font-size:17px}.mpTeacherNarrative{line-height:1.62;color:#20354d}.mpTeacherBlock{margin:9px 0;padding:11px 13px;border-left:3px solid #19a990;background:#f7fbfa;border-radius:8px;line-height:1.55}.mpTeacherBlock h5{margin:0 0 8px;font-size:15px}.mpTeacherBlock p{margin:7px 0}.mpTeacherGrade,.mpTeacherLTG{padding:8px 10px;margin:8px 0;border:1px solid #dfe7f1;border-radius:8px}.mpTeacherBlock ol,.mpTeacherBlock ul{padding-left:22px}.mpTeacherPhase{display:inline-block;margin-bottom:8px;padding:5px 8px;border-radius:8px;background:#eaf4ff;color:#145eaa;font-size:12px;font-weight:850}#mpTechnicalTrace{margin-top:18px;border:1px solid #dfe7f1;border-radius:11px;padding:10px 12px;background:#fafcfe}#mpTechnicalTrace summary{cursor:pointer;font-weight:800;color:#536b82}
</style>
<script id="mp-teacher-script">
(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const renderTeacherActivity=${renderTeacherActivity.toString()};
const renderTeacherSessions=${renderTeacherSessions.toString()};
function renderTeacher(data){
 const p=data?.teacher_presentation;if(!p||!Array.isArray(p.sessions)||!p.sessions.length)return;
 const plan=document.getElementById('plan');const seq=document.getElementById('sessionsPlan');if(!plan||!seq)return;
 let header=document.getElementById('mpPlanMethodHeader');if(!header){header=document.createElement('div');header.id='mpPlanMethodHeader';header.className='mpPlanMethodHeader';plan.insertBefore(header,plan.firstChild)}
 const existingMeta=header.querySelector('.meta')?.outerHTML||'';const phaseLine=header.querySelector('.mpMethodPhases')?.outerHTML||'';
 header.innerHTML='<div class="muted">Proyecto generado por Multiplan</div><h2>'+esc(p.project_title||'Proyecto')+'</h2>'+existingMeta+'<div id="mpTeacherVoiceNote"><b>Guía docente:</b> procedimiento, diferenciación, evidencias y referencias aprobadas. Los PDA y referencias curriculares oficiales no se reescriben.</div>'+phaseLine;
 let detail=document.getElementById('mpTechnicalTrace');if(!detail){detail=document.createElement('details');detail.id='mpTechnicalTrace';seq.insertAdjacentElement('afterend',detail)}detail.innerHTML='<summary>Ver detalle técnico y trazabilidad original</summary><pre>'+esc(JSON.stringify({sessions:data.sessions,traceability:data.traceability,source_trace:data.source_trace},null,2))+'</pre>';
 seq.innerHTML=renderTeacherSessions(p);
 setTimeout(()=>header.scrollIntoView({behavior:'smooth',block:'start'}),80);
}
window.mpRenderTeacherPlan=renderTeacher;
function wrap(){const prior=window.fetch.bind(window);window.fetch=async function(input,init={}){const url=typeof input==='string'?input:(input?.url||'');const r=await prior(input,init);if(url.includes('/api/gemini-plan')){const c=r.clone();c.json().then(d=>{if(r.ok&&d.teacher_presentation)setTimeout(()=>renderTeacher(d),220)}).catch(()=>{})}return r}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wrap);else wrap();
})();
</script>`;
