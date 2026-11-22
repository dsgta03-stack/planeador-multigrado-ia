// Composition may choose candidate roles, but may not replace teacher decisions.
// Returns source rows read-only; callers must never mutate them.
export function assertExplicitLtgComposition(composition,sources){
  const decisions=sources?.constraints?.explicit_ltg_selections||[];
  if(!decisions.length)return decisions;
  const selected=new Set(sources.constraints.selected_pda_ids);
  const pdas=new Map(sources.curriculum.pdas.map(x=>[x.pda_id,x]));
  const projects=new Map(sources.curriculum.ltg.map(x=>[x.project_id,x]));
  const basePdas=new Set(composition.grade_coverage
    .filter(x=>x.mode==='BASE_PDA').flatMap(x=>x.pda_ids));
  for(const decision of decisions){
    const project=projects.get(decision.project_id);
    if(!project)throw Error(`PCD-009 EXPLICIT_LTG_PROJECT_NOT_FOUND:${decision.project_id}`);
    if(!['CORE','SUPPORT','OPTIONAL'].includes(decision.intent)||!decision.pda_ids?.length){
      throw Error(`PCD-009 EXPLICIT_LTG_DECISION_INVALID:${decision.project_id}`);
    }
    for(const id of decision.pda_ids){
      if(!selected.has(id)||!project.verified_pda_links.includes(id)||pdas.get(id)?.grade!==project.grade){
        throw Error(`PCD-009 EXPLICIT_LTG_PDA_NOT_VERIFIED:${decision.project_id}:${id}`);
      }
    }
    const isBase=composition.base.origin==='LTG_VERIFIED'&&composition.base.project_id===decision.project_id;
    const role=isBase?'CORE':composition.enrichments.some(x=>x.project_id===decision.project_id)?'SUPPORT':null;
    if(!role)throw Error(`PCD-009 EXPLICIT_LTG_OPERATIONAL_PROJECT_REQUIRED:${decision.project_id}`);
    if(role!==decision.intent){
      throw Error(`PCD-009 EXPLICIT_LTG_INTENT_MISMATCH:${decision.project_id}:${decision.intent}:${role}`);
    }
    if(isBase&&decision.pda_ids.some(id=>!basePdas.has(id))){
      throw Error(`PCD-009 EXPLICIT_LTG_BASE_PDA_COVERAGE_MISMATCH:${decision.project_id}`);
    }
  }
  return decisions;
}
