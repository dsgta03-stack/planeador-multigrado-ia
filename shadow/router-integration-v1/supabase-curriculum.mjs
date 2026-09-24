export const SUPABASE_CURRICULUM_LOOKUP_VERSION='SUPABASE_CURRICULUM_LOOKUP_V1';

const SAFE_ID=/^[A-Za-z0-9._:-]+$/;
const unique=a=>[...new Set(a)];
const safeIds=ids=>unique(ids).map(id=>String(id)).filter(Boolean).map(id=>{if(!SAFE_ID.test(id))throw Error(`UNSAFE_CURRICULUM_ID:${id}`);return id});
const filterIn=ids=>`in.(${safeIds(ids).join(',')})`;
function pageNumber(value){const n=Number.parseInt(String(value??''),10);return Number.isInteger(n)&&n>0?n:null}

export function createSupabaseCurriculumLookup({url,publishableKey,authorization,fetchImpl=fetch}={}){
  if(typeof url!=='string'||!url.startsWith('https://'))throw Error('SUPABASE_URL_REQUIRED');
  if(typeof publishableKey!=='string'||!publishableKey)throw Error('SUPABASE_PUBLISHABLE_KEY_REQUIRED');
  if(typeof authorization!=='string'||!authorization.startsWith('Bearer '))throw Error('USER_AUTHORIZATION_REQUIRED');
  const base=url.replace(/\/$/,'')+'/rest/v1/';
  const headers={apikey:publishableKey,authorization,accept:'application/json','accept-profile':'public'};
  const get=async(table,params)=>{
    const u=new URL(table,base);
    for(const [k,v] of Object.entries(params))if(v!==null&&v!==undefined)u.searchParams.set(k,String(v));
    const r=await fetchImpl(u,{headers,signal:AbortSignal.timeout(20000)});
    const data=await r.json().catch(()=>null);
    if(!r.ok){const e=Error(`CURRICULUM_REST_${table}_${r.status}`);e.code='CURRICULUM_LOOKUP_FAILED';e.status=r.status;throw e}
    if(!Array.isArray(data))throw Error(`CURRICULUM_REST_${table}_NOT_ARRAY`);
    return data;
  };
  return async function curriculumLookup({pda_ids,grades}){
    const ids=safeIds(pda_ids||[]),wantedGrades=new Set((grades||[]).map(Number));
    if(!ids.length)throw Error('PDA_IDS_REQUIRED');
    const pdaRows=await get('pda',{select:'pda_id,grade,field,content_official,pda_official,verification_status,active',pda_id:filterIn(ids),active:'eq.true'});
    const pdas=pdaRows.filter(x=>wantedGrades.has(Number(x.grade))&&String(x.verification_status||'').toLowerCase()==='verificado');
    const links=await get('project_pda',{select:'project_id,pda_id,verification_type,active',pda_id:filterIn(ids),active:'eq.true'});
    const verifiedLinks=links.filter(x=>String(x.verification_type||'').toLowerCase()==='verificado');
    const projectIds=safeIds(verifiedLinks.map(x=>x.project_id));
    if(!projectIds.length)return {provenance:'SUPABASE public.pda + project_pda + projects_ltg + ltg_project_activities; active verified rows',pdas,ltg:[]};
    const projects=await get('projects_ltg',{select:'project_id,grade,book,scenario,name,start_page,end_page,verification_status,active',project_id:filterIn(projectIds),active:'eq.true'});
    const activities=await get('ltg_project_activities',{select:'id,project_id,activity_order,page_start,page_end,activity_summary,verification_status',project_id:filterIn(projectIds),order:'project_id.asc,activity_order.asc'});
    const linksByProject=new Map();
    for(const row of verifiedLinks){const a=linksByProject.get(row.project_id)||[];a.push(row.pda_id);linksByProject.set(row.project_id,a)}
    const actsByProject=new Map();
    for(const row of activities){if(String(row.verification_status||'').toLowerCase()!=='verified')continue;const a=actsByProject.get(row.project_id)||[];a.push({activity_id:String(row.id),activity_order:Number(row.activity_order),summary:String(row.activity_summary||'').trim(),page_start:Number(row.page_start),page_end:Number(row.page_end),verification_status:String(row.verification_status)});actsByProject.set(row.project_id,a)}
    const ltg=projects.filter(x=>wantedGrades.has(Number(x.grade))&&String(x.verification_status||'').toLowerCase()==='verificado').map(row=>({
      project_id:String(row.project_id),grade:Number(row.grade),book:String(row.book||'').trim(),scenario:String(row.scenario||'').trim(),name:String(row.name||'').trim(),pages:{start:pageNumber(row.start_page),end:pageNumber(row.end_page)},verified_pda_links:unique((linksByProject.get(row.project_id)||[]).filter(id=>ids.includes(id))),verified_activities:actsByProject.get(row.project_id)||[]
    })).filter(x=>x.book&&x.scenario&&x.name&&x.pages.start&&x.pages.end&&x.pages.end>=x.pages.start);
    return {provenance:'SUPABASE public.pda + project_pda + projects_ltg + ltg_project_activities; active verified rows',pdas,ltg};
  };
}
