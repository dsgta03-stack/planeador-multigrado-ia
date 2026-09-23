import assert from "node:assert/strict";
import { persistSnapshot, SNAPSHOT_VERSION } from "../lib/v0124/history-fidelity.mjs";

const plan = {
  run_id: "77777777-7777-4777-8777-777777777777",
  project: { title: "Proyecto visible", final_product: "Producto común" },
  sessions: [{ session_number: 1, total_minutes: 90, purpose: "Conservar este plan aunque falle el snapshot" }],
};
const original = structuredClone(plan);
const nativeFetch = globalThis.fetch;
let calls = 0;

try {
  globalThis.fetch = async () => { calls += 1; throw new Error("NO_DEBE_LLAMARSE"); };
  const noAuth = await persistSnapshot("", plan);
  assert.deepEqual(noAuth, { status: "SKIPPED", reason: "NO_AUTH" });
  assert.equal(calls, 0, "RTE-014: sin auth no debe intentar persistencia");

  const noRun = await persistSnapshot("Bearer test", { ...plan, run_id: "" });
  assert.deepEqual(noRun, { status: "SKIPPED", reason: "NO_RUN_ID" });
  assert.equal(calls, 0, "RTE-014: sin run_id no debe intentar persistencia");

  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ code: "DB_TEMPORARILY_UNAVAILABLE" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  };
  const upstreamFailure = await persistSnapshot("Bearer test", plan);
  assert.deepEqual(upstreamFailure, { status: "FAILED", code: "DB_TEMPORARILY_UNAVAILABLE" });
  assert.deepEqual(plan, original, "RTE-014: una falla HTTP de snapshot no debe mutar la planeación visible");

  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("network down");
  };
  const networkFailure = await persistSnapshot("Bearer test", plan);
  assert.deepEqual(networkFailure, { status: "FAILED", code: "SNAPSHOT_PERSIST_EXCEPTION" });
  assert.deepEqual(plan, original, "RTE-014: una excepción de persistencia no debe mutar la planeación visible");

  globalThis.fetch = async (_url, options = {}) => {
    calls += 1;
    const body = JSON.parse(options.body || "{}");
    assert.equal(body.run_id, plan.run_id);
    assert.deepEqual(body.snapshot, plan, "RTE-014: el snapshot debe recibir exactamente el plan final");
    return new Response(JSON.stringify({
      hash_sha256: "abc123",
      snapshot_version: SNAPSHOT_VERSION,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const success = await persistSnapshot("Bearer test", plan);
  assert.deepEqual(success, { status: "PERSISTED", hash: "abc123", version: SNAPSHOT_VERSION });
  assert.deepEqual(plan, original, "La persistencia exitosa tampoco debe mutar el plan de entrada");

  console.log(JSON.stringify({
    ok: true,
    suite: "SNAPSHOT-PERSIST-FAULT-V1",
    assertions: 12,
    scenario: "RTE-014",
    fetch_calls: calls,
  }));
} finally {
  globalThis.fetch = nativeFetch;
}
