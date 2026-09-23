const SUPABASE_URL = "https://dvcrwzxznuqongutnifn.supabase.co";
const REVIEW_URL = `${SUPABASE_URL}/functions/v1/plan-review-pedagogical-context-v1`;
const CACHE_URL = `${SUPABASE_URL}/functions/v1/pedagogical-review-cache-v1`;
export const REVIEW_VERSION = "PEDAGOGICAL-REVIEW-V1.1-SHADOW-CALIBRATION";

async function cacheRequest(action, authorization, plan, result) {
  if (!authorization || !plan || typeof plan !== "object") return { status: 0, body: { hit: false } };
  try {
    const response = await fetch(CACHE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify({ action, run_id: plan?.run_id, plan, ...(action === "put" ? { result } : {}) }),
      signal: AbortSignal.timeout(12_000),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } catch { return { status: 0, body: { hit: false } }; }
}

export async function reviewWithCache(req, res, helpers) {
  const { bearer, readBody, json, copyHeaders } = helpers;
  const authorization = bearer(req);
  if (!authorization) return json(res, 401, { code: "AUTH_REQUIRED" });
  let raw = "", payload;
  try { raw = await readBody(req); payload = JSON.parse(raw || "{}"); }
  catch (error) { return json(res, String(error).includes("PAYLOAD_TOO_LARGE") ? 413 : 400, { code: String(error).includes("PAYLOAD_TOO_LARGE") ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON" }); }
  const plan = payload?.plan;
  if (!plan || typeof plan !== "object") return json(res, 400, { code: "PLAN_REQUIRED" });

  if (plan?.run_id) {
    const cached = await cacheRequest("get", authorization, plan);
    if (cached.status === 200 && cached.body?.hit && cached.body?.result) {
      return json(res, 200, cached.body.result, {
        "x-multiplan-review-cache": "HIT",
        "x-multiplan-review-cache-version": cached.body.review_version || REVIEW_VERSION,
        "x-multiplan-review-snapshot-hash": cached.body.snapshot_hash || "",
      });
    }
    if (cached.status === 409 && cached.body?.code === "SNAPSHOT_HASH_MISMATCH") {
      return json(res, 409, { code: "HISTORY_SNAPSHOT_MISMATCH", message: "La planeación actual no coincide con el snapshot final guardado.", plan_hash: cached.body.plan_hash, snapshot_hash: cached.body.snapshot_hash }, { "x-multiplan-review-cache": "HASH_MISMATCH" });
    }
  }

  try {
    const response = await fetch(REVIEW_URL, { method: "POST", headers: { "content-type": "application/json", authorization }, body: raw || "{}", signal: AbortSignal.timeout(140_000) });
    const text = await response.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    let cacheStatus = "MISS_NOT_STORED", cacheVersion = "", snapshotHash = "";
    if (response.ok && plan?.run_id && data && typeof data === "object") {
      const stored = await cacheRequest("put", authorization, plan, data);
      if (stored.status === 200 && stored.body?.ok) { cacheStatus = "MISS_STORED"; cacheVersion = stored.body.review_version || REVIEW_VERSION; snapshotHash = stored.body.snapshot_hash || ""; }
      else if (stored.status === 409 && stored.body?.code === "SNAPSHOT_HASH_MISMATCH") return json(res, 409, { code: "HISTORY_SNAPSHOT_MISMATCH", message: "La planeación revisada no coincide con el snapshot final.", plan_hash: stored.body.plan_hash, snapshot_hash: stored.body.snapshot_hash }, { "x-multiplan-review-cache": "HASH_MISMATCH" });
      else cacheStatus = "MISS_CACHE_FAILED";
    }
    const outgoing = copyHeaders(response, ["x-multiplan-pedagogical-review", "x-multiplan-review-mode", "x-multiplan-review-context", "x-multiplan-review-postcheck"]);
    outgoing["x-multiplan-review-cache"] = cacheStatus;
    outgoing["x-multiplan-review-cache-version"] = cacheVersion;
    outgoing["x-multiplan-review-snapshot-hash"] = snapshotHash;
    res.writeHead(response.status, outgoing); res.end(text);
  } catch (error) { json(res, 502, { code: "PEDAGOGICAL_REVIEW_PROXY_ERROR", message: String(error).slice(0, 300) }); }
}
