import http from "node:http";
import { CONSOLIDATED_UI_HTML, CONSOLIDATED_UI_VERSION } from "./ui/assembled-ui.mjs";
import { createUnifiedPreviewServerRoute, UNIFIED_PREVIEW_SERVER_ROUTE_VERSION } from "../v0125/unified-preview-server-route.mjs";
import { createCanonicalReviewServerRoute, createCanonicalDocxServerRoute } from "../v0125/canonical-plan-server-routes.mjs";
import { createCertifiedServerRoute } from "../v0124/certified-server-route.mjs";
import { createCanonicalHistoryHandlers } from "./history-routes.mjs";
import { createEdgeFunctionProxy } from "./edge-function-proxy.mjs";

export const CONSOLIDATED_SERVER_VERSION = "SINGLE_APP_SERVER_R1";

function defaultJson(res,status,body,extra={}){
  res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra});
  res.end(JSON.stringify(body));
}
function readBody(req,max=2_500_000){
  return new Promise((resolve,reject)=>{
    let raw="";
    req.on("data",c=>{raw+=c;if(raw.length>max){reject(new Error("PAYLOAD_TOO_LARGE"));req.destroy()}});
    req.on("end",()=>resolve(raw));
    req.on("error",reject);
  });
}
function bearer(req){
  const v=String(req.headers.authorization||"");
  return v.startsWith("Bearer ")?v:"";
}
function historyRunId(pathname){
  return pathname.match(/^\/api\/history\/([0-9a-f-]{36})$/i)?.[1]||"";
}

export function createConsolidatedServer({env=process.env,fetchImpl=fetch}={}){
  const json=defaultJson;
  const enabledEnv={...env,MULTIPLAN_V0125_UNIFIED_PREVIEW_ENABLED:"1"};

  const canonicalRoute=createUnifiedPreviewServerRoute({
    env:enabledEnv,readBody,bearer,json,fetchImpl
  });

  const legacyJson=(res,status,body,extra={})=>{
    if(status===200&&body?.status==="READY_FOR_TEACHER"&&body?.renderable===true&&body?.plan&&body?.canonical_plan_hash){
      return json(res,200,body.plan,{
        ...extra,
        "x-multiplan-canonical-plan-hash":body.canonical_plan_hash,
        "x-multiplan-generation":"CANONICAL_SINGLE_APP_R1",
        "x-multiplan-snapshot-status":body?.snapshot_persistence?.status||"UNKNOWN",
      });
    }
    return json(res,status,body,extra);
  };
  const legacyGenerationRoute=createUnifiedPreviewServerRoute({
    env:enabledEnv,readBody,bearer,json:legacyJson,fetchImpl
  });

  const canonicalReviewRoute=createCanonicalReviewServerRoute({readBody,bearer,json,fetchImpl});
  const canonicalDocxRoute=createCanonicalDocxServerRoute({readBody,json});
  const certifiedRoute=createCertifiedServerRoute({env:enabledEnv,readBody,bearer,json,fetchImpl});
  const history=createCanonicalHistoryHandlers({env:enabledEnv,fetchImpl,bearer,json});
  const edgeProxy=createEdgeFunctionProxy({readBody,bearer,json,fetchImpl});

  return http.createServer(async(req,res)=>{
    const url=new URL(req.url||"/","http://localhost");
    const pathname=url.pathname;

    if(req.method==="GET"&&pathname==="/"){
      res.writeHead(200,{
        "content-type":"text/html; charset=utf-8",
        "cache-control":"no-store",
        "x-multiplan-ui":CONSOLIDATED_UI_VERSION,
        "x-multiplan-runtime":CONSOLIDATED_SERVER_VERSION,
      });
      res.end(CONSOLIDATED_UI_HTML);
      return;
    }

    if(req.method==="GET"&&(pathname==="/health"||pathname==="/consolidation_r1_health")){
      return json(res,200,{
        ok:true,
        version:CONSOLIDATED_SERVER_VERSION,
        ui:CONSOLIDATED_UI_VERSION,
        canonicalRoute:UNIFIED_PREVIEW_SERVER_ROUTE_VERSION,
        processCount:1,
        legacyChildProcesses:0,
        canonicalGeneration:true,
        canonicalReview:true,
        canonicalDocx:true,
        canonicalHistory:true,
      });
    }

    if(pathname==="/api/gemini-plan") return legacyGenerationRoute(req,res);
    if(pathname==="/api/v0125/unified-plan") return canonicalRoute(req,res);
    if(pathname==="/api/certified-plan") return certifiedRoute(req,res);

    if(pathname==="/api/pedagogical-review"||pathname==="/api/v0125/pedagogical-review") {
      return canonicalReviewRoute(req,res);
    }
    if(pathname==="/api/export/docx"||pathname==="/api/v0125/export/docx") {
      return canonicalDocxRoute(req,res);
    }

    if(req.method==="GET"&&pathname==="/api/history") return history.list(req,res);
    const runId=historyRunId(pathname);
    if(req.method==="GET"&&runId) return history.detail(req,res,runId);

    if(await edgeProxy(req,res,pathname)) return;

    return json(res,404,{code:"NOT_FOUND"});
  });
}

export function listenConsolidatedServer({env=process.env,fetchImpl=fetch}={}){
  const port=Number(env.PORT||3000);
  const server=createConsolidatedServer({env,fetchImpl});
  server.listen(port,"0.0.0.0",()=>{
    console.log(`Multiplan consolidation R1 on ${port}; one process; canonical plan path; no legacy child servers`);
  });
  return server;
}
