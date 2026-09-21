import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0104_CHILD_PORT||4901);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;

const child=spawn(process.execPath,["server-v0104-teacher-selection-lock.mjs"],{
  env:{...process.env,PORT:String(CHILD_PORT)},
  stdio:["ignore","inherit","inherit"]
});
let shuttingDown=false;
child.on("exit",(code,signal)=>{console.error(`[v0105] child v0.10.4 exited code=${code} signal=${signal}`);if(!shuttingDown)setTimeout(()=>process.exit(code||1),50)});
for(const sig of ["SIGTERM","SIGINT"])process.on(sig,()=>{shuttingDown=true;try{child.kill(sig)}catch{}process.exit(0)});

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body))}
function readBody(req,max=430000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}

function zeroPdaScript(){return String.raw`
<script>
(() => {
  function selectedValues(){try{return Object.values(state?.selected||{}).filter(v=>v&&String(v.pda_id||'').trim());}catch{return [];}}
  function addZeroNotice(){
    const summary=document.getElementById('summary');
    if(!summary||selectedValues().length)return;
    if(document.getElementById('mpZeroPdaNotice'))return;
    summary.insertAdjacentHTML('beforeend','<div id="mpZeroPdaNotice" class="notice"><b>Proyecto sin PDA seleccionado</b><br><span class="muted">Es una decisión válida del docente. Los grados participarán mediante actividades transversales adaptadas al proyecto y a sus características, sin atribuirles contenidos o PDA no seleccionados.</span></div>');
  }
  function unlockContinue(){
    const btn=document.getElementById('continue');
    if(btn && typeof state!=='undefined' && state.data && Array.isArray(state.grades) && state.grades.length) btn.disabled=false;
    addZeroNotice();
  }
  function install(){
    const oldDraw=(typeof window.drawSummary==='function'?window.drawSummary:(typeof drawSummary==='function'?drawSummary:null));
    if(oldDraw&&!oldDraw.__mpZeroPdaWrapped){
      const next=function(...args){const r=oldDraw.apply(this,args);unlockContinue();return r};
      next.__mpZeroPdaWrapped=true;window.drawSummary=next;try{drawSummary=next}catch{}
    }
    const oldBuild=(typeof window.buildPlan==='function'?window.buildPlan:(typeof buildPlan==='function'?buildPlan:null));
    const oldApply=(typeof window.applyPlanSupport==='function'?window.applyPlanSupport:(typeof applyPlanSupport==='function'?applyPlanSupport:null));
    if(oldBuild&&oldApply&&!oldBuild.__mpZeroPdaWrapped){
      const next=async function(...args){
        const empty=selectedValues().length===0;
        if(!empty)return oldBuild.apply(this,args);
        await oldBuild.apply(this,args);
        const key='__mp_zero_pda_sentinel__';
        state.selected=state.selected||{};
        state.selected[key]={pda_id:'',grade:-999,content_official:'',pda_official:'',field:''};
        let promise;
        try{promise=oldApply();}finally{delete state.selected[key];}
        return await promise;
      };
      next.__mpZeroPdaWrapped=true;window.buildPlan=next;try{buildPlan=next}catch{}
      const c=document.getElementById('continue'),r=document.getElementById('rebuild');if(c)c.onclick=next;if(r)r.onclick=next;
    }
    unlockContinue();
    const results=document.getElementById('results');if(results)new MutationObserver(()=>unlockContinue()).observe(results,{childList:true,subtree:true});
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
      let html=await r.text();html=html.replace("</body>",zeroPdaScript()+"</body>");
      res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
    }
    const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data);
  }catch(e){json(res,502,{code:"V0105_PROXY_ERROR",message:String(e)})}
}

const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/health"){
    try{const r=await fetch(CHILD_ORIGIN+"/health");const childHealth=await r.json().catch(()=>({}));return json(res,r.ok?200:503,{ok:r.ok,version:"0.10.5",teacherSelectionPolicy:"AUTHORITATIVE_NO_AUTO_PDA",zeroPdaPlanning:"SUPPORTED",missingPdaPolicy:"TRANSVERSAL_PROJECT_ADAPTATION_ONLY",crossGradePdaPolicy:"FORBIDDEN",stableEnginePatch:"V6.2.1 function v12 teacher-selection-lock",didacticEnginePatch:"V6.4 Beta.5 function v2 teacher-selection-lock",shadowEngine:childHealth.shadowEngine||"V6.5-METHODOLOGY-ENGINE-BETA.7",child:childHealth})}catch(e){return json(res,503,{ok:false,version:"0.10.5",message:String(e)})}
  }
  return proxy(req,res);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.10.5 on ${PORT}; zero-PDA planning supported; child v0.10.4 on ${CHILD_PORT}`));
