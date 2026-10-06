import test from "node:test";
import assert from "node:assert/strict";
import { canonicalPlanHash } from "../lib/v0125/blueprint-canonical-adapter.mjs";
import { createCanonicalHistoryHandlers } from "../lib/consolidation-r1/history-routes.mjs";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const PLAN = Object.freeze({
  run_id: RUN_ID,
  base_run_id: null,
  grades: [1, 3],
  project: { title: "Proyecto canónico" },
  teacher_presentation: { project_title: "Proyecto canónico" },
  methodology_engine: { methodology_primary: { id: "proyectos_comunitarios", label: "Proyectos Comunitarios" } },
  sessions: [{ session_number: 1 }, { session_number: 2 }],
});
const HASH = canonicalPlanHash(PLAN);

function capture() {
  let status = 0, headers = {}, body = null;
  return {
    res: {
      writeHead(value, nextHeaders = {}) { status = value; headers = nextHeaders; },
      end(value = "") { body = String(value); },
    },
    read() {
      let parsed = null;
      try { parsed = JSON.parse(body || "null"); } catch {}
      return { status, headers, body, parsed };
    },
  };
}

const bearer = req => String(req?.headers?.authorization || "");
const json = (res, status, body, extra = {}) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...extra });
  res.end(JSON.stringify(body));
};

test("history list enrichment uses injected fetch and promotes canonical snapshot metadata", async () => {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(String(url));
    if (String(url).includes("/plan_history?")) {
      return new Response(JSON.stringify([{
        run_id: RUN_ID,
        created_at: "2026-10-06T00:00:00Z",
        status: "APROBADO",
        title: "Título previo",
        grades: [1],
        session_count: 1,
        methodology_id: null,
        methodology_label: null,
        has_output: true,
        base_run_id: null,
      }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (String(url).includes("/plan_runs?")) {
      return new Response(JSON.stringify([{
        run_id: RUN_ID,
        validator_json: { final_output_snapshot: PLAN, final_output_snapshot_meta: { schema_version: "FINAL-PLAN-SNAPSHOT-V1" } },
      }]), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw Error("UNEXPECTED_URL:" + url);
  };

  const handlers = createCanonicalHistoryHandlers({
    env: { SUPABASE_PUBLISHABLE_KEY: "test-key" },
    fetchImpl,
    bearer,
    json,
  });
  const out = capture();
  await handlers.list({ headers: { authorization: "Bearer user" } }, out.res);
  const result = out.read();

  assert.equal(result.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(result.parsed.items.length, 1);
  assert.equal(result.parsed.items[0].title, "Proyecto canónico");
  assert.deepEqual(result.parsed.items[0].grades, [1, 3]);
  assert.equal(result.parsed.items[0].session_count, 2);
  assert.equal(result.parsed.items[0].methodology_id, "proyectos_comunitarios");
  assert.equal(result.parsed.items[0].canonical_history_status, "SNAPSHOT_AVAILABLE");
});

test("history detail returns the exact canonical snapshot and recomputed hash", async () => {
  const fetchImpl = async url => {
    assert.match(String(url), /\/plan_runs\?/);
    return new Response(JSON.stringify([{
      run_id: RUN_ID,
      model_output_json: { stale: true },
      validator_json: {
        final_output_snapshot: PLAN,
        final_output_snapshot_meta: { schema_version: "FINAL-PLAN-SNAPSHOT-V1", canonical_plan_hash: HASH },
      },
    }]), { status: 200, headers: { "content-type": "application/json" } });
  };

  const handlers = createCanonicalHistoryHandlers({
    env: { SUPABASE_PUBLISHABLE_KEY: "test-key" },
    fetchImpl,
    bearer,
    json,
  });
  const out = capture();
  await handlers.detail({ headers: { authorization: "Bearer user" } }, out.res, RUN_ID);
  const result = out.read();

  assert.equal(result.status, 200);
  assert.equal(result.parsed.canonical_history_status, "CANONICAL_SNAPSHOT");
  assert.equal(result.parsed.canonical_plan_hash, HASH);
  assert.deepEqual(result.parsed.model_output_json, PLAN);
});

test("history routes reject missing authorization before network", async () => {
  let calls = 0;
  const handlers = createCanonicalHistoryHandlers({
    env: { SUPABASE_PUBLISHABLE_KEY: "test-key" },
    fetchImpl: async () => { calls++; throw Error("NETWORK_SHOULD_NOT_RUN"); },
    bearer,
    json,
  });
  const list = capture();
  await handlers.list({ headers: {} }, list.res);
  assert.equal(list.read().status, 401);
  assert.equal(list.read().parsed.code, "AUTH_REQUIRED");

  const detail = capture();
  await handlers.detail({ headers: {} }, detail.res, RUN_ID);
  assert.equal(detail.read().status, 401);
  assert.equal(detail.read().parsed.code, "AUTH_REQUIRED");
  assert.equal(calls, 0);
});
