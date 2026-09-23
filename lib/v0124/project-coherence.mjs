const text=v=>String(v??'').trim();
const sentence=v=>{const s=text(v);return s?s.replace(/\s+/g,' ').replace(/\s*\.\s*$/,'')+'.':''};
const safeGuide=v=>text(v).replace(/\b\d+\s*%\b/g,'avance parcial').replace(/\s+/g,' ').trim();
const ordinal=g=>`${Number(g)}.º`;

function fallbackAdvance(index,total,product){
  if(index===0)return `Se acuerda cómo se construirá ${product} y se reúnen las primeras evidencias que lo alimentarán.`;
  if(index===1)return `Se organiza la información y se definen los aportes que cada grado integrará en ${product}.`;
  if(index===total-1)return `Se monta, presenta y valora ${product} como resultado común del proyecto.`;
  if(index===total-2)return `Se terminan los aportes por grado y se integran en una versión completa de ${product}.`;
  return `Se elaboran y revisan aportes parciales que formarán parte de ${product}.`;
}
function fallbackPartial(index,total,product){
  if(index===0)return 'Acuerdos de proyecto, roles y primeras evidencias organizadas.';
  if(index===1)return 'Información seleccionada y plan de aportes por grado.';
  if(index===total-1)return `${product} presentado y valorado con evidencias del proceso.`;
  if(index===total-2)return `${product} integrado y listo para montaje o presentación.`;
  return `Versión parcial de los aportes que se incorporarán a ${product}.`;
}
function fallbackNext(index,total,product){
  if(index===total-1)return 'Cierra el proyecto con valoración de los aprendizajes, evidencias y producto común.';
  if(index===total-2)return `Deja ${product} listo para su presentación y valoración final.`;
  return 'Conserva las evidencias y acuerdos para retomarlos en la siguiente sesión.';
}
function blocksFromSession(session){
  const out=[];
  for(const m of session?.work_moments||[]){
    if(text(m?.direct_teacher_action))out.push({label:'Atención directa',grades:Array.isArray(m.direct_teacher_grades)?m.direct_teacher_grades:[],narrative:`Acompañaré a estos grados para ${text(m.direct_teacher_action).replace(/^./,c=>c.toLowerCase())}`});
    for(const b of m?.other_blocks||[])if(text(b?.activity))out.push({label:text(b.block)||'Trabajo autónomo',grades:Array.isArray(b.grades)?b.grades:[],narrative:`Organizaré a estos alumnos para ${text(b.activity).replace(/^./,c=>c.toLowerCase())}`});
  }
  return out;
}
function synthTeacherSession(session,row){
  return {
    session_number:row.session_number,
    phase:row.phase,
    purpose:row.purpose,
    project_advance:row.project_advance,
    partial_product:row.partial_product,
    prepares_next:row.prepares_next,
    teacher_narrative:sentence(`Iniciaré la sesión retomando ${text(session?.common_opening||row.continuity_from_previous||row.purpose)}`),
    activity_blocks:blocksFromSession(session),
    closure_narrative:sentence(`Cerraré la sesión con ${text(session?.common_closure||'una revisión del avance y de las evidencias que se conservarán')}`),
  };
}

