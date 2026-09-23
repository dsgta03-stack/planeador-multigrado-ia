import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { REVIEW_VERSION, reviewWithCache } from "../lib/v0124/review-cache.mjs";

const plan = { run_id: "11111111-1111-4111-8111-111111111111", sessions: [{ session_number: 1 }] };
const reviewResult = { status: "BLOCKED", score: 55, critical_count: 3, findings: [{ rule_id: "PDA-01" }] };

function helpers() {
  return {
    bearer: req => req.headers.authorization || "",
    readBody: req => new Promise((resolve, reject) => { let raw = ""; req.on("data", c => raw += c); req.on("end", () => resolve(raw)); req.on("error", reject); }),
    json: (res, status, body, extra = {}) => { res.writeHead(status, { "content-type": "application/json", ...extra }); res.end(JSON.stringify(body)); },
    copyHeaders: (response, names = []) => { const out = { "content-type": response.headers.get("content-type") || "application/json" }; for (const name of names) { const value = response.headers.get(name); if (value) out[name] = value; } return out; },
  };
}
function request(body, auth = "Bearer test") { const req = Readable.from([JSON.stringify(body)]); req.headers = { authorization: auth }; return req; }
function responseCapture() { let status = 0, headers = {}, body = ""; return { res: { writeHead: (s, h) => { status = s; headers = h; }, end: x => { body = String(x || ""); } }, get: () => ({ status, headers, body }) }; }

let calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push(String(url));
  if (String(url).includes("pedagogical-review-cache-v1")) {
    const payload = JSON.parse(options.body);
    if (payload.action === "get") return new Response(JSON.stringify({ hit: false }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ ok: true, review_version: REVIEW_VERSION, snapshot_hash: "abc" }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (String(url).includes("plan-review-pedagogical-context-v1")) return new Response(JSON.stringify(reviewResult), { status: 200, headers: { "content-type": "application/json", "x-multiplan-review-postcheck": "V1.1" } });
  throw new Error(`Unexpected URL ${url}`);
};
let cap = responseCapture();
await reviewWithCache(request({ plan }), cap.res, helpers());
let out = cap.get();
assert.equal(out.status, 200);
assert.deepEqual(JSON.parse(out.body), reviewResult);
assert.equal(out.headers["x-multiplan-review-cache"], "MISS_STORED");
assert.equal(calls.length, 3);

calls = [];
globalThis.fetch = async url => {
  calls.push(String(url));
  return new Response(JSON.stringify({ hit: true, result: reviewResult, review_version: REVIEW_VERSION, snapshot_hash: "abc" }), { status: 200, headers: { "content-type": "application/json" } });
};
cap = responseCapture();
await reviewWithCache(request({ plan }), cap.res, helpers());
out = cap.get();
assert.equal(out.status, 200);
assert.deepEqual(JSON.parse(out.body), reviewResult);
assert.equal(out.headers["x-multiplan-review-cache"], "HIT");
assert.equal(calls.length, 1, "Un HIT no debe volver a ejecutar el revisor semántico");

calls = [];
globalThis.fetch = async url => new Response(JSON.stringify({ code: "SNAPSHOT_HASH_MISMATCH", plan_hash: "nuevo", snapshot_hash: "guardado" }), { status: 409, headers: { "content-type": "application/json" } });
cap = responseCapture();
await reviewWithCache(request({ plan }), cap.res, helpers());
out = cap.get();
assert.equal(out.status, 409);
assert.equal(JSON.parse(out.body).code, "HISTORY_SNAPSHOT_MISMATCH");

cap = responseCapture();
await reviewWithCache(request({ plan }, ""), cap.res, helpers());
assert.equal(cap.get().status, 401);

console.log(JSON.stringify({ ok: true, tests: 4, reviewVersion: REVIEW_VERSION }));
