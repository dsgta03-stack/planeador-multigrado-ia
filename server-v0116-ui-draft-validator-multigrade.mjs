import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_UI_CHILD_PORT||5901);
const ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;

// UI-only layer over v0.11.5. Existing planning logic, IDs, actions, API payloads and engine rules remain untouched.
const child=spawn(process.execPath,["server-v0115-ui-pda-ltg.mjs"],{env:{...process.env,PORT:String(CHILD_PORT)},stdio:["ignore","inherit","inherit"]});
let stopping=false;
child.on("exit",(c,s)=>{console.error(`[ui-v0116] child exited code=${c} signal=${s}`);if(!stopping)setTimeout(()=>process.exit(c||1),50)});
for(const sig of["SIGTERM","SIGINT"])process.on(sig,()=>{stopping=true;try{child.kill(sig)}catch{}process.exit(0)});

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body))}
function read(req,max=520000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}

const CSS=String.raw`<style id="multiplan-review-ui">
#plan{position:relative;overflow:visible!important}
#plan.mpReviewReady{padding-top:22px!important}
.mpReviewIntro{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(260px,.55fr);gap:14px;margin:4px 0 16px}
.mpReviewMain,.mpReviewStatus{border:1px solid #dfe7f0;border-radius:14px;background:#fbfdff;padding:15px 16px}
.mpReviewMain strong{display:block;color:#183d60;font-size:14px;margin-bottom:5px}.mpReviewMain span{display:block;color:#718196;font-size:12px;line-height:1.5}
.mpReviewStatus{background:linear-gradient(135deg,#f4f9ff,#f2fbf8);display:flex;align-items:center;justify-content:space-between;gap:12px}.mpReviewStatus small{display:block;color:#718196;font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:800}.mpReviewStatus b{display:block;margin-top:2px;color:#173f63;font-size:20px}.mpReviewBadge{padding:6px 9px;border-radius:999px;border:1px solid #d2e6d9;background:#edf8f2;color:#267654;font-size:10px;font-weight:850;white-space:nowrap}
.mpReviewNav{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 14px;padding:7px;background:#f5f8fc;border:1px solid #e1e8f0;border-radius:13px;position:sticky;top:74px;z-index:20;box-shadow:0 8px 18px rgba(20,54,89,.05)}.mpReviewNav a{padding:7px 10px;border-radius:9px;text-decoration:none;background:#fff;border:1px solid #dbe5ef;color:#46617d;font-size:10px;font-weight:800}.mpReviewNav a:hover{border-color:#b8cee4;background:#f9fcff}
#diagnosis,#question,#selectedPlan,#axes,#ltgPlan,#organization,#sessionsPlan,#evaluation,#supportsPlan{scroll-margin-top:145px}
#diagnosis,#question,#selectedPlan,#axes,#ltgPlan,#organization,#sessionsPlan,#evaluation,#supportsPlan{position:relative}
#diagnosis:before,#question:before,#selectedPlan:before,#axes:before,#ltgPlan:before,#organization:before,#sessionsPlan:before,#evaluation:before,#supportsPlan:before{content:"";position:absolute;left:-12px;top:2px;width:4px;height:20px;border-radius:99px;background:linear-gradient(180deg,#176fe5,#16b7a4);opacity:.8}
#plan .section{padding:16px 0!important}
#plan .section>h3,#plan .section>strong:first-child{color:#173d60!important}
#organization{background:linear-gradient(135deg,#f8fbff,#f4fbf8)!important;border:1px solid #dfe8f1!important;border-radius:14px!important;padding:15px!important;margin-top:8px!important}
#sessionsPlan .gradeBlock,#organization .gradeBlock{border-radius:13px!important;background:#fff!important;box-shadow:0 5px 14px rgba(20,54,89,.04)!important}
#sessionsPlan{display:grid;gap:12px}
#sessionsPlan .session,#sessionsPlan article,#sessionsPlan>div{border-radius:13px!important}
#evaluation{background:#fbfdff!important;border:1px solid #e0e9f2!important;border-radius:14px!important;padding:15px!important;margin-top:8px!important}
#supportsPlan{background:#fffdf8!important;border:1px solid #eee3c7!important;border-radius:14px!important;padding:15px!important;margin-top:8px!important}
#status,#checks,#warnings{border-radius:13px!important}
#checks{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
#checks>div{padding:10px 11px!important;border-radius:10px!important;min-height:48px!important;display:flex!important;align-items:center!important}
#warnings{background:#fffaf0!important;border-color:#ead9aa!important}
.mpReviewLegend{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 12px}.mpReviewLegend span{padding:5px 8px;border-radius:999px;border:1px solid #dde6ef;background:#fff;color:#60748a;font-size:10px}.mpReviewLegend .ok{background:#edf8f2;border-color:#cce6d6;color:#247a53}.mpReviewLegend .warn{background:#fff8e8;border-color:#ead9aa;color:#8a6317}.mpReviewLegend .multi{background:#edf6ff;border-color:#cfe1f4;color:#2c628f}
#plan .actions{position:sticky;bottom:12px;z-index:22;padding:11px 12px!important;margin-top:14px!important;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border:1px solid #dfe7f0;border-radius:13px;box-shadow:0 10px 26px rgba(20,54,89,.10)}
#back,#rebuild{min-height:42px!important}
.mpReviewHint{margin-top:12px;padding:11px 12px;border-radius:11px;border:1px solid #dfe7f0;background:#f8fbff;color:#62778b;font-size:11px;line-height:1.5}.mpReviewHint b{color:#315e86}
@media(max-width:850px){.mpReviewIntro{grid-template-columns:1fr}.mpReviewNav{top:8px;overflow-x:auto;flex-wrap:nowrap}.mpReviewNav a{flex:0 0 auto}#checks{grid-template-columns:1fr!important}#plan .actions{bottom:6px}#back,#rebuild{width:100%!important}}
</style>`;

