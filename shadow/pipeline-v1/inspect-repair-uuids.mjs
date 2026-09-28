const e=process.env;
const key=e.SUPABASE_SECRET_KEY;
const id='sessiongraph-repair-7be94d39-eb3a-40d2-9ab7-007899647b81';
const parts=['request.json','result.json','parsed.json','received.json'];
const rx=/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

function walk(v,path='$'){
  if(v===null||v===undefined)return;
  if(typeof v==='string'){
    const m=v.match(rx);
    if(m) for(const uuid of new Set(m)) console.log(JSON.stringify({path,uuid}));
    const s=v.trim();
    if((s.startsWith('{')&&s.endsWith('}'))||(s.startsWith('[')&&s.endsWith(']'))){
      try{walk(JSON.parse(s),path+'<json>')}catch{}
    }
    return;
  }
  if(typeof v!=='object')return;
  for(const [k,x] of Object.entries(v)) walk(x,path+'.'+k);
}

for(const part of parts){
  const u=e.SUPABASE_PROJECT_URL+
    '/storage/v1/object/authenticated/'+
    encodeURIComponent(e.SHADOW_EVIDENCE_BUCKET)+'/'+id+'/'+part;

  const r=await fetch(u,{headers:{apikey:key}});
  console.log('PART',part,r.status);
  if(r.ok) walk(await r.json(),part);
}
