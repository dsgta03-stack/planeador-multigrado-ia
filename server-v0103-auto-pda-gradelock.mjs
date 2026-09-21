import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0102_CHILD_PORT||4801);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;

const child=spawn(process.execPath,["server-v0102-gradelock-rescue.mjs"],{env:{...process.env,PORT:String(CHILD_PORT)},stdio:["ignore","inherit","inherit"]});
let shuttingDown=false;
child.on("exit",(code,signal)=>{console.error(`[v0103] child v0.10.2 exited code=${code} signal=${signal}`);if(!shuttingDown)setTimeout(()=>process.exit(code||1),50)});
for(const sig of ["SIGTERM","SIGINT"])process.on(sig,()=>{shuttingDown=true;try{child.kill(sig)}catch{}process.exit(0)});

function json(res,status,body,headers={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers});res.end(JSON.stringify(body))}
function readBody(req,max=420000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}

function autoPdaScript(){return String.raw`
<script>
(() => {
  function ensureControl(){
    if(document.getElementById('mpAutoPdaCoverage')) return;
    const btn=document.getElementById('continue');
    if(!btn) return;
    const box=document.createElement('div');
    box.id='mpAutoPdaCoverage';
    box.className='notice';
    box.style.margin='12px 0';
    box.innerHTML='<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input id="mpAutoPdaCoverageCheck" type="checkbox" checked style="margin-top:3px"><span><b>Completar automáticamente PDA faltantes por grado</b><br><span class="muted">Si un grado seleccionado quedó sin PDA, Multiplan usará el candidato oficial marcado como RECOMENDADO con mayor pertinencia. Puedes desactivar esta opción si deseas hacer toda la selección manualmente.</span></span></label><div id="mpAutoPdaCoverageStatus" class="muted" style="margin-top:6px"></div>';
    const parent=btn.parentElement;
    if(parent) parent.insertAdjacentElement('beforebegin',box); else btn.insertAdjacentElement('beforebegin',box);
  }

  function autoFillMissingPda(){
    const check=document.getElementById('mpAutoPdaCoverageCheck');
    if(check && !check.checked) return [];
    if(typeof state==='undefined' || !Array.isArray(state.grades) || !state.data?.candidatesByGrade) return [];
    state.selected=state.selected||{};
    const selected=()=>Object.values(state.selected||{});
    const added=[];
    for(const g of state.grades){
      if(selected().some(v=>Number(v?.grade)===Number(g))) continue;
      const rows=Array.isArray(state.data.candidatesByGrade[g])?state.data.candidatesByGrade[g]:[];
      const recommended=rows.filter(r=>r?.recommendation_status==='RECOMENDADO').sort((a,b)=>Number(b?.absolute_relevance||0)-Number(a?.absolute_relevance||0));
      const row=recommended[0]||null;
      if(row?.pda_id){state.selected[row.pda_id]=row;added.push(row);}
    }
    const status=document.getElementById('mpAutoPdaCoverageStatus');
    if(status){
      if(added.length) status.textContent='Selección automática aplicada: '+added.map(x=>x.grade+'.º · '+x.pda_id).join(' | ');
      else status.textContent='Todos los grados ya tienen PDA seleccionado o no existe un candidato recomendado adicional.';
    }
    try{if(typeof drawTabs==='function')drawTabs();if(typeof drawList==='function')drawList();if(typeof drawSummary==='function')drawSummary();}catch{}
    return added;
  }

  function install(){
    ensureControl();
    const current=window.buildPlan;
    if(typeof current!=='function'||current.__mpAutoPdaWrapped) return;
    const wrapped=async function(...args){autoFillMissingPda();return current.apply(this,args)};
    wrapped.__mpAutoPdaWrapped=true;
    window.buildPlan=wrapped;
    try{buildPlan=wrapped}catch{}
    const c=document.getElementById('continue'),r=document.getElementById('rebuild');
    if(c)c.onclick=wrapped;if(r)r.onclick=wrapped;
    window.MultiplanAutoPda={fill:autoFillMissingPda};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
</script>`}

async function proxy(req,res){
  try{
    const headers={};for(const n of["content-type","authorization","accept","cookie"])if(req.headers[n])headers[n]=req.headers[n];
    const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);
    const r=await fetch(CHILD_ORIGIN+req.url,init);
    const type=r.headers.get("content-type")||"application/octet-stream";
    if(req.method==="GET"&&req.url==="/"&&type.includes("text/html")){
      let html=await r.text();html=html.replace("</body>",autoPdaScript()+"</body>");
      res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
    }
    const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data);
  }catch(e){json(res,502,{code:"V0103_PROXY_ERROR",message:String(e)})}
}

const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/health"){
    try{const r=await fetch(CHILD_ORIGIN+"/health");const childHealth=await r.json().catch(()=>({}));return json(res,r.ok?200:503,{ok:r.ok,version:"0.10.3",autoPdaCoverage:"ENABLED_DEFAULT_OPT_OUT",autoPdaPolicy:"ONE_HIGHEST_RECOMMENDED_OFFICIAL_PDA_FOR_EACH_SELECTED_GRADE_WITHOUT_MANUAL_SELECTION",gradeLockRescue:childHealth.gradeLockRescue||"ACTIVE",shadowEngine:childHealth.shadowEngine||"V6.5-METHODOLOGY-ENGINE-BETA.7",child:childHealth})}catch(e){return json(res,503,{ok:false,version:"0.10.3",message:String(e)})}
  }
  return proxy(req,res);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.10.3 on ${PORT}; child v0.10.2 on ${CHILD_PORT}; auto-PDA coverage enabled`));
