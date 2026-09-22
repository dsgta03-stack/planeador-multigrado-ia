import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_UI_CHILD_PORT||5801);
const ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;

// UI-only layer over v0.11.4. No planning logic, payloads, routes or engine rules are changed.
const child=spawn(process.execPath,["server-v0114-ui-professional-v2.mjs"],{env:{...process.env,PORT:String(CHILD_PORT)},stdio:["ignore","inherit","inherit"]});
let stopping=false;
child.on("exit",(c,s)=>{console.error(`[ui-v0115] child exited code=${c} signal=${s}`);if(!stopping)setTimeout(()=>process.exit(c||1),50)});
for(const sig of["SIGTERM","SIGINT"])process.on(sig,()=>{stopping=true;try{child.kill(sig)}catch{}process.exit(0)});

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body))}
function read(req,max=520000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}

const CSS=String.raw`<style id="multiplan-pda-ltg-ui">
#results{position:relative;overflow:visible!important}
#results>h2{margin-bottom:5px!important}
#results>h2+div.notice{margin-top:10px!important;background:linear-gradient(90deg,#f3f8ff,#f7fbff)!important;border-color:#d9e7f5!important;color:#42617f!important}
#results.mpPdaReady{padding-top:22px!important}
.mpPdaIntro{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(250px,.6fr);gap:14px;margin:4px 0 16px}
.mpPdaIntroMain,.mpPdaStatusCard{border:1px solid #dfe7f0;border-radius:14px;background:#fbfdff;padding:15px 16px}
.mpPdaIntroMain strong{display:block;color:#183d60;font-size:14px;margin-bottom:5px}.mpPdaIntroMain span{display:block;color:#718196;font-size:12px;line-height:1.5}
.mpPdaStatusCard{display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(135deg,#f4f9ff,#effaf7)}
.mpPdaStatusCard small{display:block;color:#718196;font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:800}.mpPdaStatusCard b{display:block;color:#173f63;font-size:22px;margin-top:2px}.mpPdaStatusBadge{white-space:nowrap;border-radius:999px;padding:6px 9px;background:#e9f5ef;color:#247a53;border:1px solid #cde9d9;font-size:10px;font-weight:850}
#tabs{margin:2px 0 14px!important;padding:6px!important;background:#f5f8fc;border:1px solid #e1e8f0;border-radius:13px;gap:6px!important;position:sticky;top:74px;z-index:21;box-shadow:0 8px 18px rgba(20,54,89,.05)}
#tabs .tab{min-width:76px!important;padding:9px 12px!important;box-shadow:none!important}
#list{display:grid;gap:12px}
#list .candidate{margin:0!important;padding:17px!important;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease;background:#fff!important}
#list .candidate:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(20,54,89,.075)!important;border-color:#cbd9e7!important}
#list .candidate.sel{background:linear-gradient(180deg,#ffffff,#fbfffd)!important}
#list .candidate .head{align-items:flex-start!important;gap:14px!important}
#list .candidate .head>div:first-child{min-width:0;flex:1}
#list .candidate h3{margin:9px 0 7px!important;font-size:15px!important;line-height:1.45!important;color:#183650!important}
#list .candidate p{margin:7px 0 10px!important;color:#5f7184!important;line-height:1.55!important;font-size:13px!important}
#list .candidate .meta{gap:6px!important}.chip{background:#f8fafc!important;border-color:#dce5ee!important;color:#60748a!important}.chip.good{background:#edf8f2!important;border-color:#cce6d6!important;color:#247a53!important}.chip.mid{background:#fff8e8!important;border-color:#ead9aa!important;color:#8a6317!important}
#list .candidate .head button{min-width:104px!important}
#list .project{margin-top:13px!important;padding:13px 14px!important;border:1px solid #dbe7f1!important;border-left:4px solid #16b7a4!important;border-radius:12px!important;background:linear-gradient(90deg,#f7fcfb,#fbfdff)!important}
#list .project>strong{display:block;color:#17665b;font-size:12px;margin-bottom:8px}
#list .project label{padding:8px 9px;border-radius:9px;background:#fff;border:1px solid #e2e9f0;margin-top:6px!important;cursor:pointer}
#list .project label:hover{border-color:#bfd9d4;background:#fbfffe}.project input[type=radio]{width:auto!important;margin-right:7px!important;accent-color:#16a28f}
#summary{position:relative;margin-top:14px!important;border-radius:14px!important;padding:16px!important;background:linear-gradient(135deg,#f6faff,#f3fbf8)!important}
#summary strong{color:#1e4669!important}.mpSelectionHint{display:flex;gap:8px;align-items:flex-start;margin-top:10px;padding:10px 11px;border-radius:10px;background:#fff;border:1px solid #e1e8f0;color:#65798e;font-size:11px;line-height:1.45}.mpSelectionHint b{color:#315e86}
#results .actions{position:sticky;bottom:12px;z-index:22;padding:11px 12px;margin-top:14px!important;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border:1px solid #dfe7f0;border-radius:13px;box-shadow:0 10px 26px rgba(20,54,89,.10)}
#continue{min-width:210px}.mpPdaLegend{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 12px}.mpLegendItem{font-size:10px;padding:5px 8px;border-radius:999px;border:1px solid #dde6ef;background:#fff;color:#60748a}.mpLegendItem.high{border-color:#cce6d6;background:#edf8f2;color:#247a53}.mpLegendItem.mid{border-color:#ead9aa;background:#fff8e8;color:#8a6317}.mpLegendItem.ltg{border-color:#cbe9e4;background:#ecfaf7;color:#16796c}
@media(max-width:850px){.mpPdaIntro{grid-template-columns:1fr}.mpPdaStatusCard{align-items:flex-end}#tabs{top:8px;overflow-x:auto;flex-wrap:nowrap!important}#tabs .tab{flex:0 0 auto}#list .candidate .head{flex-direction:column!important}#list .candidate .head button{width:100%!important}#results .actions{bottom:6px}#continue{width:100%!important}}
</style>`;

