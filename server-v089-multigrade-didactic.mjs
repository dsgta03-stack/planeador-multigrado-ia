import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V088_CHILD_PORT || 3701);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const MG_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-multigrade-didactic-v2";
const MG_ENABLED = String(process.env.MULTIPLAN_V64_MG_ENABLED || "true").toLowerCase() !== "false";

// V0.8.8 and the complete previous fallback chain remain untouched underneath.
const child = spawn(process.execPath, ["server-v088-multigrade-didactic.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT), MULTIPLAN_V64_MG_ENABLED: "false" },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[mg-v2] v0.8.8 child exited code=${code} signal=${signal}`);
  if (!shuttingDown) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => { shuttingDown = true; try { child.kill(sig); } catch {} process.exit(0); });

function json(res, status, body, headers={}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}
function readBody(req, maxBytes=280000) {
  return new Promise((resolve,reject)=>{ let raw=""; req.on("data",c=>{raw+=c;if(raw.length>maxBytes){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy();}}); req.on("end",()=>resolve(raw)); req.on("error",reject); });
}
async function call(url, raw, authorization, timeout=195000) {
  const r = await fetch(url, { method:"POST", headers:{"content-type":"application/json",authorization}, body:raw||"{}", signal:AbortSignal.timeout(timeout) });
  return { status:r.status, contentType:r.headers.get("content-type")||"application/json; charset=utf-8", data:Buffer.from(await r.arrayBuffer()), engine:r.headers.get("x-multiplan-plan-engine")||"" };
}
function send(res, result, engine, extra={}) {
  res.writeHead(result.status, { "content-type":result.contentType, "cache-control":"no-store", "x-multiplan-plan-engine":engine, ...extra });
  res.end(result.data);
}

async function routePlan(req,res) {
  const authorization=String(req.headers.authorization||"");
  if(!authorization.startsWith("Bearer ")) return json(res,401,{code:"AUTH_REQUIRED"});
  let raw; try{raw=await readBody(req);}catch(e){return json(res,413,{code:"PAYLOAD_TOO_LARGE",message:String(e)});}
  let body; try{body=JSON.parse(raw||"{}");}catch{return json(res,400,{code:"INVALID_JSON"});}
  const grades=[...new Set((Array.isArray(body?.grados)?body.grados:[]).map(Number).filter(Number.isInteger))];
  const multi=grades.length>=2;

  if(MG_ENABLED && multi){
    const started=Date.now();
    try{
      const mg=await call(MG_URL,raw,authorization,195000);
      const elapsed=Date.now()-started;
      if(mg.status<500 && mg.status!==422) return send(res,mg,mg.engine||"V6.4-MULTIGRADE-DIDACTIC-BETA.2",{"x-multiplan-mg-ms":String(elapsed)});
      const fallback=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,110000);
      return send(res,fallback,fallback.engine||"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",{
        "x-multiplan-fallback":"v6.2.1-multigrade-stable",
        "x-multiplan-v64-mg-status":String(mg.status),
        "x-multiplan-mg-ms":String(elapsed),
      });
    }catch(error){
      const elapsed=Date.now()-started;
      try{
        const fallback=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,110000);
        return send(res,fallback,fallback.engine||"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",{
          "x-multiplan-fallback":"v6.2.1-multigrade-network",
          "x-multiplan-mg-error":String(error).slice(0,180),
          "x-multiplan-mg-ms":String(elapsed),
        });
      }catch(fallbackError){ return json(res,502,{code:"V64_MG_V2_AND_FALLBACK_FAILED",message:String(error),fallback:String(fallbackError)}); }
    }
  }
  try{const r=await call(CHILD_ORIGIN+"/api/gemini-plan",raw,authorization,125000);return send(res,r,r.engine||"V6.4-DIDACTIC-EXECUTION-BETA.2");}
  catch(error){return json(res,502,{code:"V089_CHILD_ERROR",message:String(error)});}
}

async function proxy(req,res){try{const headers={};for(const n of ["content-type","authorization","accept","cookie"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);const r=await fetch(CHILD_ORIGIN+req.url,init);const type=r.headers.get("content-type")||"application/octet-stream";if(req.method==="GET"&&req.url==="/"&&type.includes("text/html")){let html=await r.text();html=html.replaceAll("Multiplan · V6.4 didáctico para 1.º–6.º · respaldo estable","Multiplan · V6.4 didáctico 1.º–6.º · enriquecimiento por sesión");res.writeHead(r.status,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});return res.end(html);}const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data);}catch(e){json(res,502,{code:"V088_CHILD_PROXY_ERROR",message:String(e)});}}

const server=http.createServer(async(req,res)=>{
 if(req.method==="GET"&&req.url==="/health"){try{const r=await fetch(CHILD_ORIGIN+"/health");const child=await r.json().catch(()=>({}));return json(res,r.ok?200:503,{ok:r.ok,version:"0.8.9",multigradeEngine:MG_ENABLED?"V6.4-MULTIGRADE-DIDACTIC-BETA.2":"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",multigradeStrategy:"SESSION-WISE-PARALLEL-ENRICHMENT",multigradeFallback:"PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",singleGradeEngine:"V6.4-DIDACTIC-EXECUTION-BETA.2",previousProduction:"server-v088-multigrade-didactic.mjs",child});}catch(e){return json(res,503,{ok:false,version:"0.8.9",code:"V088_CHILD_NOT_READY",message:String(e)});}}
 if(req.method==="POST"&&req.url==="/api/gemini-plan")return routePlan(req,res);
 return proxy(req,res);
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.8.9 multigrade session-wise router on ${PORT}; child v0.8.8 on ${CHILD_PORT}; enabled=${MG_ENABLED}`));