const SCRIPT=String.raw`<script id="multiplan-review-script">(()=>{
function txt(el){return (el?.textContent||'').trim()}
function sectionExists(id){const el=document.getElementById(id);return !!(el&&txt(el))}
function decorate(){const plan=document.getElementById('plan');if(!plan||plan.classList.contains('mpReviewReady'))return;plan.classList.add('mpReviewReady');const h2=plan.querySelector('h2');if(h2)h2.textContent='3. Borrador, validación y organización multigrado';const intro=document.createElement('div');intro.className='mpReviewIntro';intro.innerHTML='<div class="mpReviewMain"><strong>Revisa antes de llevar la planeación al aula</strong><span>Comprueba el diagnóstico, la pregunta guía, la selección curricular, la organización multigrado, las sesiones, la evaluación y los apoyos. Esta capa solo ordena visualmente la información que ya genera Multiplan.</span></div><div class="mpReviewStatus"><div><small>Estado de revisión</small><b id="mpReviewCount">0/9 bloques</b></div><span class="mpReviewBadge" id="mpReviewBadge">En revisión</span></div>';if(h2)h2.insertAdjacentElement('afterend',intro);const nav=document.createElement('nav');nav.className='mpReviewNav';nav.innerHTML='<a href="#diagnosis">Diagnóstico</a><a href="#question">Pregunta guía</a><a href="#selectedPlan">PDA</a><a href="#ltgPlan">LTG</a><a href="#organization">Multigrado</a><a href="#sessionsPlan">Sesiones</a><a href="#evaluation">Evaluación</a><a href="#supportsPlan">Apoyos</a><a href="#checks">Validador</a>';intro.insertAdjacentElement('afterend',nav);const legend=document.createElement('div');legend.className='mpReviewLegend';legend.innerHTML='<span class="ok">Bloque completo</span><span class="multi">Organización multigrado</span><span class="warn">Advertencias del sistema</span><span>Motor intacto</span>';nav.insertAdjacentElement('afterend',legend);const ids=['diagnosis','question','selectedPlan','axes','ltgPlan','organization','sessionsPlan','evaluation','supportsPlan'];const update=()=>{const done=ids.filter(sectionExists).length;const c=document.getElementById('mpReviewCount'),b=document.getElementById('mpReviewBadge');if(c)c.textContent=`${done}/9 bloques`;if(b){b.textContent=done>=8?'Revisión casi completa':done>=5?'Avance medio':'En revisión';b.style.opacity=done?'1':'.72'}const checks=document.getElementById('checks');if(checks&&!checks.parentElement.querySelector('.mpReviewHint')){const hint=document.createElement('div');hint.className='mpReviewHint';hint.innerHTML='<b>Cómo leer esta revisión:</b> los validadores y advertencias siguen siendo los originales del sistema. La interfaz únicamente los agrupa para que puedas detectar con rapidez qué parte requiere atención.';checks.parentElement.appendChild(hint)}};update();const obs=new MutationObserver(()=>update());obs.observe(plan,{subtree:true,childList:true,characterData:true});plan.addEventListener('click',()=>setTimeout(update,0));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate);else decorate();
})();</script>`;

async function proxy(req,res){try{const h={};for(const n of["content-type","authorization","accept","cookie"])if(req.headers[n])h[n]=req.headers[n];const init={method:req.method,headers:h};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await read(req);const r=await fetch(ORIGIN+req.url,init);const type=r.headers.get("content-type")||"application/octet-stream";if(req.method==="GET"&&(req.url==="/"||req.url.startsWith("/?"))&&type.includes("text/html")){let html=await r.text();html=html.replace("</head>",CSS+"</head>").replace("</body>",SCRIPT+"</body>");res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-multiplan-ui":"professional-v4-review"});res.end(html);return}const data=Buffer.from(await r.arrayBuffer());const out={"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"};for(const name of["x-multiplan-plan-engine","x-multiplan-safe-fallback","x-multiplan-v65-shadow"]) {const v=r.headers.get(name);if(v)out[name]=v;}res.writeHead(r.status,out);res.end(data)}catch(e){json(res,502,{code:"UI_V0116_PROXY_ERROR",message:String(e)})}}

const server=http.createServer(async(req,res)=>{if(req.method==="GET"&&req.url==="/ui-health")return json(res,200,{ok:true,version:"0.11.6-ui-beta",ui:"PROFESSIONAL-REVIEW-MULTIGRADE-V1",base:"0.11.5-ui",productionModified:false,backendBehaviorModified:false});return proxy(req,res)});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan UI v0.11.6 on ${PORT}; review/multigrade visual layer active; child ${CHILD_PORT}`));
