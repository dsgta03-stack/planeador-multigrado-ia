import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_PROJECTCORE_PORT || 3401);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const V63_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-project-action-v3";
const V63_ENABLED = String(process.env.MULTIPLAN_V63_ENABLED || "true").toLowerCase() !== "false";

// Project Core v1 + V6.2.1 remain intact underneath as automatic rollback layers.
const child = spawn(process.execPath, ["server-v086-projectcore.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[project-action] project-core child exited code=${code} signal=${signal}`);
  if (!shuttingDown) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    shuttingDown = true;
    try { child.kill(sig); } catch {}
    process.exit(0);
  });
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 200000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > maxBytes) { reject(new Error("PAYLOAD_TOO_LARGE")); req.destroy(); }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

async function call(url, raw, authorization) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: raw || "{}",
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
    ...extra,
  });
  res.end(result.data);
}

async function routePlan(req, res) {
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return json(res, 401, { code: "AUTH_REQUIRED" });

  let raw;
  try { raw = await readBody(req); }
  catch (error) { return json(res, 413, { code: "PAYLOAD_TOO_LARGE", message: String(error) }); }

  let body;
  try { body = JSON.parse(raw || "{}"); }
  catch { return json(res, 400, { code: "INVALID_JSON" }); }

  const grades = [...new Set((Array.isArray(body?.grados) ? body.grados : []).map(Number).filter(Number.isInteger))];
  const singleGrade = grades.length === 1;

  if (V63_ENABLED && singleGrade) {
    try {
      const v63 = await call(V63_URL, raw, authorization);
      if (v63.status < 500 && v63.status !== 422) {
        return send(res, v63, "V6.3-PROJECT-ACTION-CONTINUITY-BETA.4");
      }

      // Quality/server failure: preserve the teacher experience by falling back to Project Core v1.
      const fallback = await call(CHILD_ORIGIN + "/api/gemini-plan", raw, authorization);
      return send(res, fallback, fallback.engine || "V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA", {
        "x-multiplan-fallback": "project-core-v1",
        "x-multiplan-v63-status": String(v63.status),
      });
    } catch (error) {
      try {
        const fallback = await call(CHILD_ORIGIN + "/api/gemini-plan", raw, authorization);
        return send(res, fallback, fallback.engine || "V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA", {
          "x-multiplan-fallback": "project-core-v1-network",
        });
      } catch (fallbackError) {
        return json(res, 502, { code: "V63_AND_FALLBACK_FAILED", message: String(error), fallback: String(fallbackError) });
      }
    }
  }

  // Multi-grade and V6.3-off requests are handled by the already validated child router.
  try {
    const stable = await call(CHILD_ORIGIN + "/api/gemini-plan", raw, authorization);
    return send(res, stable, stable.engine || "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE");
  } catch (error) {
    return json(res, 502, { code: "STABLE_ROUTER_ERROR", message: String(error) });
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
    const data = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, {
      "content-type": r.headers.get("content-type") || "application/octet-stream",
      "cache-control": r.headers.get("cache-control") || "no-store",
    });
    res.end(data);
  } catch (error) {
    json(res, 502, { code: "PROJECT_CORE_CHILD_ERROR", message: String(error) });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    try {
      const r = await fetch(CHILD_ORIGIN + "/health");
      const childHealth = await r.json().catch(() => ({}));
      return json(res, r.ok ? 200 : 503, {
        ok: r.ok,
        version: "0.8.6",
        interfaceChanged: false,
        v63Enabled: V63_ENABLED,
        v63Scope: "single-grade-only",
        singleGradeEngine: V63_ENABLED ? "V6.3-PROJECT-ACTION-CONTINUITY-BETA.4" : "V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA",
        singleGradeFallback: "V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA",
        multiGradeEngine: "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",
        stableFallback: "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",
        childEntryPoint: "server-v086-projectcore.mjs",
        child: childHealth,
      });
    } catch (error) {
      return json(res, 503, { ok: false, version: "0.8.6", code: "PROJECT_CORE_CHILD_NOT_READY", message: String(error) });
    }
  }

  if (req.method === "POST" && req.url === "/api/gemini-plan") return routePlan(req, res);
  return proxy(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan V6.3 Project Action router listening on ${PORT}; project-core child on ${CHILD_PORT}; v63=${V63_ENABLED}; scope=single-grade-only`);
});
