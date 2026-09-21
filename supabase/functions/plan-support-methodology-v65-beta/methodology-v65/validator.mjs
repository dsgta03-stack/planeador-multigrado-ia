const uniq=a=>[...new Set(a||[])];
function phaseLabel(span){return span.map(p=>p.label).join(' + ')}
function lockedSessionSignature(s){
  return {
    session_number:Number(s.session_number), total_minutes:Number(s.total_minutes), opening_minutes:Number(s.opening_minutes), closure_minutes:Number(s.closure_minutes),
    pda_ids:uniq(s.pda_ids).sort(),
    work_moments:(s.work_moments||[]).map(m=>({
      moment:Number(m.moment),minutes:Number(m.minutes),direct_teacher_grades:uniq(m.direct_teacher_grades).map(Number).sort((a,b)=>a-b),
      direct_teacher_pda_ids:uniq(m.direct_teacher_pda_ids).sort(),
      direct_ltg_refs:(m.direct_ltg_refs||[]).map(r=>({pda_id:r.pda_id,project_id:r.project_id,activity_orders:uniq(r.activity_orders).map(Number).sort((a,b)=>a-b)})),
      other_blocks:(m.other_blocks||[]).map(b=>({grades:uniq(b.grades).map(Number).sort((a,b)=>a-b),pda_ids:uniq(b.pda_ids).sort(),ltg_refs:(b.ltg_refs||[]).map(r=>({pda_id:r.pda_id,project_id:r.project_id,activity_orders:uniq(r.activity_orders).map(Number).sort((a,b)=>a-b)}))}))
    }))
  };
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function validateLockedCore(before,after){
  const errors=[];
  if(!same(before?.project_core,after?.project_core))errors.push('V6.5 modificó project_core de V6.4.');
  if(!same(before?.ltg_use,after?.ltg_use))errors.push('V6.5 modificó la selección o trazabilidad LTG.');
  const bs=before?.sessions||[], as=after?.sessions||[];
  if(bs.length!==as.length)errors.push('V6.5 cambió el número de sesiones.');
  for(let i=0;i<Math.min(bs.length,as.length);i++) if(!same(lockedSessionSignature(bs[i]),lockedSessionSignature(as[i]))) errors.push(`V6.5 cambió estructura curricular/operativa bloqueada en sesión ${i+1}.`);
  return errors;
}

export function validateMethodologyPlan({methodology,methodologySessions=[],basePlan,finalPlan}={}){
  const errors=[],warnings=[];
  if(!methodology?.id)errors.push('No existe metodología principal.');
  let lastOrder=0;
  for(const ms of methodologySessions){
    const spans=ms.phase_span||[];
    if(!spans.length)errors.push(`Sesión ${ms.session_number}: sin fase o momento.`);
    for(const p of spans){
      const canonical=methodology.phases.find(x=>x.id===p.id);
      if(!canonical)errors.push(`Sesión ${ms.session_number}: fase ajena a ${methodology.shortLabel}.`);
      if(canonical && canonical.order<lastOrder)errors.push(`Sesión ${ms.session_number}: retroceso metodológico no justificado.`);
      if(canonical)lastOrder=Math.max(lastOrder,canonical.order);
    }
    for(const k of ['purpose','evidence','project_advance','product_relation','resources','ltg_used']) if(ms[k]==null || (Array.isArray(ms[k])&&ms[k].length===0) || (!Array.isArray(ms[k])&&!String(ms[k]).trim())) warnings.push(`Sesión ${ms.session_number}: falta ${k}.`);
    if(!Array.isArray(ms.pda_developed)||!ms.pda_developed.length)errors.push(`Sesión ${ms.session_number}: sin PDA desarrollados.`);
    if(ms.complementary_strategy?.must_return_to_primary_methodology!==true && ms.complementary_strategy)errors.push(`Sesión ${ms.session_number}: estrategia complementaria sin retorno explícito a metodología principal.`);
  }
  if(basePlan&&finalPlan)errors.push(...validateLockedCore(basePlan,finalPlan));
  return {errors,warnings,status:errors.length?'REPROBADO':'APROBADO'};
}

export function methodologySessionRecord({session,phaseSpan,complementaryStrategy}={}){
  const refs=(session.work_moments||[]).flatMap(m=>[...(m.direct_ltg_refs||[]),...(m.other_blocks||[]).flatMap(b=>b.ltg_refs||[])]);
  return {
    session_number:session.session_number,
    methodology_primary:null,
    phase_span:phaseSpan.map(p=>({id:p.id,label:p.label,order:p.order})),
    phase_or_moment:phaseLabel(phaseSpan),
    purpose:String(session.purpose||''),
    pda_developed:uniq(session.pda_ids||[]),
    evidence:String((session.work_moments||[]).map(m=>m.direct_evidence||'').filter(Boolean).join(' | ')),
    project_advance:String(session.project_advance||''),
    product_relation:String(session.product_relation||''),
    resources:uniq((session.work_moments||[]).flatMap(m=>[
      ...(m.direct_material_support?.available_resources||[]),
      ...(m.other_blocks||[]).flatMap(b=>b.resources||[])
    ])),
    ltg_used:uniq(refs.map(r=>`${r.project_id||''}:${(r.activity_orders||[]).join(',')}`).filter(x=>x!==':')),
    complementary_strategy:complementaryStrategy||null,
  };
}
