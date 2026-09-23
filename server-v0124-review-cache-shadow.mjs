import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V0124_CACHE_CHILD_PORT || 7101);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const CACHE_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/pedagogical-review-cache-v1";

const child = spawn(process.execPath, ["server-v0124-history-fidelity-v2-shadow.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[v0124-review-cache] child exited code=${code} signal=${signal}`);
  if (!stopping) setTimeout(() => process.exit(code || 1), 50);
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    stopping = true;
    try { child.kill(signal); } catch {}
    process.exit(0);
  });
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
  res.end(JSON.stringify(body));
}
function readBody(req, max = 2_500_000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > max) { reject(new Error("PAYLOAD_TOO_LARGE")); req.destroy(); }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}
function bearer(req) {
  const value = String(req.headers.authorization || "");
  return value.startsWith("Bearer ") ? value : "";
}
async function cacheRequest(action, authorization, plan, result) {
  if (!authorization || !plan || typeof plan !== "object") return { status: 0, body: { hit: false, code: "CACHE_NOT_APPLICABLE" } };
  try {
    const response = await fetch(CACHE_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify({ action, run_id: plan?.run_id, plan, ...(action === "put" ? { result } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } catch (error) {
    return { status: 0, body: { hit: false, code: "CACHE_REQUEST_FAILED", message: String(error).slice(0, 180) } };
  }
}

async function reviewWithCache(req, res) {
  const authorization = bearer(req);
  let raw = "";
  let payload = null;
  try {
    raw = await readBody(req);
    payload = JSON.parse(raw || "{}");
  } catch (error) {
    return json(res, String(error).includes("PAYLOAD_TOO_LARGE") ? 413 : 400, { code: String(error).includes("PAYLOAD_TOO_LARGE") ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON" });
  }
  const plan = payload?.plan;
  if (authorization && plan && typeof plan === "object" && plan?.run_id) {
    const cached = await cacheRequest("get", authorization, plan);
    if (cached.status === 200 && cached.body?.hit && cached.body?.result) {
      return json(res, 200, cached.body.result, {
        "x-multiplan-review-cache": "HIT",
        "x-multiplan-review-cache-version": cached.body.review_version || "UNKNOWN",
        "x-multiplan-review-snapshot-hash": cached.body.snapshot_hash || "",
      });
    }
    if (cached.status === 409 && cached.body?.code === "SNAPSHOT_HASH_MISMATCH") {
      return json(res, 409, {
        code: "HISTORY_SNAPSHOT_MISMATCH",
        message: "La planeación actual no coincide con el snapshot final guardado. La revisión se detuvo para evitar evaluar otra versión.",
        plan_hash: cached.body.plan_hash,
        snapshot_hash: cached.body.snapshot_hash,
      }, { "x-multiplan-review-cache": "HASH_MISMATCH" });
    }
  }

  try {
    const headers = { "content-type": "application/json" };
    if (authorization) headers.authorization = authorization;
    const response = await fetch(CHILD_ORIGIN + "/api/pedagogical-review", {
      method: "POST", headers, body: raw || "{}", signal: AbortSignal.timeout(150_000),
    });
    const text = await response.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    let cacheStatus = "MISS_NOT_STORED";
    let cacheVersion = "";
    let snapshotHash = "";
    if (response.ok && authorization && plan && typeof plan === "object" && plan?.run_id && data && typeof data === "object") {
      const stored = await cacheRequest("put", authorization, plan, data);
      if (stored.status === 200 && stored.body?.ok) {
        cacheStatus = "MISS_STORED";
        cacheVersion = stored.body.review_version || "";
        snapshotHash = stored.body.snapshot_hash || "";
      } else if (stored.status === 409 && stored.body?.code === "SNAPSHOT_HASH_MISMATCH") {
        return json(res, 409, {
          code: "HISTORY_SNAPSHOT_MISMATCH",
          message: "El resultado no se guardó porque la planeación revisada no coincide con el snapshot final.",
          plan_hash: stored.body.plan_hash,
          snapshot_hash: stored.body.snapshot_hash,
        }, { "x-multiplan-review-cache": "HASH_MISMATCH" });
      } else cacheStatus = "MISS_CACHE_FAILED";
    }
    const outgoing = {
      "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-multiplan-review-cache": cacheStatus,
      "x-multiplan-review-cache-version": cacheVersion,
      "x-multiplan-review-snapshot-hash": snapshotHash,
    };
    for (const name of ["x-multiplan-pedagogical-review","x-multiplan-review-mode","x-multiplan-review-context","x-multiplan-review-postcheck"]) {
      const value = response.headers.get(name); if (value) outgoing[name] = value;
    }
    res.writeHead(response.status, outgoing); res.end(text);
  } catch (error) {
    json(res, 502, { code: "PEDAGOGICAL_REVIEW_PROXY_ERROR", message: String(error).slice(0, 300) });
  }
}

async function proxy(req, res) {
  try {
    const headers = {};
    for (const name of ["content-type", "authorization", "accept", "cookie", "user-agent"]) if (req.headers[name]) headers[name] = req.headers[name];
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const response = await fetch(CHILD_ORIGIN + (req.url || "/"), init);
    const data = Buffer.from(await response.arrayBuffer());
    const outgoing = { "content-type": response.headers.get("content-type") || "application/octet-stream", "cache-control": response.headers.get("cache-control") || "no-store" };
    for (const name of ["x-multiplan-plan-engine","x-multiplan-safe-fallback","x-multiplan-v65-promotion","x-multiplan-methodology-sequence","x-multiplan-session-count-preserved","x-multiplan-workflow-ui","x-multiplan-pedagogical-review-ui","x-multiplan-history-snapshot","x-multiplan-final-snapshot","x-multiplan-final-snapshot-version"]) {
      const value = response.headers.get(name); if (value) outgoing[name] = value;
    }
    res.writeHead(response.status, outgoing); res.end(data);
  } catch (error) {
    json(res, String(error).includes("PAYLOAD_TOO_LARGE") ? 413 : 502, { code: String(error).includes("PAYLOAD_TOO_LARGE") ? "PAYLOAD_TOO_LARGE" : "V0124_REVIEW_CACHE_PROXY_ERROR", message: String(error).slice(0, 300) });
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/v0124_cache_health") {
    return json(res, 200, {
      ok: true,
      version: "0.12.4-shadow+review-cache",
      base: "0.12.4-shadow+history-fidelity-v2",
      reviewCache: "HASH_AND_VERSION_KEYED",
      snapshotMismatchBlocksReview: true,
      productionModified: false,
    });
  }
  if (req.method === "POST" && url.pathname === "/api/pedagogical-review") return reviewWithCache(req, res);
  return proxy(req, res);
}).listen(PORT, "0.0.0.0", () => console.log(`Multiplan v0.12.4 shadow + reproducible review cache on ${PORT}; child ${CHILD_PORT}`));
