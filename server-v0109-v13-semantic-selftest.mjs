import http from "node:http";
import { spawn } from "node:child_process";

const PORT=Number(process.env.PORT||3000);
const CHILD_PORT=Number(process.env.MULTIPLAN_V0108_CHILD_PORT||5301);
const CHILD_ORIGIN=`http://127.0.0.1:${CHILD_PORT}`;
const TEST_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/multiplan-v13-semantic-regression";
const ANON=String(process.env.MULTIPLAN_SELFTEST_ANON||"");
const TEST_KEY=String(process.env.MULTIPLAN_SELFTEST_KEY||"");
let selftest={status:"PENDING",ran:false,results:null,error:null};

const child=spawn(process.execPath,["server-v0108-grade-trace-render.mjs"],{env:{...process.env,PORT:String(CHILD_PORT)},stdio:["ignore","inherit","inherit"]});
let shuttingDown=false;
child.on("exit",(c,s)=>{console.error(`[v0109] child v0.10.8 exited code=${c} signal=${s}`);if(!shuttingDown)setTimeout(()=>process.exit(c||1),50)});
for(const sig of["SIGTERM","SIGINT"])process.on(sig,()=>{shuttingDown=true;try{child.kill(sig)}catch{}process.exit(0)});
function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body))}
function readBody(req,max=520000){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});req.on("end",()=>resolve(raw));req.on("error",reject)})}
async function proxy(req,res){try{const headers={};for(const n of["content-type","authorization","accept","cookie"])if(req.headers[n])headers[n]=req.headers[n];const init={method:req.method,headers};if(req.method!=="GET"&&req.method!=="HEAD")init.body=await readBody(req);const r=await fetch(CHILD_ORIGIN+req.url,init);const type=r.headers.get("content-type")||"application/octet-stream";const data=Buffer.from(await r.arrayBuffer());res.writeHead(r.status,{"content-type":type,"cache-control":r.headers.get("cache-control")||"no-store"});res.end(data)}catch(e){json(res,502,{code:"V0109_PROXY_ERROR",message:String(e)})}}
async function runSelftest(){if(!ANON||!TEST_KEY){selftest={status:"SKIPPED",ran:false,results:null,error:"MISSING_SELFTEST_ENV"};console.error(JSON.stringify({event:"v13_semantic_regression",...selftest}));return}try{const started=Date.now();const r=await fetch(TEST_URL,{method:"POST",headers:{"content-type":"application/json","apikey":ANON,"authorization":`Bearer ${ANON}`,"x-test-key":TEST_KEY},body:"{}",signal:AbortSignal.timeout(570000)});const text=await r.text();let out=null;try{out=JSON.parse(text)}catch{}selftest={status:r.ok&&out?.status==="PASS"?"PASS":"FAIL",ran:true,results:out,error:r.ok?null:`HTTP_${r.status}`};console.log(JSON.stringify({event:"v13_semantic_regression",status:selftest.status,http_status:r.status,elapsed_ms:Date.now()-started,suite:out?.suite||null,cases:Array.isArray(out?.results)?out.results.map(x=>({id:x.id,status:x.status,audit_status:x.audit_status,lexical_food_hits:x.lexical_food_hits,issues:(x.issues||[]).length})):null,error:selftest.error}))}catch(e){selftest={status:"ERROR",ran:true,results:null,error:String(e)};console.error(JSON.stringify({event:"v13_semantic_regression",status:"ERROR",error:String(e).slice(0,500)}))}}
setTimeout(()=>void runSelftest(),5000);
const server=http.createServer(async(req,res)=>{if(req.method==="GET"&&req.url==="/health"){try{const r=await fetch(CHILD_ORIGIN+"/health");const c=await r.json().catch(()=>({}));return json(res,r.ok?200:503,{ok:r.ok,version:"0.10.9-test",stableSemanticIsolation:"V6.2.1-v13: isolated transversal generation + AI semantic audit + one repair",transversalCompatibility:"TRANSVERSAL-LOCK-V2.1-V13",visibleMultigradePrimary:c.visibleMultigradePrimary||"V6.4-MULTIGRADE-DIDACTIC-BETA.6-TRANSVERSAL-LOCK",gradeTraceRenderer:"GRADE-TASK-TRACE-V1",teacherSelectionPolicy:"AUTHORITATIVE_NO_AUTO_PDA",selftest:{status:selftest.status,ran:selftest.ran,error:selftest.error},child:c})}catch(e){return json(res,503,{ok:false,version:"0.10.9-test",message:String(e)})}}return proxy(req,res)});
server.listen(PORT,"0.0.0.0",()=>console.log(`Multiplan v0.10.9-test on ${PORT}; one-shot V13 semantic regression; child v0.10.8 on ${CHILD_PORT}`));