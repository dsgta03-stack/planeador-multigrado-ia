import {hash} from '../project-blueprint-v1/contracts.mjs';

const ids=[
 'sessiongraph-repair-7be94d39-eb3a-40d2-9ab7-007899647b81',
 '1a188863-a7b5-483c-90de-02a4ee71a9ba',
 'd824482e-ecea-4d9c-9542-36baedbdd613',
 'cd6f2a06-52ae-4c16-a19f-642eec5c3087',
 '2b6e2684-7a8b-4af1-a24f-eb591fd0abdf',
 'cc45f21f-d7c5-4c70-ac27-02a1b3fead6c'
];

const parts=['request.json','result.json','parsed.json','received.json'];

const e=process.env;
const key=e.SUPABASE_SECRET_KEY;
if(!key) throw Error('SUPABASE_SECRET_KEY_MISSING');

function url(id,part){
 return e.SUPABASE_PROJECT_URL+
  '/storage/v1/object/authenticated/'+
  encodeURIComponent(e.SHADOW_EVIDENCE_BUCKET)+'/'+
  id+'/'+part;
}

function walk(value,path='$',out=[],seen=new Set()){
 if(value==null) return out;

 if(typeof value==='string'){
  const s=value.trim();
  if(
   (s.startsWith('{')&&s.endsWith('}')) ||
   (s.startsWith('[')&&s.endsWith(']'))
  ){
   try{walk(JSON.parse(s),path+'<json>',out,seen)}catch{}
  }
  return out;
 }

 if(typeof value!=='object'||seen.has(value)) return out;
 seen.add(value);

 const keys=Object.keys(value);

 const interesting=
  keys.includes('blueprint') ||
  keys.includes('blueprint_id') ||
  keys.includes('session_progression') ||
  keys.includes('project_stages') ||
  String(value.schema_version||'').includes('PROJECT_BLUEPRINT');

 if(interesting){
  let h=null;
  try{h=hash(value)}catch{}
  out.push({
   path,
   hash:h,
   schema_version:value.schema_version||null,
   blueprint_id:value.blueprint_id||null,
   keys:keys.slice(0,30)
  });
 }

 for(const [k,v] of Object.entries(value)){
  walk(v,path+'.'+k,out,seen);
 }

 return out;
}

for(const id of ids){
 for(const part of parts){
  const r=await fetch(url(id,part),{headers:{apikey:key}});

  if(!r.ok){
   console.log('EVIDENCE_PART '+JSON.stringify({
    id,part,status:r.status
   }));
   continue;
  }

  const doc=await r.json();

  console.log('EVIDENCE_PART '+JSON.stringify({
   id,
   part,
   status:r.status,
   top_keys:Object.keys(doc||{}).slice(0,30)
  }));

  const matches=walk(doc).slice(0,20);

  for(const match of matches){
   console.log('BLUEPRINT_CLUE '+JSON.stringify({
    id,part,...match
   }));
  }
 }
}
