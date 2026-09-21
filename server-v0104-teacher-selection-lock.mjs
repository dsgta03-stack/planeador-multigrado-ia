import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0102_CHILD_PORT||4801);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;

// V0.10.4 intentionally bypasses V0.10.3.
// Teacher PDA/content selection is authoritative: no automatic PDA completion.
const child=spawn(process.execPath,["server-v0102-gradelock-rescue.mjs"],{
  env:{...process.env,PORT:String(CHILD_PORT)},
  stdio:["ignore","inherit","inherit"]
});
let shuttingDown=false;
child.on("exit",(code,signal)=>{console.error(`[v0104] child v0.10.2 exited code=${code} signal=${signal}`);if(!shuttingDown)setTimeout(()=>process.exit(code||1),50)});
for(const sig of ["SIGTERM","SIGINT"])process.on(sig,()=>{shuttingDown=true;try{child.kill(sig)}catch{}process.exit(0)});

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body))}
function readBody(req,max=420000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}

function teacherSelectionNotice(){return String.raw`
<script>
(() => {
  function install(){
    if(document.getElementById('mpTeacherSelectionPolicy')) return;
    const btn=document.getElementById('continue');
    if(!btn) return;
    const box=document.createElement('div');
    box.id='mpTeacherSelectionPolicy';
    box.className='notice';
    box.style.margin='12px 0';
    box.innerHTML='<b>Selección curricular a cargo del docente</b><br><span class="muted">Multiplan no selecciona PDA ni contenidos automáticamente. Si un grado queda sin PDA seleccionado, continuará dentro del proyecto común con actividades adaptadas a sus características, sin atribuirle un PDA de otro grado.</span>';
    const parent=btn.parentElement;
    if(parent) parent.insertAdjacentElement('beforebegin',box); else btn.insertAdjacentElement('beforebegin',box);
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
      let html=await r.text();
      // Defensive removal in case an old HTML response ever contains the V0.10.3 injected control.
      html=html.replace(/<div id="mpAutoPdaCoverage"[\s\S]*?<\/div>\s*(?=<div class="actions"|<\/section>)/g,"");
      html=html.replace("</body>",teacherSelectionNotice()+"</body>");
      res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
    }
    const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data);
  }catch(e){json(res,502,{code:"V0104_PROXY_ERROR",message:String(e)})}
}

const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/health"){
    try{
      const r=await fetch(CHILD_ORIGIN+"/health");const childHealth=await r.json().catch(()=>({}));
      return json(res,r.ok?200:503,{
        ok:r.ok,
        version:"0.10.4",
        teacherSelectionPolicy:"AUTHORITATIVE_NO_AUTO_PDA",
        missingPdaPolicy:"ADAPT_PROJECT_ACTIVITY_TO_GRADE_WITH_EMPTY_PDA_IDS",
        crossGradePdaPolicy:"FORBIDDEN_GRADE_LOCK",
        autoPdaCoverage:"DISABLED_AND_REMOVED",
        gradeLockRescue:childHealth.gradeLockRescue||"ACTIVE",
        shadowEngine:childHealth.shadowEngine||"V6.5-METHODOLOGY-ENGINE-BETA.7",
        child:childHealth
      });
    }catch(e){return json(res,503,{ok:false,version:"0.10.4",message:String(e)})}
  }
  return proxy(req,res);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.10.4 on ${PORT}; teacher PDA selection authoritative; auto-PDA removed; Grade-Lock child v0.10.2 on ${CHILD_PORT}`));
