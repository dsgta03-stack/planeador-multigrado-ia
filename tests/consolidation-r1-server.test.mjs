import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createConsolidatedServer, CONSOLIDATED_SERVER_VERSION } from "../lib/consolidation-r1/server.mjs";

test("single-app server source cannot spawn legacy servers", () => {
  const source=fs.readFileSync(fileURLToPath(new URL("../lib/consolidation-r1/server.mjs",import.meta.url)),"utf8");
  assert.doesNotMatch(source,/\bspawn\s*\(/);
  assert.doesNotMatch(source,/server-v\d/i);
});

test("single-app root and health run in one process without upstream calls", async () => {
  let calls=0;
  const fetchImpl=async()=>{calls++;throw Error("NETWORK_SHOULD_NOT_RUN")};
  const server=createConsolidatedServer({env:{SUPABASE_PUBLISHABLE_KEY:"test"},fetchImpl});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const {port}=server.address();
  try{
    const health=await fetch(`http://127.0.0.1:${port}/consolidation_r1_health`);
    const h=await health.json();
    assert.equal(health.status,200);
    assert.equal(h.version,CONSOLIDATED_SERVER_VERSION);
    assert.equal(h.processCount,1);
    assert.equal(h.legacyChildProcesses,0);

    const root=await fetch(`http://127.0.0.1:${port}/`);
    const html=await root.text();
    assert.equal(root.status,200);
    assert.match(html,/id="mpShell"|mp-ui-beta-script/);
    assert.equal(calls,0);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});

test("generation boundary rejects missing auth before provider or curriculum network", async () => {
  let calls=0;
  const fetchImpl=async()=>{calls++;throw Error("NETWORK_SHOULD_NOT_RUN")};
  const server=createConsolidatedServer({env:{
    SUPABASE_PUBLISHABLE_KEY:"test",
    MULTIPLAN_CERTIFIED_R2_ENDPOINT:"https://example.invalid/functions/v1/test",
    MULTIPLAN_CERTIFIED_R2_TOKEN:"not-used",
    MULTIPLAN_CERTIFIED_R2_IDENTITY:"test"
  },fetchImpl});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const {port}=server.address();
  try{
    const r=await fetch(`http://127.0.0.1:${port}/api/gemini-plan`,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
    const b=await r.json();
    assert.equal(r.status,401);
    assert.equal(b.code,"USER_AUTHORIZATION_REQUIRED");
    assert.equal(calls,0);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});