export function applyProjectCoherence(input){
  if(!input||typeof input!=='object')return {plan:input,status:'SKIPPED_INVALID_PLAN'};
  const plan=structuredClone(input), engine=plan?.methodology_engine||{}, integrated=engine?.integrated_project;
  if(!integrated||typeof integrated!=='object')return {plan,status:'SKIPPED_NO_INTEGRATED_PROJECT'};
  const title=text(integrated.display_title)||text(integrated.title)||text(plan?.teacher_presentation?.project_title)||'Proyecto multigrado';
  const finalProduct=text(integrated.collective_product_or_service)||'Producto común del proyecto';
  const mission=text(integrated.unifying_mission)||`Construir ${finalProduct} mediante aportes diferenciados de los grados participantes.`;
  const guide=new Map((Array.isArray(engine.sessions)?engine.sessions:[]).map(x=>[Number(x?.session_number),x]));
  const sessions=Array.isArray(plan.sessions)?plan.sessions:[];
  const sequence=sessions.map((session,index)=>{
    const number=Number(session?.session_number||index+1), g=guide.get(number)||{};
    const phase=text(g.phase)||text(session?.methodology_phase)||'Desarrollo del proyecto';
    const basePurpose=text(session?.purpose)||text(g.purpose)||`Avanzar en ${finalProduct}`;
    const purpose=`${basePurpose.replace(/[.]$/,'')} y vincular este trabajo con ${finalProduct}.`;
    const rawAdvance=safeGuide(g.project_advance), rawRelation=safeGuide(g.product_relation), rawNext=safeGuide(g.prepares_next), rawContinuity=safeGuide(g.continuity_from_previous);
    const advance=rawAdvance?`${sentence(rawAdvance)} ${sentence(`Este avance se incorpora a ${finalProduct}`)}`:fallbackAdvance(index,sessions.length,finalProduct);
    const partial=rawRelation?`${sentence(rawRelation)} ${sentence(`Se conserva como parte de ${finalProduct}`)}`:fallbackPartial(index,sessions.length,finalProduct);
    const next=rawNext||fallbackNext(index,sessions.length,finalProduct);
    const continuity=!rawContinuity||/^n\/?a$/i.test(rawContinuity)?(index===0?'Punto de partida del proyecto.':'Retoma las evidencias y acuerdos de la sesión anterior.'):sentence(rawContinuity);
    session.project_stage=phase;session.project_advance=advance;session.partial_product=partial;session.prepares_next=next;session.continuity_from_previous=continuity;
    return {session_number:number,phase,purpose,project_advance:advance,partial_product:partial,continuity_from_previous:continuity,prepares_next:sentence(next)};
  });
  const contributions=(Array.isArray(integrated.grade_contributions)?integrated.grade_contributions:[]).map(x=>({grade:Number(x?.grade)||null,contribution:text(x?.contribution),evidence:text(x?.evidence),why_it_matters:text(x?.why_it_matters)})).filter(x=>x.grade);
  plan.project={version:'PROJECT-COHERENCE-V1',title,mission,final_product:finalProduct,beneficiary:text(integrated.beneficiary),impact_goal:text(integrated.impact_goal),grade_contributions:contributions};
  plan.product_model={type:'ONE_COMMON_PRODUCT_WITH_DIFFERENTIATED_GRADE_CONTRIBUTIONS',final_product:finalProduct,grade_contributions:contributions};
  plan.project_sequence=sequence;
  integrated.display_title=title;
  const existing=plan.teacher_presentation&&typeof plan.teacher_presentation==='object'?plan.teacher_presentation:{};
  const teacherSessions=Array.isArray(existing.sessions)?existing.sessions:[];
  const teacherMap=new Map(teacherSessions.map(x=>[Number(x?.session_number),x]));
  plan.teacher_presentation={...existing,project_title:title,project_final_product:finalProduct,project_mission:mission,sessions:sequence.map((row,index)=>{
    const original=teacherMap.get(row.session_number)||synthTeacherSession(sessions[index],row);
    return {...original,session_number:row.session_number,phase:row.phase,purpose:row.purpose,project_advance:row.project_advance,partial_product:row.partial_product,continuity_from_previous:row.continuity_from_previous,prepares_next:row.prepares_next};
  })};
  plan.project_coherence={version:'PROJECT-COHERENCE-V1',status:sequence.length&&sequence.every(x=>x.project_advance&&x.partial_product&&x.prepares_next)?'PASS':'REVIEW',project_title_visible:true,one_common_product:true,session_progression_explicit:true,grade_contributions_are_not_independent_final_projects:true};
  return {plan,status:plan.project_coherence.status};
}

export function projectCoherenceSummary(plan){
  const p=plan?.project;return p?{title:p.title,final_product:p.final_product,session_count:Array.isArray(plan?.project_sequence)?plan.project_sequence.length:0,grades:(p.grade_contributions||[]).map(x=>ordinal(x.grade))}:null;
}
