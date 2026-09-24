import http from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createSupabaseCurriculumLookup} from './supabase-curriculum.mjs';
import {runRouterPipelineShadow} from './router-shadow.mjs';
import {runLiveShadowPipeline} from '../pipeline-v1/live-shadow.mjs';
import {SESSION_PROVIDER_MODEL} from '../pipeline-v1/session-provider.mjs';

const SUPABASE_URL=String(process.env.SUPABASE_URL||'https://dvcrwzxznuqongutnifn.supabase.co').replace(/\/$/,'');
const ANON=String(process.env.SUPABASE_ANON_KEY||'');
const PROXY_URL=String(process.env.LIVE_SHADOW_PROXY_URL||'');
const PROXY_TOKEN=String(process.env.LIVE_SHADOW_PROXY_TOKEN||'');
const PROVIDER_ENDPOINT=`${SUPABASE_URL}/functions/v1/plan-project-blueprint-v1-shadow`;
const PORT=Number(process.env.PORT||3000);
const evidenceDirectory=process.env.LIVE_SHADOW_EVIDENCE_DIR||'/tmp/multiplan-live-provider-evidence';
const identity='multiplan-router-live-provider-validation-v1';

if(!ANON||!PROXY_URL.startsWith('https://')||PROXY_TOKEN.length<40)throw Error('LIVE_SHADOW_VALIDATION_CONFIG_REQUIRED');
process.env.MULTIPLAN_SHADOW_RUN='1';
process.env.NODE_ENV='test';

const request={
  grados:[1,3],
  pdas:[
    {pda_id:'F3-DHC-1-010',grade:1,field:'LEGACY NO AUTORITATIVO',content:'LEGACY NO AUTORITATIVO',pda:'LEGACY NO AUTORITATIVO'},
    {pda_id:'F4-DHC-3-001',grade:3,field:'LEGACY NO AUTORITATIVO',content:'LEGACY NO AUTORITATIVO',pda:'LEGACY NO AUTORITATIVO'}
  ],
  contexto:'Escuela multigrado. Podemos consultar al docente y los recuerdos del grupo sobre prácticas y acuerdos de la escuela. Tenemos aula y patio techado, dos espacios seguros para intercambiar explicaciones con compañeros del mismo grupo. Sin internet, visitas ni participación familiar obligatoria. El alumnado nuevo necesita conocer cómo convivir y dónde pedir apoyo.',
  situacion_problema:'En el grupo desconocemos por qué existen nuestros acuerdos y prácticas escolares; esto dificulta convivir y explicar su importancia a los compañeros nuevos.',
  sesiones:3,
  minutos:90,
  recursos:'LEGACY_RESOURCE_MUST_NOT_BECOME_AUTHORIZED',
  methodology_selection:'proyectos_comunitarios',
  teacher_constraints:{
    students_by_grade:{1:5,3:5},
    reading_profile:'Lectura inicial en primero; tercero lee textos breves con apoyo.',
    writing_profile:'Primero usa dibujos y dictado; tercero registros breves.',
    autonomy_profile:'Baja; requiere consignas visuales y apoyo entre pares.',
    connectivity:'SIN_INTERNET',
    available_resources:['papel reutilizado','lápices','colores','mesas','aula','patio techado'],
    supports:['modelado docente','apoyo entre pares'],
    teacher_explicit_constraints:['Sin salir de la escuela','No pedir compras']
  }
};

const safeJson=async response=>{try{return await response.clone().json()}catch{return null}};
const providerRequests=new Map();
const transportEvents=[];

