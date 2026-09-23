import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const REVIEW_VERSION = "PEDAGOGICAL-REVIEW-V1.1-SHADOW-CALIBRATION";
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
}
function hash(value) { return createHash("sha256").update(canonical(value)).digest("hex"); }
function cacheHit(cache, plan, reviewVersion = REVIEW_VERSION) {
  return !!(cache && cache.review_version === reviewVersion && cache.snapshot_hash === hash(plan) && cache.result);
}

const visible = { run_id: "11111111-1111-4111-8111-111111111111", title: "Proyecto", sessions: [{ session_number: 1, purpose: "Explorar" }], methodology_engine: { methodology_primary: { id: "abp" } } };
const sameDifferentKeyOrder = { methodology_engine: { methodology_primary: { id: "abp" } }, sessions: [{ purpose: "Explorar", session_number: 1 }], title: "Proyecto", run_id: "11111111-1111-4111-8111-111111111111" };
assert.equal(hash(visible), hash(sameDifferentKeyOrder), "El hash canónico debe ignorar el orden de llaves");

const reviewResult = { status: "BLOCKED", score: 55, critical_count: 3, findings: [{ rule_id: "PDA-01" }] };
const cache = { review_version: REVIEW_VERSION, snapshot_hash: hash(visible), result: reviewResult };
assert.equal(cacheHit(cache, sameDifferentKeyOrder), true);
assert.deepEqual(cache.result, reviewResult, "Un HIT debe devolver exactamente el resultado almacenado");

const changed = structuredClone(visible); changed.sessions[0].purpose = "Investigar";
assert.notEqual(hash(changed), hash(visible));
assert.equal(cacheHit(cache, changed), false, "Cambiar el plan debe invalidar el cache");
assert.equal(cacheHit(cache, visible, "PEDAGOGICAL-REVIEW-V1.2"), false, "Cambiar la versión del revisor debe invalidar el cache");

console.log(JSON.stringify({ ok: true, tests: 5, reviewVersion: REVIEW_VERSION, snapshotHash: hash(visible) }));
