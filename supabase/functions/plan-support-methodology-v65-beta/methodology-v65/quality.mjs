function allSessions(plan,fn){const xs=plan?.sessions||[];return xs.length>0&&xs.every(fn)}
export function scoreQuality({basePlan,methodologySessions,validation,methodology,selection}={}){
  const core=basePlan?.project_core||{};
  const dims={};
  dims.project_coherence=(core.problem&&core.purpose&&core.final_product)?2:(core.problem&&core.purpose?1:0);
  dims.methodological_coherence=validation?.errors?.some(e=>/fase ajena|retroceso|metodolog/.test(e))?0:(methodologySessions?.length===basePlan?.sessions?.length?2:1);
  dims.pda_alignment=allSessions(basePlan,s=>Array.isArray(s.pda_ids)&&s.pda_ids.length)?2:1;
  dims.session_continuity=allSessions(basePlan,(s,i)=>i===0||Boolean(s.continuity_from_previous))?2:1;
  dims.progressive_product=allSessions(basePlan,s=>Boolean(s.project_advance)&&Boolean(s.product_relation))?2:1;
  dims.ltg_coherence=(basePlan?.ltg_use?.length||0)>0?2:(core.base_project?.project_id?1:0);
  const comps=(methodologySessions||[]).filter(x=>x.complementary_strategy);
  dims.complementary_strategy_pertinence=comps.some(x=>!x.complementary_strategy?.reason)?1:2;
  dims.general_viability=validation?.errors?.length?0:2;
  const total=Object.values(dims).reduce((a,b)=>a+b,0);
  return {dimensions:dims,total,max:16,minimum:13,status:total>=13&&validation?.errors?.length===0?'APROBADO':'REVISAR'};
}
