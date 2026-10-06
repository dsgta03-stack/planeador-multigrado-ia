export const TEACHER_PRESENTATION_UI=String.raw`
<style id="mp-teacher-style">
#mpTeacherVoiceNote{margin:10px 0;padding:10px 12px;border-radius:10px;background:#f0faf7;border:1px solid #cfe7df;color:#235a4a;font-size:13px;line-height:1.45}.mpTeacherSession{padding:15px 0;border-bottom:1px solid #dfe7f1}.mpTeacherSession:last-child{border-bottom:0}.mpTeacherSession h4{margin:0 0 8px;font-size:17px}.mpTeacherNarrative{line-height:1.62;color:#20354d}.mpTeacherBlock{margin:9px 0;padding:11px 13px;border-left:3px solid #19a990;background:#f7fbfa;border-radius:8px;line-height:1.55}.mpTeacherPhase{display:inline-block;margin-bottom:8px;padding:5px 8px;border-radius:8px;background:#eaf4ff;color:#145eaa;font-size:12px;font-weight:850}#mpTechnicalTrace{margin-top:18px;border:1px solid #dfe7f1;border-radius:11px;padding:10px 12px;background:#fafcfe}#mpTechnicalTrace summary{cursor:pointer;font-weight:800;color:#536b82}
</style>
<script id="mp-teacher-script">
(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function renderTeacher(data){
 const p=data?.teacher_presentation;if(!p||!Array.isArray(p.sessions)||!p.sessions.length)return;
 const plan=document.getElementById('plan');const seq=document.getElementById('sessionsPlan');if(!plan||!seq)return;
 let header=document.getElementById('mpPlanMethodHeader');if(!header){header=document.createElement('div');header.id='mpPlanMethodHeader';header.className='mpPlanMethodHeader';plan.insertBefore(header,plan.firstChild)}
 const existingMeta=header.querySelector('.meta')?.outerHTML||'';const phaseLine=header.querySelector('.mpMethodPhases')?.outerHTML||'';
 header.innerHTML='<div class="muted">Proyecto generado por Multiplan</div><h2>'+esc(p.project_title||'Proyecto')+'</h2>'+existingMeta+'<div id="mpTeacherVoiceNote"><b>Redacción docente:</b> las actividades se presentan en primera persona para que la planeación tenga una voz natural de trabajo docente. Los PDA y referencias curriculares oficiales no se reescriben.</div>'+phaseLine;
 if(!document.getElementById('mpTechnicalTrace')){const detail=document.createElement('details');detail.id='mpTechnicalTrace';detail.innerHTML='<summary>Ver detalle técnico y trazabilidad original</summary><div style="margin-top:10px">'+seq.innerHTML+'</div>';seq.insertAdjacentElement('afterend',detail)}
 seq.innerHTML=p.sessions.map(s=>'<div class="mpTeacherSession"><span class="mpTeacherPhase">'+esc(s.phase||'Desarrollo')+'</span><h4>Sesión '+esc(s.session_number)+'</h4>'+(s.purpose?'<p><b>Propósito:</b> '+esc(s.purpose)+'</p>':'')+'<p class="mpTeacherNarrative">'+esc(s.teacher_narrative||'')+'</p>'+(s.activity_blocks||[]).map(b=>'<div class="mpTeacherBlock"><b>'+esc(b.label||'Actividad')+'</b>'+(Array.isArray(b.grades)&&b.grades.length?' · '+esc(b.grades.map(g=>g+'.º').join(', ')):'')+'<br>'+esc(b.narrative||'')+'</div>').join('')+'<p class="mpTeacherNarrative"><b>Cierre:</b> '+esc(s.closure_narrative||'')+'</p></div>').join('');
 setTimeout(()=>header.scrollIntoView({behavior:'smooth',block:'start'}),80);
}
function wrap(){const prior=window.fetch.bind(window);window.fetch=async function(input,init={}){const url=typeof input==='string'?input:(input?.url||'');const r=await prior(input,init);if(url.includes('/api/gemini-plan')){const c=r.clone();c.json().then(d=>{if(r.ok&&d.teacher_presentation)setTimeout(()=>renderTeacher(d),220)}).catch(()=>{})}return r}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wrap);else wrap();
})();
</script>`;
