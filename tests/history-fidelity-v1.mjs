import assert from "node:assert/strict";
import { SNAPSHOT_VERSION, applyFinalSnapshot, enrichHistoryList, persistSnapshot } from "../lib/v0124/history-fidelity.mjs";

const runId = "11111111-1111-4111-8111-111111111111";
const snapshot = {
  run_id: runId,
  base_run_id: "22222222-2222-4222-8222-222222222222",
  teacher_presentation: { project_title: "Visible final" },
  sessions: [{}, {}, {}],
  products: [{ grade: 1 }, { grade: 3 }],
  methodology_engine: { methodology_primary: { id: "abp", label: "Aprendizaje Basado en Problemas" } },
};
const meta = { schema_version: SNAPSHOT_VERSION, hash_sha256: "abc" };

const oldRow = { run_id: runId, model_output_json: { title: "Interno" }, validator_json: {} };
const oldDetail = applyFinalSnapshot(oldRow);
assert.equal(oldDetail.snapshot_source, "MODEL_OUTPUT_JSON");
assert.equal(oldDetail.model_output_json.title, "Interno");

const newRow = { run_id: runId, model_output_json: { title: "Interno" }, validator_json: { final_output_snapshot: snapshot, final_output_snapshot_meta: meta } };
const newDetail = applyFinalSnapshot(newRow);
assert.equal(newDetail.snapshot_source, "FINAL_OUTPUT_SNAPSHOT");
assert.equal(newDetail.model_output_json.teacher_presentation.project_title, "Visible final");
assert.equal(newRow.model_output_json.title, "Interno", "La salida interna debe permanecer intacta");

globalThis.fetch = async url => {
  if (String(url).includes("/rest/v1/plan_runs")) {
    return new Response(JSON.stringify([{ run_id: runId, validator_json: { final_output_snapshot: snapshot, final_output_snapshot_meta: meta } }]), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (String(url).includes("persist-final-plan-snapshot-v1")) {
    return new Response(JSON.stringify({ hash_sha256: "hash-real", snapshot_version: SNAPSHOT_VERSION }), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new Error(`Unexpected URL ${url}`);
};

const items = await enrichHistoryList([{ run_id: runId, title: "Tarjeta interna", grades: [6], session_count: 1, methodology_id: "steam", has_output: true }], "Bearer test");
assert.equal(items[0].title, "Visible final");
assert.deepEqual(items[0].grades, [1, 3]);
assert.equal(items[0].session_count, 3);
assert.equal(items[0].methodology_id, "abp");
assert.equal(items[0].base_run_id, snapshot.base_run_id);

const persistence = await persistSnapshot("Bearer test", snapshot);
assert.equal(persistence.status, "PERSISTED");
assert.equal(persistence.hash, "hash-real");

const legacy = await enrichHistoryList([{ run_id: "33333333-3333-4333-8333-333333333333", title: "Antigua", session_count: 2 }], "");
assert.equal(legacy[0].title, "Antigua");
assert.equal(legacy[0].snapshot_source, "MODEL_OUTPUT_JSON");

console.log(JSON.stringify({ ok: true, tests: 6, snapshotVersion: SNAPSHOT_VERSION }));
