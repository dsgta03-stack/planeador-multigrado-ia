import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0116_CHILD_PORT||6101);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;
const RECOMMENDER="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/recommend-methodology-v1";

const child=spawn(process.execPath,["server-v0114-ui-result-guard.mjs"],{env:{...process.env,PORT:String(CHILD_PORT)},stdio:["ignore","inherit","inherit"]});
let stopping=false;
child.on("exit",(code,signal)=>{console.error(`[v0116] child exited code=${code} signal=${signal}`);if(!stopping)setTimeout(()=>process.exit(code||1),50)});
for(const sig of["SIGTERM","SIGINT"])process.on(sig,()=>{stopping=true;try{child.kill(sig)}catch{}process.exit(0)});

function readBody(req,max=650000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}
function json(res,status,body,extra={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra});res.end(JSON.stringify(body))}

const METHODS={
 abp:{label:"Aprendizaje Basado en Problemas",phases:["Presentemos","Recolectemos","Formulemos el problema","Organicemos la experiencia","Vivamos la experiencia","Resultados y análisis"]},
 steam:{label:"Aprendizaje Basado en Indagación con enfoque STEAM",phases:["Introducción e identificación","Diseño de la indagación","Desarrollo de la indagación","Organización y construcción de respuestas","Presentación y aplicación","Reflexión y metacognición"]},
 aprendizaje_servicio:{label:"Aprendizaje Servicio",phases:["Punto de partida","Lo que sé y lo que quiero saber","Organicemos las actividades","Creatividad en marcha","Compartimos y evaluamos lo aprendido"]},
 proyectos_comunitarios:{label:"Aprendizaje Basado en Proyectos Comunitarios",phases:["Planeación","Acción","Intervención"]}
};