const SCRIPT=String.raw`<script id="multiplan-pda-ltg-script">(()=>{
function escUi(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function selectedTotal(){try{return Object.keys(state?.selected||{}).length}catch{return 0}}
function selectedGrades(){try{const a=[...new Set(Object.values(state?.selected||{}).map(v=>Number(v?.grade)).filter(Number.isFinite))];return a.sort((x,y)=>x-y)}catch{return[]}}
function updateStatus(){const n=selectedTotal(),grades=selectedGrades(),b=document.getElementById('mpPdaCount'),badge=document.getElementById('mpPdaBadge');if(b)b.textContent=n;if(badge){badge.textContent=n?`${grades.length} grado${grades.length===1?'':'s'} con selección`:'Sin selección';badge.style.opacity=n?'1':'.72'}const summary=document.getElementById('summary');if(summary&&!summary.querySelector('.mpSelectionHint')){const hint=document.createElement('div');hint.className='mpSelectionHint';hint.innerHTML='<span>✓</span><div><b>Decisión docente:</b> puedes elegir hasta 4 PDA por grado y la vinculación LTG sigue siendo opcional. Esta interfaz no cambia esas reglas.</div>';summary.appendChild(hint)}}
function decorate(){const results=document.getElementById('results');if(!results||results.classList.contains('mpPdaReady'))return;results.classList.add('mpPdaReady');const h2=results.querySelector('h2');if(h2)h2.textContent='2. Selección curricular: PDA y LTG';const intro=document.createElement('div');intro.className='mpPdaIntro';intro.innerHTML='<div class="mpPdaIntroMain"><strong>Selecciona solo lo que realmente vas a trabajar</strong><span>Revisa la pertinencia por grado, conserva la decisión docente y vincula un proyecto LTG únicamente cuando aporte al propósito de la planeación.</span></div><div class="mpPdaStatusCard"><div><small>PDA seleccionados</small><b id="mpPdaCount">0</b></div><span class="mpPdaStatusBadge" id="mpPdaBadge">Sin selección</span></div>';if(h2)h2.insertAdjacentElement('afterend',intro);const legend=document.createElement('div');legend.className='mpPdaLegend';legend.innerHTML='<span class="mpLegendItem high">Pertinencia alta</span><span class="mpLegendItem mid">Pertinencia media</span><span class="mpLegendItem ltg">LTG opcional vinculado</span><span class="mpLegendItem">Máximo 4 PDA por grado</span>';const tabs=document.getElementById('tabs');if(tabs)tabs.insertAdjacentElement('beforebegin',legend);updateStatus();const observer=new MutationObserver(()=>updateStatus());observer.observe(results,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled','checked']});results.addEventListener('click',()=>setTimeout(updateStatus,0));results.addEventListener('change',()=>setTimeout(updateStatus,0))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorate);else decorate();
})();</script>`;

async function proxy(req,res){try{const h={};for(const n of["content-type","authorization","accept","cookie"])if(req.headers[n])h[n]=req.headers[n];const init={method:req.method,headers:h};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await read(req);const r=await fetch(ORIGIN+req.url,init);const type=r.headers.get("content-type")||"application/octet-stream";if(req.method==="GET"&&(req.url==="/"||req.url.startsWith("/?"))&&type.includes("text/html")){let html=await r.text();html=html.replace("</head>",CSS+"</head>").replace("</body>",SCRIPT+"</body>");res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-multiplan-ui":"professional-v3-pda-ltg"});res.end(html);return}const data=Buffer.from(await r.arrayBuffer());const out={"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"};const engine=r.headers.get("x-multiplan-plan-engine");if(engine)out["x-multiplan-plan-engine"]=engine;res.writeHead(r.status,out);res.end(data)}catch(e){json(res,502,{code:"UI_V0115_PROXY_ERROR",message:String(e)})}}

const server=http.createServer(async(req,res)=>{if(req.method==="GET"&&req.url==="/ui-health")return json(res,200,{ok:true,version:"0.11.5-ui-beta",ui:"PROFESSIONAL-PDA-LTG-V1",base:"0.11.4-ui",productionModified:false,backendBehaviorModified:false});return proxy(req,res)});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan UI v0.11.5 on ${PORT}; PDA/LTG visual layer active; child ${CHILD_PORT}`));