async function bridgedFetch(input,init={}){
  const target=input instanceof URL?input.toString():String(input);
  if(target.startsWith(`${SUPABASE_URL}/rest/v1/`)){
    const response=await fetch(PROXY_URL,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${PROXY_TOKEN}`,'x-shadow-identity':identity},body:JSON.stringify({proxy_kind:'CURRICULUM_GET',target_url:target}),signal:AbortSignal.timeout(30000)});
    transportEvents.push({kind:'CURRICULUM_GET',target:new URL(target).pathname,status:response.status});
    return response;
  }
  if(target===PROVIDER_ENDPOINT){
    let body=null;try{body=JSON.parse(String(init.body||'{}'))}catch{}
    const headers=new Headers(init.headers||{});headers.set('authorization',`Bearer ${PROXY_TOKEN}`);headers.set('x-shadow-identity',identity);
    const response=await fetch(PROXY_URL,{...init,headers});
    if(body?.task&&body.task!=='EVIDENCE_READ'){
      providerRequests.set(body.request_id||`${body.task}-${providerRequests.size+1}`,{request_id:body.request_id||null,task:body.task,model:body.model||null,input_hash:body.input_hash||null,initial_http_status:response.status,finish_reason:null,usage:null,provider_status:null,error_code:null});
    }
    if(body?.task==='EVIDENCE_READ'&&body?.part==='result'&&body?.request_id&&response.status!==202){
      const saved=await safeJson(response);const row=providerRequests.get(body.request_id);
      if(row&&saved){const payload=saved?.body||saved;row.result_http_status=saved?.http_status??response.status;row.provider_status=payload?.provider_status??null;row.finish_reason=payload?.finish_reason??null;row.usage=payload?.usage??payload?.usageMetadata??null;row.error_code=payload?.code??null;row.provider_error_status=payload?.provider_error_status??null;row.provider_message=payload?.provider_message?String(payload.provider_message).slice(0,240):null;}
    }
    return response;
  }
  return fetch(input,init);
}

function gateSummary(gate){
  if(!gate)return null;
  const det=[...(gate.deterministic_findings||[])],sem=[...(gate.semantic_findings||[])],critical=[...(gate.findings||[])];
  return {version:gate.gate_version||null,status:gate.status||null,critical_count:gate.critical_count??null,deterministic_failures:det.filter(x=>x.status!=='PASS').map(x=>x.rule_id),semantic_failures:sem.filter(x=>x.status!=='PASS').map(x=>x.rule_id),claim_failures:critical.filter(x=>x.status!=='PASS').map(x=>x.key||x.claim_type||x.rule_id)};
}
function failureClass(router,pipeline){
  const code=router?.error?.code||pipeline?.errors?.at?.(-1)?.code||null;
  const text=JSON.stringify({code,router:router?.error,pipeline: pipeline?.errors||[]});
  if(/CURRICULUM|REST|401|403|AUTH|FETCH|TIMEOUT|UNAVAILABLE/i.test(text))return 'TRANSPORT_OR_AUTH';
  if(/CONTRACT|SCHEMA|AUTHORING|CONSTRUCTION|TAMPER|BINDING/i.test(text))return 'CONTRACT';
  if(/PROVIDER|GOOGLE|MODEL|MAX_TOKENS|INVALID_JSON/i.test(text))return 'PROVIDER';
  if(['BLUEPRINT_NOT_APPROVED','SESSION_GRAPH_REJECTED','BLUEPRINT_REVISION_REQUIRED'].includes(router?.status))return 'PEDAGOGICAL_REJECTION';
  return router?.status==='READY_FOR_TEACHER'?'NONE':'UNCLASSIFIED';
}

let publicState={phase:'BOOT',started_at:new Date().toISOString()};
http.createServer((_req,res)=>{res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(publicState));}).listen(PORT,'0.0.0.0',()=>console.log(JSON.stringify({event:'LIVE_SHADOW_VALIDATION_SERVER_READY',port:PORT,model:SESSION_PROVIDER_MODEL})));

async function run(){
  const started=Date.now();
  publicState={phase:'RUNNING',started_at:new Date().toISOString(),model:SESSION_PROVIDER_MODEL};
  const directLookup=createSupabaseCurriculumLookup({url:SUPABASE_URL,publishableKey:ANON,authorization:`Bearer ${ANON}`});
  let directCurriculumProbe={status:'NOT_RUN'};
  try{await directLookup({pda_ids:['F3-DHC-1-010','F4-DHC-3-001'],grades:[1,3]});directCurriculumProbe={status:'PASS'};}
  catch(error){directCurriculumProbe={status:'FAIL',code:error?.code||'ERROR',http_status:error?.status||null,message:String(error?.message||error).slice(0,240),classification:'TRANSPORT_OR_AUTH'};}

  const curriculumLookup=createSupabaseCurriculumLookup({url:SUPABASE_URL,publishableKey:ANON,authorization:`Bearer ${ANON}`,fetchImpl:bridgedFetch});
  let fullPipeline=null;
  const pipelineRunner=async sources=>{
    fullPipeline=await runLiveShadowPipeline({sources,endpoint:PROVIDER_ENDPOINT,token:PROXY_TOKEN,identity,model:SESSION_PROVIDER_MODEL,evidenceDirectory,graphId:'router-live-provider-positive-v1',maxSessionRepairs:1,fetchImpl:bridgedFetch});
    return fullPipeline;
  };
  const router=await runRouterPipelineShadow({body:request,authorization:`Bearer ${ANON}`,curriculumLookup,pipelineRunner,sourceRunId:'router-live-provider-positive-2026-09-24'});
  const summary={
    event:'LIVE_PROVIDER_ROUTER_VALIDATION_RESULT',
    timestamp:new Date().toISOString(),
    elapsed_ms:Date.now()-started,
    model:SESSION_PROVIDER_MODEL,
    direct_curriculum_probe:directCurriculumProbe,
    shadow_bridge_used:true,
    router,
    pipeline_status:fullPipeline?.status||null,
    pipeline_version:fullPipeline?.pipeline_version||null,
    gates:{blueprint:gateSummary(fullPipeline?.blueprint_gate),session:gateSummary(fullPipeline?.session_gate),session_critical:gateSummary(fullPipeline?.session_critical_gate)},
    approvals:{blueprint:fullPipeline?.blueprint_approval?.status||null,session:fullPipeline?.session_approval?.status||null},
    repairs:{blueprint:fullPipeline?.blueprint?.revision?Math.max(0,Number(fullPipeline.blueprint.revision)-1):null,session:fullPipeline?.repair_count??null},
    teacher_projection:{present:!!fullPipeline?.teacher_plan,status:fullPipeline?.teacher_plan?.status||null,projection_version:fullPipeline?.teacher_plan?.projection_version||null,projection_hash:fullPipeline?.teacher_plan?.projection_hash||null,sessions:fullPipeline?.teacher_plan?.sessions?.length??null},
    provider_requests:[...providerRequests.values()],
    transport_events:transportEvents,
    failure_classification:failureClass(router,fullPipeline)
  };
  mkdirSync(evidenceDirectory,{recursive:true});writeFileSync(`${evidenceDirectory}/router-live-provider-summary.json`,JSON.stringify(summary,null,2));
  publicState={phase:'DONE',...summary};
  console.log(JSON.stringify(summary));
}

run().catch(error=>{const summary={event:'LIVE_PROVIDER_ROUTER_VALIDATION_FATAL',timestamp:new Date().toISOString(),model:SESSION_PROVIDER_MODEL,code:error?.code||'ERROR',message:String(error?.message||error).slice(0,500),classification:/CONTRACT|SCHEMA|AUTHORING|CONSTRUCTION/i.test(String(error))?'CONTRACT':/PROVIDER|GOOGLE|MODEL/i.test(String(error))?'PROVIDER':'TRANSPORT_OR_AUTH',provider_requests:[...providerRequests.values()],transport_events:transportEvents};publicState={phase:'FATAL',...summary};console.error(JSON.stringify(summary));});