const PATCH=String.raw`
<style id="mp-methodology-style">
#mpMethodologyStep{border:1px solid #cfe0f1!important;background:linear-gradient(135deg,#fff,#f7fbff)!important}
.mpMethodGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.mpMethodOption{border:1px solid #dbe5ef;border-radius:12px;padding:12px;background:#fff;cursor:pointer}.mpMethodOption.recommended{border-color:#5a9de4;background:#eef6ff}.mpMethodOption.selected{box-shadow:0 0 0 3px rgba(22,116,232,.14);border-color:#1674e8}.mpMethodOption input{width:auto!important;margin-right:7px}.mpMethodScore{font-size:11px;font-weight:800;color:#315c83;background:#eef6ff;border-radius:999px;padding:4px 7px;float:right}.mpMethodPhases{font-size:12px;color:#64778a;line-height:1.45;margin-top:7px}.mpMethodReason{padding:11px 13px;border-radius:11px;background:#f4f9ff;border:1px solid #d9e8f7;line-height:1.5;margin:10px 0}.mpPlanMethodHeader{padding:18px 20px;margin:0 0 16px;border-radius:15px;background:linear-gradient(120deg,#edf6ff,#f3fbf8);border:1px solid #cae0f4}.mpPlanMethodHeader h2{margin:0 0 6px!important;font-size:25px!important}.mpPlanMethodHeader .meta{display:flex;flex-wrap:wrap;gap:7px;margin:9px 0}.mpPlanMethodHeader .tag{font-size:12px;font-weight:800;padding:5px 8px;border-radius:999px;background:#fff;border:1px solid #d5e4f2;color:#315c83}.mpPhaseBadge{display:inline-block;margin:4px 0 8px;padding:5px 8px;border-radius:8px;background:#eaf4ff;color:#145eaa;font-size:12px;font-weight:850}@media(max-width:760px){.mpMethodGrid{grid-template-columns:1fr}}
</style>
<script id="mp-methodology-script">
(()=>{
const METHODS=${JSON.stringify(METHODS)};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let recommendation=null,selectedMethod=null,allowGenerate=false;

function selectedPdas(){try{return Object.values(state.selected||{}).map(v=>({pda_id:v.pda_id,grade:v.grade,field:v.field,content:v.content_official,pda:v.pda_official}))}catch{return[]}}
function insertStep(){
 if(document.getElementById('mpMethodologyStep'))return document.getElementById('mpMethodologyStep');
 const results=document.getElementById('results');if(!results)return null;
 const s=document.createElement('section');s.className='card hidden';s.id='mpMethodologyStep';s.innerHTML='<h2>3. Metodología del proyecto</h2><p class="muted">Multiplan analizará la situación, el contexto y los PDA seleccionados para recomendar la metodología más adecuada. La recomendación orienta; la decisión final sigue siendo del docente.</p><div id="mpMethodStatus"></div><div id="mpMethodOptions"></div><div class="actions"><button type="button" class="primary" id="mpGenerateWithMethod" disabled>Generar planeación con esta metodología</button></div>';
 results.insertAdjacentElement('afterend',s);return s;
}
function renderRecommendation(data){
 recommendation=data;selectedMethod=data.recommended_id;const step=insertStep();if(!step)return;
 const scores=new Map((data.ranking||[]).map(x=>[x.id,x]));
 document.getElementById('mpMethodStatus').innerHTML='<div class="mpMethodReason"><b>Metodología recomendada: '+esc(data.recommended_label||METHODS[data.recommended_id]?.label||data.recommended_id)+'</b><br>'+esc(data.reason||'')+'<br><span class="muted">Puedes aceptar esta recomendación o elegir otra metodología antes de generar.</span></div>';
 document.getElementById('mpMethodOptions').innerHTML='<div class="mpMethodGrid">'+Object.entries(METHODS).map(([id,m])=>{const r=scores.get(id)||{};const rec=id===data.recommended_id;return '<label class="mpMethodOption '+(rec?'recommended ':'')+(id===selectedMethod?'selected':'')+'" data-mid="'+id+'"><span class="mpMethodScore">'+esc(r.score??'—')+'%</span><input type="radio" name="mpMethod" value="'+id+'" '+(id===selectedMethod?'checked':'')+'><b>'+esc(m.label)+'</b>'+(rec?'<div style="font-size:11px;font-weight:850;color:#1674e8;margin-top:4px">RECOMENDADA POR MULTIPLAN</div>':'')+'<div class="mpMethodPhases"><b>Secuencia:</b> '+m.phases.map(esc).join(' → ')+'</div></label>'}).join('')+'</div>';
 step.querySelectorAll('input[name="mpMethod"]').forEach(i=>i.addEventListener('change',()=>{selectedMethod=i.value;step.querySelectorAll('.mpMethodOption').forEach(x=>x.classList.toggle('selected',x.dataset.mid===selectedMethod));document.getElementById('mpGenerateWithMethod').disabled=false;}));
 document.getElementById('mpGenerateWithMethod').disabled=false;step.classList.remove('hidden');setTimeout(()=>step.scrollIntoView({behavior:'smooth',block:'start'}),40);
}
async function recommend(){
 const pdas=selectedPdas();if(!pdas.length){const e=document.getElementById('err');if(e)e.innerHTML='<div class="notice error">Selecciona al menos un PDA antes de continuar.</div>';return}
 const step=insertStep();step.classList.remove('hidden');document.getElementById('mpMethodStatus').innerHTML='<div class="notice"><b>Analizando la metodología más adecuada…</b><br>Se consideran la problemática, el contexto, los grados y los PDA seleccionados.</div>';document.getElementById('mpMethodOptions').innerHTML='';document.getElementById('mpGenerateWithMethod').disabled=true;step.scrollIntoView({behavior:'smooth',block:'start'});
 const payload={grados:state.grades,pdas,contexto:document.getElementById('context')?.value?.trim()||'',situacion_problema:document.getElementById('problem')?.value?.trim()||'',sesiones:Number(document.getElementById('sessions')?.value||5),minutos:Number(document.getElementById('minutes')?.value||90),recursos:document.getElementById('resources')?.value?.trim()||''};
 try{const r=await fetch('/api/methodology-recommendation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.message||d.code||'No fue posible recomendar metodología');renderRecommendation(d)}catch(e){document.getElementById('mpMethodStatus').innerHTML='<div class="notice error"><b>No fue posible obtener la recomendación.</b><br>'+esc(String(e))+'</div>'}
}
function bind(){
 insertStep();const cont=document.getElementById('continue');if(!cont)return;
 cont.addEventListener('click',e=>{if(allowGenerate){allowGenerate=false;return}e.preventDefault();e.stopImmediatePropagation();recommend();},true);
 document.getElementById('mpGenerateWithMethod').addEventListener('click',()=>{if(!selectedMethod)return;allowGenerate=true;cont.click();},false);
}
function renderPlanHeader(data){
 const project=data?.methodology_engine?.integrated_project||{};const primary=data?.methodology_engine?.methodology_primary||{};const chosen=primary.id||selectedMethod;const method=METHODS[chosen]||{label:primary.label||chosen,phases:[]};const plan=document.getElementById('plan');if(!plan)return;
 let h=document.getElementById('mpPlanMethodHeader');if(!h){h=document.createElement('div');h.id='mpPlanMethodHeader';h.className='mpPlanMethodHeader';plan.insertBefore(h,plan.firstChild)}
 const over=recommendation&&recommendation.recommended_id!==chosen?'<span class="tag">Elección docente distinta de la recomendación</span>':'';
 h.innerHTML='<div class="muted">Proyecto generado por Multiplan</div><h2>'+esc(project.title||'Proyecto en construcción')+'</h2><div class="meta"><span class="tag">'+esc(method.label)+'</span>'+over+'</div>'+(project.unifying_mission?'<p><b>Propósito común:</b> '+esc(project.unifying_mission)+'</p>':'')+(project.collective_product_or_service?'<p><b>Producto o servicio común:</b> '+esc(project.collective_product_or_service)+'</p>':'')+'<div class="mpMethodPhases"><b>Secuencia metodológica:</b> '+method.phases.map(esc).join(' → ')+'</div>';
 const guidance=new Map((data?.methodology_engine?.sessions||[]).map(x=>[Number(x.session_number),x]));
 setTimeout(()=>document.querySelectorAll('#sessionsPlan .session').forEach((el,i)=>{if(el.querySelector('.mpPhaseBadge'))return;const g=guidance.get(i+1);if(!g)return;const badge=document.createElement('div');badge.className='mpPhaseBadge';badge.textContent='Fase metodológica: '+g.phase;el.insertBefore(badge,el.firstChild)}),120);
}
function wrapFetch(){
 const prior=window.fetch.bind(window);window.fetch=async function(input,init={}){const url=typeof input==='string'?input:(input?.url||'');if(url.includes('/api/gemini-plan')&&selectedMethod&&typeof init.body==='string'){try{const b=JSON.parse(init.body||'{}');b.methodology_selection=selectedMethod;b.methodology_recommendation=recommendation?{recommended_id:recommendation.recommended_id,reason:recommendation.reason}:null;init={...init,body:JSON.stringify(b)}}catch{}}
 const r=await prior(input,init);if(url.includes('/api/gemini-plan')){const c=r.clone();c.json().then(d=>{if(r.ok)renderPlanHeader(d)}).catch(()=>{})}return r};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{wrapFetch();bind()});else{wrapFetch();bind()}
})();
</script>`;

