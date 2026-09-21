import { selectMethodology } from './recommender.mjs';
import { distributePhases } from './distribution.mjs';
import { suggestComplementary } from './complementary.mjs';
import { methodologySessionRecord, validateMethodologyPlan } from './validator.mjs';
import { scoreQuality } from './quality.mjs';

export const ENGINE_VERSION='V6.5-METHODOLOGY-ENGINE-BETA';

export function buildMethodologyOverlay({basePlan,request={},methodologySelection='auto'}={}){
  if(!basePlan || !Array.isArray(basePlan.sessions)) throw new Error('BASE_V64_PLAN_REQUIRED');
  const choice=selectMethodology({basePlan,request,selection:methodologySelection});
  const method=choice.methodology;
  const distribution=distributePhases(method,basePlan.sessions.length);
  const methodologySessions=basePlan.sessions.map((session,i)=>{
    const strategy=suggestComplementary({methodology:method,session,basePlan});
    const rec=methodologySessionRecord({session,phaseSpan:distribution[i]||[method.phases.at(-1)],complementaryStrategy:strategy});
    rec.methodology_primary={id:method.id,label:method.label};
    rec.phase_pedagogical_purpose=(distribution[i]||[]).map(p=>p.purpose).join(' ');
    return rec;
  });
  const finalPlan=structuredClone(basePlan);
  finalPlan.engineVersion=ENGINE_VERSION;
  finalPlan.base_engine_version=basePlan.engineVersion||null;
  finalPlan.methodology_engine={
    version:ENGINE_VERSION,
    methodology_primary:{id:method.id,label:method.label},
    selection_mode:choice.mode,
    selection_reason:choice.reason,
    recommendation_confidence:choice.confidence,
    scores:choice.scores,
    ltg_preference:choice.ltgPreference,
    module_rules:method.rules,
    sessions:methodologySessions,
  };
  const validation=validateMethodologyPlan({methodology:method,methodologySessions,basePlan,finalPlan});
  const quality=scoreQuality({basePlan,methodologySessions,validation,methodology:method,selection:choice});
  finalPlan.methodology_engine.validator={...validation,quality};
  return finalPlan;
}
