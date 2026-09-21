import { COMPLEMENTARY_STRATEGIES } from './catalog.mjs';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function suggestComplementary({methodology,session,basePlan}={}){
  const text=norm([
    session?.purpose,session?.project_advance,session?.product_relation,
    ...(session?.work_moments||[]).flatMap(m=>[m.direct_learning_action,m.direct_teacher_action,m.direct_student_action,m.direct_evidence])
  ].join(' '));
  const candidates=[];
  for(const [id,s] of Object.entries(COMPLEMENTARY_STRATEGIES)){
    if(methodology?.complementaryExclusions?.includes(id))continue;
    const hits=s.signals.filter(x=>text.includes(norm(x)));
    if(hits.length>=2)candidates.push({id,label:s.label,hits,score:hits.length});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  if(!best)return null;
  const contribution=String(session?.product_relation||session?.project_advance||'').trim();
  if(!contribution)return null;
  return {
    id:best.id,label:best.label,
    reason:`Se justifica de forma puntual porque la sesión requiere ${best.hits.slice(0,3).join(', ')} y ese trabajo contribuye al avance del proyecto.`,
    use_mode: best.score>=4?'auto_discreet':'teacher_confirmation_suggested',
    must_return_to_primary_methodology:true,
  };
}
