import { METHODOLOGIES, methodologyById } from './catalog.mjs';

const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const countSignals=(text,signals=[])=>signals.reduce((n,s)=>n+(text.includes(norm(s))?1:0),0);

function projectText(basePlan={}, request={}){
  const core=basePlan.project_core||{};
  const project=core.base_project||{};
  const activities=(basePlan.ltg_use||[]).flatMap(x=>x.source_activities||[]).map(x=>x.title).join(' ');
  const sessions=(basePlan.sessions||[]).map(s=>[
    s.purpose,s.project_advance,s.product_relation,
    ...(s.work_moments||[]).flatMap(m=>[m.direct_learning_action,m.direct_teacher_action,m.direct_student_action,m.direct_evidence])
  ].join(' ')).join(' ');
  return norm([
    request.situacion_problema, request.contexto, core.problem, core.purpose, core.final_product,
    core.one_sentence_project, core.guiding_question, project.name, project.scenario, activities, sessions
  ].join(' '));
}

function detectExistingMethodology(basePlan={}){
  const core=basePlan.project_core||{};
  const project=core.base_project||{};
  const scenario=norm(project.scenario);
  const titles=norm((basePlan.ltg_use||[]).flatMap(x=>x.source_activities||[]).map(x=>x.title).join(' '));
  const strong=[];
  if(scenario.includes('comunitario')) strong.push({id:'proyectos_comunitarios',reason:'El proyecto LTG base pertenece al escenario Comunitario.'});
  const steamHits=['indagamos','comprendemos','socializamos y aplicamos','reflexionamos el camino andado'].filter(x=>titles.includes(x)).length;
  if(steamHits>=3) strong.push({id:'steam',reason:'Los momentos LTG recuperados coinciden de forma suficiente con una secuencia de indagación STEAM.'});
  if(/presentamos|recolectamos|formulamos el problema|organizamos la experiencia|vivimos la experiencia|valoramos la experiencia/.test(titles)) strong.push({id:'abp',reason:'Los momentos LTG recuperados coinciden con ABP.'});
  if(/punto de partida|identificamos las necesidades para definir el servicio|organicemos las actividades|creatividad en marcha|valoramos y compartimos nuestros logros/.test(titles)) strong.push({id:'aprendizaje_servicio',reason:'Los momentos LTG recuperados coinciden con Aprendizaje Servicio.'});
  return strong;
}

function serviceEligibility(text){
  const beneficiary=/beneficiari|para (la|el|los|las) comunidad|para otros|apoyar a|servicio a|jornada|campana/.test(text);
  const serviceAction=/servicio|intervenir|campana|jornada|entregar|acompanar|mejorar para|apoyar a/.test(text);
  return {beneficiary,serviceAction,eligible:beneficiary&&serviceAction};
}

export function selectMethodology({basePlan={},request={},selection='auto'}={}){
  const manual=methodologyById(selection);
  if(selection && selection!=='auto' && selection!=='recomendar' && manual){
    return { methodology:manual, mode:'manual', reason:'Metodología seleccionada directamente por el docente.', scores:{[manual.id]:999}, confidence:'teacher_selected', ltgPreference:detectExistingMethodology(basePlan) };
  }
  const text=projectText(basePlan,request);
  const existing=detectExistingMethodology(basePlan);
  const scores={};
  const reasons={};
  for(const m of Object.values(METHODOLOGIES)){
    let score=countSignals(text,m.selectionSignals)*2;
    const rs=[];
    const prior=existing.find(x=>x.id===m.id);
    if(prior){score+=(m.id==='proyectos_comunitarios' && norm(basePlan?.project_core?.base_project?.scenario).includes('comunitario') ? 10 : 7);rs.push(prior.reason)}
    if(m.id==='steam'){
      const n=countSignals(text,['medir','experimentar','datos','observar','comparar','analizar','probar','evidencia']);
      if(n>=3){score+=4;rs.push('El proyecto exige obtener o analizar evidencias mediante indagación.')} 
    }
    if(m.id==='abp'){
      const n=countSignals(text,['problema','causa','consecuencia','alternativa','resolver','explicar']);
      if(n>=3){score+=3;rs.push('El núcleo requiere comprender y atender una situación problemática.')} 
    }
    if(m.id==='proyectos_comunitarios'){
      const n=countSignals(text,['comunidad','participar','difundir','intervenir','transformar','contexto']);
      if(n>=3){score+=3;rs.push('El proyecto avanza desde el contexto hacia una acción o producto compartido.')} 
    }
    if(m.id==='aprendizaje_servicio'){
      const se=serviceEligibility(text);
      if(se.eligible){score+=8;rs.push('Existe una acción de servicio real y un beneficiario identificable.')} else {score-=8;rs.push('No se acredita todavía servicio real y beneficiario; se penaliza Aprendizaje Servicio.')} 
    }
    scores[m.id]=score; reasons[m.id]=rs;
  }
  const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  let [id,best]=ranked[0]; const second=ranked[1]?.[1]??0;
  const methodology=METHODOLOGIES[id];
  const reason=(reasons[id]?.[0]) || `La metodología obtuvo la mayor compatibilidad con las acciones requeridas por el proyecto (${best} puntos).`;
  return { methodology, mode:'automatic', reason, scores, confidence: best-second>=5?'high':best-second>=2?'medium':'low', ltgPreference:existing };
}
