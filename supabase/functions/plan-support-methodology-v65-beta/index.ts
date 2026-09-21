import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildMethodologyOverlay, ENGINE_VERSION } from "./methodology-v65/engine.mjs";
import { methodologyById } from "./methodology-v65/catalog.mjs";

const URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI=Deno.env.get("Multiplan")!;
const MODEL="gemini-3.5-flash-lite";
const SINGLE_V64=`${URL}/functions/v1/plan-support-didactic-execution-v2`;
const MULTI_V64=`${URL}/functions/v1/plan-support-multigrade-didactic-v2`;
const db=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
const CORS={
  "Access-Control-Allow-Origin":Deno.env.get("ALLOWED_ORIGIN")||"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Cache-Control":"no-store"
};
function json(body:unknown,status=200,headers:Record<string,string>={}){return new Response(JSON.stringify(body),{status,headers:{...CORS,"content-type":"application/json",...headers}})}
const uniq=(xs:any[])=>[...new Set(xs||[])];
const eq=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
function methodologySelection(body:any){
  const raw=String(body.methodology_selection||body.metodologia||body.methodology||"auto").trim().toLowerCase();
  const aliases:any={"proyectos comunitarios":"proyectos_comunitarios","aprendizaje basado en proyectos comunitarios":"proyectos_comunitarios","problemas":"abp","aprendizaje basado en problemas":"abp","indagacion steam":"steam","indagación steam":"steam","aprendizaje servicio":"aprendizaje_servicio","servicio":"aprendizaje_servicio","recomendar":"auto","recomiendame":"auto","recomiéndame una metodología":"auto"};
  return aliases[raw]||raw;
}
function cleanRequest(body:any){const out={...body};delete out.base_plan;delete out.methodology_selection;delete out.metodologia;delete out.methodology;delete out.v65_mode;return out}
async function callV64(body:any,auth:string){
  if(body.base_plan?.engineVersion?.startsWith("V6.4")) return structuredClone(body.base_plan);
  const grades=uniq((Array.isArray(body.grados)?body.grados:[]).map(Number).filter(Number.isInteger));
  const endpoint=grades.length>=2?MULTI_V64:SINGLE_V64;
  const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",Authorization:auth},body:JSON.stringify(cleanRequest(body)),signal:AbortSignal.timeout(grades.length>=2?205000:140000)});
  const raw=await r.text();let out:any;try{out=JSON.parse(raw)}catch{throw new Error(`V64_NON_JSON_${r.status}: ${raw.slice(0,300)}`)}
  if(!r.ok)throw new Error(`V64_BASE_FAILED_${r.status}: ${JSON.stringify(out).slice(0,1200)}`);
  return out;
}
function sessionSkeleton(s:any){return {session_number:s.session_number,purpose:s.purpose,pda_ids:s.pda_ids,project_advance:s.project_advance,product_relation:s.product_relation,partial_product:s.partial_product,work_moments:(s.work_moments||[]).map((m:any)=>({moment:m.moment,minutes:m.minutes,direct_teacher_grades:m.direct_teacher_grades,direct_teacher_pda_ids:m.direct_teacher_pda_ids,direct_learning_action:m.direct_learning_action,direct_teacher_action:m.direct_teacher_action,direct_student_action:m.direct_student_action,direct_evidence:m.direct_evidence,direct_ltg_refs:m.direct_ltg_refs,other_blocks:(m.other_blocks||[]).map((b:any,i:number)=>({block_index:i,block:b.block,grades:b.grades,pda_ids:b.pda_ids,activity:b.activity,ltg_refs:b.ltg_refs,evidence:b.evidence,assessment:b.assessment}))}))}}
async function callGemini(system:string,prompt:string){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":GEMINI},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json"}}),signal:AbortSignal.timeout(80000)});
  const raw=await r.json();if(!r.ok)throw new Error(`GEMINI_${r.status}: ${JSON.stringify(raw).slice(0,800)}`);
  let text=raw?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";text=text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim();if(!text)throw new Error("GEMINI_EMPTY");return JSON.parse(text)
}
function forbiddenMethodologyWords(primary:string){
  const map:any={proyectos_comunitarios:["fase steam","momento abp","aprendizaje servicio"],abp:["fase steam","aprendizaje servicio","fase de proyectos comunitarios"],steam:["momento abp","aprendizaje servicio","fase de proyectos comunitarios"],aprendizaje_servicio:["fase steam","momento abp","fase de proyectos comunitarios"]};return map[primary]||[]
}
function validateEnrichment(baseSession:any,meta:any,out:any,primaryId:string){
  const errors:string[]=[];
  if(Number(out?.session_number)!==Number(baseSession.session_number))errors.push("session_number distinto");
  if(String(out?.phase_or_moment||"")!==String(meta.phase_or_moment||""))errors.push("fase/momento distinto al asignado");
  if(!eq(uniq(out?.pda_developed||[]).sort(),uniq(baseSession.pda_ids||[]).sort()))errors.push("PDA alterados");
  if(!Array.isArray(out?.activities)||out.activities.length!==(baseSession.work_moments||[]).length)errors.push("actividades no corresponden a work_moments");
  const text=JSON.stringify(out).toLowerCase();for(const bad of forbiddenMethodologyWords(primaryId))if(text.includes(bad))errors.push(`mezcla metodológica detectada: ${bad}`);
  if(out?.complementary_strategy && !meta?.complementary_strategy)errors.push("estrategia complementaria inventada");
  if(out?.complementary_strategy && meta?.complementary_strategy && out.complementary_strategy.id!==meta.complementary_strategy.id)errors.push("estrategia complementaria cambió");
  if(primaryId==="aprendizaje_servicio"){
    if(String(out?.learning_objective||"").length<20)errors.push("falta objetivo de aprendizaje");
    if(String(out?.service_objective||"").length<20)errors.push("falta objetivo de servicio");
    if(String(out?.beneficiary||"").length<3)errors.push("falta beneficiario");
  }
  return errors;
}
function systemPrompt(method:any){return `Eres un especialista en planeación de primaria de la Nueva Escuela Mexicana. Trabajas ENCIMA de una planeación V6.4 ya aprobada. La metodología principal es ÚNICAMENTE: ${method.label}. NO puedes sustituir el problema, PDA, contenidos, proyecto LTG, producto, sesiones, minutos, grados, bloques, rotaciones, LTG ni activity_order. Sólo organizas CÓMO se desarrolla pedagógicamente cada sesión dentro de la metodología principal. No mezcles fases completas de otra metodología. Una estrategia complementaria, si fue sugerida, es puntual y debe regresar inmediatamente a la metodología principal. Las fases no son etiquetas: las acciones propuestas deben cumplir realmente su función pedagógica. Si la sesión es multigrado, no cambies atención directa, trabajo autónomo ni rotaciones. MÓDULO SELECCIONADO: ${JSON.stringify({id:method.id,label:method.label,phases:method.phases,rules:method.rules})}. RESPONDE SOLO JSON con: {session_number,phase_or_moment,pedagogical_fit,purpose,pda_developed,activities:[{moment,student_action,teacher_action,evidence,project_contribution,why_it_fits_phase}],evidence,project_advance,product_relation,resources,ltg_used,complementary_strategy,learning_objective,service_objective,beneficiary}. Usa exactamente phase_or_moment y PDA recibidos. No inventes LTG.`}
async function enrichSession(basePlan:any,session:any,meta:any,method:any){
  const prompt=JSON.stringify({project:{problem:basePlan.project_core?.problem,purpose:basePlan.project_core?.purpose,product:basePlan.project_core?.final_product,base_project:basePlan.project_core?.base_project},methodology_session:meta,session:sessionSkeleton(session)});
  let out=await callGemini(systemPrompt(method),prompt);let errors=validateEnrichment(session,meta,out,method.id);
  if(errors.length){out=await callGemini(systemPrompt(method),`${prompt}\nCORRECCIONES OBLIGATORIAS: ${JSON.stringify(errors)}. Conserva exactamente fase, PDA y estructura recibidas.`);errors=validateEnrichment(session,meta,out,method.id)}
  if(errors.length)throw new Error(`SESSION_${session.session_number}_METHODOLOGY_INVALID: ${errors.join(" | ")}`);
  return out;
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return json({code:"METHOD_NOT_ALLOWED"},405);
  let runId:string|null=null;
  try{
    const auth=req.headers.get("Authorization")||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";if(!token)return json({code:"AUTH_REQUIRED"},401);
    const {data:u,error:ue}=await db.auth.getUser(token);if(ue||!u.user?.id)return json({code:"AUTHENTICATED_USER_REQUIRED"},401);
    const body=await req.json();const selection=methodologySelection(body);if(selection!=="auto"&&!methodologyById(selection))return json({code:"INVALID_METHODOLOGY",allowed:["auto","proyectos_comunitarios","abp","steam","aprendizaje_servicio"]},400);
    const basePlan=await callV64(body,auth);
    const overlay=buildMethodologyOverlay({basePlan,request:body,methodologySelection:selection});
    const primaryId=overlay.methodology_engine.methodology_primary.id;const method=methodologyById(primaryId)!;
    const reqHash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify({base_run_id:basePlan.run_id||null,selection,project:basePlan.project_core?.base_project?.project_id||null,sessions:basePlan.sessions?.length||0})));const hash=Array.from(new Uint8Array(reqHash)).map(b=>b.toString(16).padStart(2,"0")).join("");
    const {data:run}=await db.from("plan_runs").insert({user_id:u.user.id,engine_version:ENGINE_VERSION,retrieval_version:`${basePlan.engineVersion||"V6.4"}+METHODOLOGY-OVERLAY`,input_json:{...cleanRequest(body),methodology_selection:selection},retrieval_json:{base_run_id:basePlan.run_id||null,base_engine_version:basePlan.engineVersion||null,methodology_primary:primaryId},model_provider:"google",model_name:MODEL,status:"GENERATING",request_hash:hash}).select("run_id").single();if(run?.run_id)runId=run.run_id;
    const metas=overlay.methodology_engine.sessions;const enriched=await Promise.all((basePlan.sessions||[]).map((s:any,i:number)=>enrichSession(basePlan,s,metas[i],method)));
    overlay.methodology_engine.sessions=metas.map((m:any,i:number)=>({...m,execution:enriched[i]}));
    overlay.methodology_engine.validator.quality.total=Math.min(16,overlay.methodology_engine.validator.quality.total+(enriched.every((x:any)=>String(x.pedagogical_fit||"").length>=30)?0:0));
    if(overlay.methodology_engine.validator.quality.total<13)throw new Error(`QUALITY_BELOW_MINIMUM_${overlay.methodology_engine.validator.quality.total}`);
    overlay.run_id=runId;overlay.base_run_id=basePlan.run_id||null;overlay.engineVersion=ENGINE_VERSION;
    if(runId)await db.from("plan_runs").update({model_output_json:overlay,validator_json:overlay.methodology_engine.validator,status:"APROBADO",error_message:null}).eq("run_id",runId);
    return json(overlay,200,{"x-multiplan-plan-engine":ENGINE_VERSION,"x-multiplan-base-engine":String(basePlan.engineVersion||"V6.4")});
  }catch(e){if(runId)await db.from("plan_runs").update({status:"ERROR",error_message:String(e)}).eq("run_id",runId);return json({code:"V65_METHODOLOGY_ENGINE_ERROR",run_id:runId,message:String(e)},500,{"x-multiplan-plan-engine":ENGINE_VERSION})}
});
