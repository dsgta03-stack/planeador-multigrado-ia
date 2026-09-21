import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V086_PORT || 3301);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const PROJECT_CORE_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-project-core-v1";
const PROJECT_CORE_ENABLED = String(process.env.MULTIPLAN_PROJECT_CORE_ENABLED || "true").toLowerCase() !== "false";

// Stable V0.8.6/V6.2.1 remains intact as a child process and rollback path.
const child = spawn(process.execPath, ["server-v086.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[project-core] stable child v086 exited code=${code} signal=${signal}`);
  if (!shuttingDown) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    shuttingDown = true;
    try { child.kill(sig); } catch {}
    process.exit(0);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 180000) {
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

function authHeader(req) {
  return String(req.headers.authorization || "");
}

async function forwardPost(res, url, raw, authorization, engineLabel) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: raw || "{}",
    });
    const data = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, {
      "content-type": r.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-multiplan-plan-engine": engineLabel,
    });
    res.end(data);
  } catch (error) {
    const status = String(error?.message || error) === "PAYLOAD_TOO_LARGE" ? 413 : 502;
    json(res, status, { code: "PLAN_UPSTREAM_ERROR", message: String(error) });
  }
}

async function routePlan(req, res) {
  const authorization = authHeader(req);
  if (!authorization.startsWith("Bearer ")) return json(res, 401, { code: "AUTH_REQUIRED" });
  let raw;
  try { raw = await readBody(req); }
  catch (error) { return json(res, 413, { code: "PAYLOAD_TOO_LARGE", message: String(error) }); }

  let body;
  try { body = JSON.parse(raw || "{}"); }
  catch { return json(res, 400, { code: "INVALID_JSON" }); }

  const grades = [...new Set((Array.isArray(body?.grados) ? body.grados : []).map(Number).filter(Number.isInteger))];
  const useProjectCore = PROJECT_CORE_ENABLED && grades.length === 1;

  if (useProjectCore) {
    return forwardPost(res, PROJECT_CORE_URL, raw, authorization, "V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA");
  }

  // Scope protection: multigrade keeps the previously validated V6.2.1 engine.
  return forwardPost(res, CHILD_ORIGIN + "/api/gemini-plan", raw, authorization, "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE");
}

async function stableProxy(req, res) {
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
    json(res, 502, { code: "STABLE_V086_UPSTREAM_ERROR", message: String(error) });
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
        projectCoreEnabled: PROJECT_CORE_ENABLED,
        projectCoreScope: "single-grade-only",
        singleGradeEngine: PROJECT_CORE_ENABLED ? "V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA" : "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",
        multiGradeEngine: "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",
        stableBackup: "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",
        stableEntryPoint: "server-v086.mjs",
        child: childHealth,
      });
    } catch (error) {
      return json(res, 503, { ok: false, version: "0.8.6", code: "STABLE_CHILD_NOT_READY", message: String(error) });
    }
  }

  if (req.method === "POST" && req.url === "/api/gemini-plan") return routePlan(req, res);
  return stableProxy(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan Project Core router listening on ${PORT}; stable v0.8.6 child on ${CHILD_PORT}; projectCore=${PROJECT_CORE_ENABLED}; scope=single-grade-only`);
});
