export const CANONICAL_CLIENT_BRIDGE_UI = String.raw`
<script id="mp-canonical-client-bridge-r1">
(()=>{
  let canonicalHash=null;
  const getState=()=>{try{return typeof state!=='undefined'?state:null}catch{return null}};
  const text=id=>String(document.getElementById(id)?.value??'').trim();
  const parseList=value=>{
    const raw=String(value??'').trim();
    if(!raw||/^no especificados?$/i.test(raw))return [];
    return [...new Set(raw.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean))];
  };
  const selectedPdas=()=>{
    const s=getState();
    try{return Object.values(s?.selected||{}).filter(Boolean).map(v=>({
      pda_id:String(v.pda_id||v.id||'').trim(),
      grade:Number(v.grade),
      field:v.field||null,
      content:v.content_official||v.content||null,
      pda:v.pda_official||v.pda||null
    })).filter(v=>v.pda_id&&Number.isInteger(v.grade))}
    catch{return []}
  };
  const students=grades=>{
    const s=getState(),src=s?.students||{},out={};
    for(const grade of grades){const n=Number(src[String(grade)]??src[grade]);if(Number.isInteger(n)&&n>0)out[String(grade)]=n}
    return out;
  };
  const upgradeGeneration=body=>{
    const grades=(Array.isArray(body.grados)?body.grados:Array.isArray(body.grades)?body.grades:[]).map(Number).filter(Number.isInteger);
    const checked=document.querySelector('input[name="mpMethod"]:checked')?.value||'';
    return {
      ...body,
      pdas:selectedPdas(),
      methodology_selection:body.methodology_selection||body.metodologia||checked,
      explicit_ltg_selections:Array.isArray(body.explicit_ltg_selections)?body.explicit_ltg_selections:(Array.isArray(body.ltg)?body.ltg.reduce((a,x)=>{const project_id=String(x?.project_id||'').trim(),pda_id=String(x?.pda_id||'').trim();if(!project_id||!pda_id)return a;let s=a.find(y=>y.project_id===project_id);if(!s){s={project_id,pda_ids:[],intent:'SUPPORT'};a.push(s)}if(!s.pda_ids.includes(pda_id))s.pda_ids.push(pda_id);return a},[]):[]),
      teacher_constraints:{
        students_by_grade:students(grades),
        reading_profile:String(body.lectura??body.reading_profile??text('reading')).trim(),
        writing_profile:String(body.escritura??body.writing_profile??text('writing')).trim(),
        autonomy_profile:String(body.autonomia??body.autonomy_profile??text('autonomy')).trim(),
        connectivity:String(body.conectividad??body.connectivity??text('connectivity')).trim(),
        available_resources:parseList(body.recursos??body.available_resources??text('resources')),
        supports:parseList(body.apoyos??body.supports??text('supports')),
        teacher_explicit_constraints:Array.isArray(body.teacher_explicit_constraints)?body.teacher_explicit_constraints:[]
      }
    };
  };
  const rememberHash=value=>{
    const h=String(value||'').trim();
    if(!/^[0-9a-f]{64}$/i.test(h))return;
    canonicalHash=h;
    const s=getState();if(s)s.canonicalPlanHash=h;
  };
  const currentHash=()=>canonicalHash||getState()?.canonicalPlanHash||'';
  const prior=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    let next=init;
    if(url.includes('/api/gemini-plan')&&typeof init.body==='string'){
      try{next={...init,body:JSON.stringify(upgradeGeneration(JSON.parse(init.body||'{}')))}}catch{}
    }
    if((url.includes('/api/pedagogical-review')||url.includes('/api/export/docx'))&&typeof next.body==='string'){
      try{const b=JSON.parse(next.body||'{}'),h=currentHash();if(h)b.canonical_plan_hash=h;next={...next,body:JSON.stringify(b)}}catch{}
    }
    const response=await prior(input,next);
    if(url.includes('/api/gemini-plan')&&response.ok)rememberHash(response.headers.get('x-multiplan-canonical-plan-hash'));
    if(/\/api\/history\/[0-9a-f-]{36}(?:$|\?)/i.test(url)&&response.ok){
      response.clone().json().then(d=>rememberHash(d?.canonical_plan_hash)).catch(()=>{});
    }
    return response;
  };
})();
</script>`;