async function recommendation(req,res){
 const auth=String(req.headers.authorization||"");if(!auth.startsWith("Bearer "))return json(res,401,{code:"AUTH_REQUIRED"});
 try{const raw=await readBody(req);const r=await fetch(RECOMMENDER,{method:"POST",headers:{"content-type":"application/json",authorization:auth},body:raw||"{}",signal:AbortSignal.timeout(90000)});const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":r.headers.get("content-type")||"application/json; charset=utf-8","cache-control":"no-store","x-multiplan-methodology-recommender":"v1"});res.end(data)}catch(e){json(res,502,{code:"METHODOLOGY_RECOMMENDATION_PROXY_ERROR",message:String(e)})}
}
async function proxy(req,res){
 try{const headers={};for(const n of["content-type","authorization","accept","cookie","user-agent"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);const r=await fetch(CHILD_ORIGIN+(req.url||"/"),init);const type=r.headers.get("content-type")||"application/octet-stream";
 if(req.method==="GET"&&type.includes("text/html")){let html=await r.text();if(html.includes("</body>"))html=html.replace("</body>",PATCH+"</body>");res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-multiplan-methodology-ui":"recommend-before-select-v1"});res.end(html);return}
 const data=Buffer.from(await r.arrayBuffer());const h={"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"};for(const n of["x-multiplan-plan-engine","x-multiplan-safe-fallback","x-multiplan-v65-promotion","x-multiplan-v64-base","x-multiplan-provider-degraded","x-multiplan-result-guard"])if(r.headers.get(n))h[n]=r.headers.get(n);res.writeHead(r.status,h);res.end(data)
 }catch(e){json(res,502,{code:"V0116_PROXY_ERROR",message:String(e)})}
}
http.createServer(async(req,res)=>{if(req.method==="POST"&&req.url==="/api/methodology-recommendation")return recommendation(req,res);if(req.method==="GET"&&req.url==="/v0116-health")return json(res,200,{ok:true,version:"0.11.6",methodologyRecommendation:"API_FIRST",teacherChoice:"AUTHORITATIVE",projectTitle:"API_GENERATED_FROM_SELECTED_METHODOLOGY",child:"v0.11.4-result-guard"});return proxy(req,res)}).listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.11.6 on ${PORT}; methodology recommendation before teacher selection`));
