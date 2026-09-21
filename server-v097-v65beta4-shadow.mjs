import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V096_CHILD_PORT || 4401);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const V65_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-methodology-v65-beta4";
const SHADOW_ENABLED = String(process.env.MULTIPLAN_V65_SHADOW_ENABLED || "true").toLowerCase() !== "false";

// V0.9.6 remains the visible production engine. Disable its Beta.3 shadow so this
// top-level router produces exactly one methodology shadow: V6.5 Beta.4.
const child = spawn(process.execPath, ["server-v096-v64mg5-renderguard.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT), MULTIPLAN_V65_SHADOW_ENABLED: "false" },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[v097] child v0.9.6 exited code=${code} signal=${signal}`);
  if (!shuttingDown) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => {
  shuttingDown = true;
  try { child.kill(sig); } catch {}
  process.exit(0);
});

function json(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 380000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > maxBytes) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

async function callChild(path, raw, authorization, timeout = 480000) {
  const r = await fetch(CHILD_ORIGIN + path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: raw || "{}",
    signal: AbortSignal.timeout(timeout),
  });
  return {
    status: r.status,
    contentType: r.headers.get("content-type") || "application/json; charset=utf-8",
    data: Buffer.from(await r.arrayBuffer()),
    engine: r.headers.get("x-multiplan-plan-engine") || "",
  };
}

function parse(buffer) {
  try { return JSON.parse(buffer.toString("utf8")); }
  catch { return null; }
}

function send(res, result, engine, extra = {}) {
  res.writeHead(result.status, {
    "content-type": result.contentType,
    "cache-control": "no-store",
    "x-multiplan-plan-engine": engine,
    "x-multiplan-v65-shadow": SHADOW_ENABLED ? "enabled-beta4-non-governing" : "disabled",
    ...extra,
  });
  res.end(result.data);
}

async function runShadow(raw, authorization, basePlan) {
  try {
    const request = JSON.parse(raw || "{}");
    request.base_plan = basePlan;
    request.methodology_selection = request.methodology_selection || request.metodologia || "auto";
    request.v65_mode = "shadow";
    request.shadow_test = true;
    request.shadow_source_run_id = basePlan?.run_id || null;

    const started = Date.now();
    const r = await fetch(V65_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(390000),
    });
    const text = await r.text();
    let out = null;
    try { out = JSON.parse(text); } catch {}

    const validator = out?.methodology_engine?.validator || {};
    console.log(JSON.stringify({
      event: "v65_beta4_shadow_complete",
      status: r.status,
      elapsed_ms: Date.now() - started,
      engine: out?.engineVersion || r.headers.get("x-multiplan-plan-engine") || null,
      run_id: out?.run_id || null,
      base_run_id: basePlan?.run_id || null,
      methodology: out?.methodology_engine?.methodology_primary?.id || null,
      quality: validator?.quality?.total ?? null,
      procedure_coherence_ratio: validator?.procedure_coherence?.ratio ?? null,
      procedure_coherence_passed: validator?.gates?.procedure_action_coherence ?? null,
      context_supported: validator?.gates?.context_supported ?? null,
      medical_claims_removed: validator?.gates?.medical_outcome_claims_removed ?? null,
      errors: Array.isArray(validator?.errors) ? validator.errors.length : null,
      code: out?.code || null,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      event: "v65_beta4_shadow_error",
      base_run_id: basePlan?.run_id || null,
      message: String(error).slice(0, 500),
    }));
  }
}

async function routePlan(req, res) {
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return json(res, 401, { code: "AUTH_REQUIRED" });

  let raw;
  try { raw = await readBody(req); }
  catch (e) { return json(res, 413, { code: "PAYLOAD_TOO_LARGE", message: String(e) }); }

  let result;
  try { result = await callChild("/api/gemini-plan", raw, authorization); }
  catch (e) { return json(res, 502, { code: "V097_CHILD_ERROR", message: String(e) }); }

  const plan = result.status === 200 ? parse(result.data) : null;
  const engine = result.engine || plan?.engineVersion || "V6.4";

  // Visible response is always exactly what V0.9.6 produced.
  send(res, result, engine, { "x-multiplan-v65-shadow-base": plan?.run_id || "" });

  // Beta.4 is strictly non-governing and only receives an approved V6.4 plan.
  if (
    SHADOW_ENABLED &&
    result.status === 200 &&
    plan &&
    String(plan.engineVersion || engine).startsWith("V6.4")
  ) {
    setImmediate(() => void runShadow(raw, authorization, plan));
  }
}

async function proxy(req, res) {
  try {
    const headers = {};
    for (const name of ["content-type", "authorization", "accept", "cookie"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const r = await fetch(CHILD_ORIGIN + req.url, init);
    const type = r.headers.get("content-type") || "application/octet-stream";
    const data = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, {
      "content-type": type,
      "cache-control": r.headers.get("cache-control") || "no-store",
    });
    res.end(data);
  } catch (e) {
    json(res, 502, { code: "V097_CHILD_PROXY_ERROR", message: String(e) });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    try {
      const r = await fetch(CHILD_ORIGIN + "/health");
      const childHealth = await r.json().catch(() => ({}));
      return json(res, r.ok ? 200 : 503, {
        ok: r.ok,
        version: "0.9.7",
        multigradeEngine: childHealth.multigradeEngine || "V6.4-MULTIGRADE-DIDACTIC-BETA.5",
        multigradeStrategy: childHealth.multigradeStrategy || "STRUCTURED-JSON-SESSION-ENRICHMENT",
        rendererGuard: childHealth.rendererGuard || "WORK-MOMENTS-COMPAT-V1",
        shadowEngine: "V6.5-METHODOLOGY-ENGINE-BETA.4",
        shadowMode: SHADOW_ENABLED ? "ACTIVE_NON_GOVERNING" : "DISABLED",
        shadowIsolation: "ONLY_BETA4_AT_TOP_LEVEL; LOWER_SHADOWS_DISABLED",
        shadowGoal: "PROCEDURE-ACTION-COHERENCE + CONTEXT-SUPPORTED + INTEGRATED-PROJECT",
        userResponseAlwaysFrom: "server-v096-v64mg5-renderguard.mjs",
        previousProduction: "server-v096-v64mg5-renderguard.mjs",
        child: childHealth,
      });
    } catch (e) {
      return json(res, 503, {
        ok: false,
        version: "0.9.7",
        code: "V096_CHILD_NOT_READY",
        message: String(e),
      });
    }
  }

  if (req.method === "POST" && req.url === "/api/gemini-plan") return routePlan(req, res);
  return proxy(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan v0.9.7 on ${PORT}; visible child v0.9.6 on ${CHILD_PORT}; only V6.5 Beta.4 shadow=${SHADOW_ENABLED}`);
});
