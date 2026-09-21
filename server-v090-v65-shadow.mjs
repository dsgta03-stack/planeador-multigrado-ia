import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V089_CHILD_PORT || 3801);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const V65_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-methodology-v65-beta2";
const SHADOW_ENABLED = String(process.env.MULTIPLAN_V65_SHADOW_ENABLED || "true").toLowerCase() !== "false";

// V0.8.9 remains the production engine. This wrapper never replaces its response.
const child = spawn(process.execPath, ["server-v089-multigrade-didactic.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[v65-shadow] v0.8.9 child exited code=${code} signal=${signal}`);
  if (!shuttingDown) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => {
  shuttingDown = true;
  try { child.kill(sig); } catch {}
  process.exit(0);
});

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}
function readBody(req, maxBytes = 320000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => {
      raw += c;
      if (raw.length > maxBytes) { reject(new Error("PAYLOAD_TOO_LARGE")); req.destroy(); }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}
async function call(url, raw, authorization, timeout = 260000) {
  const r = await fetch(url, {
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
function send(res, result, engine, extra = {}) {
  res.writeHead(result.status, {
    "content-type": result.contentType,
    "cache-control": "no-store",
    "x-multiplan-plan-engine": engine,
    "x-multiplan-v65-shadow": SHADOW_ENABLED ? "enabled-non-governing" : "disabled",
    ...extra,
  });
  res.end(result.data);
}
function parseJsonBuffer(buffer) {
  try { return JSON.parse(buffer.toString("utf8")); } catch { return null; }
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
      signal: AbortSignal.timeout(185000),
    });
    const text = await r.text();
    let out = null;
    try { out = JSON.parse(text); } catch {}
    console.log(JSON.stringify({
      event: "v65_shadow_complete",
      status: r.status,
      elapsed_ms: Date.now() - started,
      engine: out?.engineVersion || r.headers.get("x-multiplan-plan-engine") || null,
      run_id: out?.run_id || null,
      base_run_id: basePlan?.run_id || null,
      methodology: out?.methodology_engine?.methodology_primary?.id || null,
      quality: out?.methodology_engine?.validator?.quality?.total ?? null,
      errors: out?.methodology_engine?.validator?.errors?.length ?? null,
      code: out?.code || null,
    }));
  } catch (error) {
    console.error(JSON.stringify({ event: "v65_shadow_error", base_run_id: basePlan?.run_id || null, message: String(error).slice(0, 500) }));
  }
}

async function routePlan(req, res) {
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return json(res, 401, { code: "AUTH_REQUIRED" });
  let raw;
  try { raw = await readBody(req); }
  catch (e) { return json(res, 413, { code: "PAYLOAD_TOO_LARGE", message: String(e) }); }

  let result;
  try { result = await call(CHILD_ORIGIN + "/api/gemini-plan", raw, authorization, 270000); }
  catch (e) { return json(res, 502, { code: "V090_CHILD_ERROR", message: String(e) }); }

  const plan = result.status === 200 ? parseJsonBuffer(result.data) : null;
  const engine = result.engine || plan?.engineVersion || "V6.4";

  // Production response is always V0.8.9/V6.4. Shadow runs only after a valid V6.4 plan exists.
  send(res, result, engine, { "x-multiplan-v65-shadow-base": plan?.run_id || "" });

  if (SHADOW_ENABLED && result.status === 200 && plan && String(plan.engineVersion || engine).startsWith("V6.4")) {
    setImmediate(() => void runShadow(raw, authorization, plan));
  }
}

async function proxy(req, res) {
  try {
    const headers = {};
    for (const n of ["content-type", "authorization", "accept", "cookie"]) if (req.headers[n]) headers[n] = req.headers[n];
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const r = await fetch(CHILD_ORIGIN + req.url, init);
    const type = r.headers.get("content-type") || "application/octet-stream";
    const data = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { "content-type": type, "cache-control": r.headers.get("cache-control") || "no-store" });
    res.end(data);
  } catch (e) {
    json(res, 502, { code: "V090_CHILD_PROXY_ERROR", message: String(e) });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    try {
      const r = await fetch(CHILD_ORIGIN + "/health");
      const childHealth = await r.json().catch(() => ({}));
      return json(res, r.ok ? 200 : 503, {
        ok: r.ok,
        version: "0.9.0-shadow",
        productionEngine: childHealth.multigradeEngine || childHealth.singleGradeEngine || "V6.4",
        shadowEngine: "V6.5-METHODOLOGY-ENGINE-BETA.2",
        shadowMode: SHADOW_ENABLED ? "ACTIVE_NON_GOVERNING" : "DISABLED",
        userResponseAlwaysFrom: "server-v089-multigrade-didactic.mjs",
        previousProduction: "server-v089-multigrade-didactic.mjs",
        child: childHealth,
      });
    } catch (e) {
      return json(res, 503, { ok: false, version: "0.9.0-shadow", code: "V089_CHILD_NOT_READY", message: String(e) });
    }
  }
  if (req.method === "POST" && req.url === "/api/gemini-plan") return routePlan(req, res);
  return proxy(req, res);
});

server.listen(PORT, "0.0.0.0", () => console.log(`Multiplan v0.9.0 shadow router on ${PORT}; production child v0.8.9 on ${CHILD_PORT}; V6.5 shadow=${SHADOW_ENABLED}`));
