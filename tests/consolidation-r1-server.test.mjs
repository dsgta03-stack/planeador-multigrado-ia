import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createConsolidatedServer, CONSOLIDATED_SERVER_VERSION } from "../lib/consolidation-r1/server.mjs";

const TEST_ENV = Object.freeze({
  SUPABASE_PUBLISHABLE_KEY: "test",
  MULTIPLAN_CERTIFIED_R2_ENABLED: "1",
  MULTIPLAN_CERTIFIED_R2_ENDPOINT: "https://example.invalid/functions/v1/test",
  MULTIPLAN_CERTIFIED_R2_TOKEN: "not-used",
  MULTIPLAN_CERTIFIED_R2_IDENTITY: "test",
});

async function withServer(run) {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw Error("NETWORK_SHOULD_NOT_RUN"); };
  const server = createConsolidatedServer({ env: TEST_ENV, fetchImpl });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run({ origin: `http://127.0.0.1:${port}`, networkCalls: () => calls });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("single-app server source cannot spawn legacy servers", () => {
  const source = fs.readFileSync(fileURLToPath(new URL("../lib/consolidation-r1/server.mjs", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /\bspawn\s*\(/);
  assert.doesNotMatch(source, /server-v\d/i);
});

test("single-app runtime modules contain no child-process or legacy-server execution", () => {
  const root = fileURLToPath(new URL("../lib/consolidation-r1/", import.meta.url));
  const stack = [root];
  const files = [];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = current + "/" + entry.name;
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith(".mjs") && entry.name !== "legacy-layer-manifest.mjs") files.push(full);
    }
  }
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /node:child_process/, file);
    assert.doesNotMatch(source, /\bspawn\s*\(/, file);
    assert.doesNotMatch(source, /server-v\d/i, file);
  }
});

test("single-app root and health run in one process without upstream calls", async () => {
  await withServer(async ({ origin, networkCalls }) => {
    const health = await fetch(origin + "/consolidation_r1_health");
    const h = await health.json();
    assert.equal(health.status, 200);
    assert.equal(h.version, CONSOLIDATED_SERVER_VERSION);
    assert.equal(h.processCount, 1);
    assert.equal(h.legacyChildProcesses, 0);
    assert.equal(h.canonicalGeneration, true);
    assert.equal(h.canonicalReview, true);
    assert.equal(h.canonicalDocx, true);
    assert.equal(h.canonicalHistory, true);

    const root = await fetch(origin + "/");
    const html = await root.text();
    assert.equal(root.status, 200);
    assert.match(html, /id="mpShell"|mp-ui-beta-script/);
    assert.equal(networkCalls(), 0);
  });
});

test("all protected single-app boundaries fail closed before any upstream call", async () => {
  await withServer(async ({ origin, networkCalls }) => {
    const cases = [
      ["/api/gemini-plan", "POST", 401, "USER_AUTHORIZATION_REQUIRED"],
      ["/api/v0125/unified-plan", "POST", 401, "USER_AUTHORIZATION_REQUIRED"],
      ["/api/certified-plan", "POST", 401, "USER_AUTHORIZATION_REQUIRED"],
      ["/api/pedagogical-review", "POST", 401, "AUTH_REQUIRED"],
      ["/api/v0125/pedagogical-review", "POST", 401, "AUTH_REQUIRED"],
      ["/api/history", "GET", 401, "AUTH_REQUIRED"],
      ["/api/retrieve", "POST", 401, "AUTH_REQUIRED"],
      ["/api/material", "POST", 401, "AUTH_REQUIRED"],
      ["/api/methodology-recommendation", "POST", 401, "AUTH_REQUIRED"],
    ];

    for (const [pathname, method, expectedStatus, expectedCode] of cases) {
      const response = await fetch(origin + pathname, {
        method,
        ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: "{}" } : {}),
      });
      const body = await response.json();
      assert.equal(response.status, expectedStatus, pathname);
      assert.equal(body.code, expectedCode, pathname);
    }
    assert.equal(networkCalls(), 0);
  });
});

test("DOCX boundary rejects missing canonical plan without network", async () => {
  await withServer(async ({ origin, networkCalls }) => {
    const response = await fetch(origin + "/api/export/docx", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, "CANONICAL_PLAN_REQUIRED");
    assert.equal(networkCalls(), 0);
  });
});

test("unknown route stays closed and local", async () => {
  await withServer(async ({ origin, networkCalls }) => {
    const response = await fetch(origin + "/not-a-route");
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.code, "NOT_FOUND");
    assert.equal(networkCalls(), 0);
  });
});
