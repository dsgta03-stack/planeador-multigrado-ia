import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V0124_FIDELITY_CHILD_PORT || 7001);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const SNAPSHOT_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/persist-final-plan-snapshot-v1";
const SNAPSHOT_VERSION = "FINAL-PLAN-SNAPSHOT-V1";

const child = spawn(process.execPath, ["server-v0124-pedagogical-review-shadow.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[v0124-fidelity] child exited code=${code} signal=${signal}`);
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
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extra,
  });
  res.end(JSON.stringify(body));
}

function readBody(req, max = 2_500_000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > max) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function bearer(req) {
  const value = String(req.headers.authorization || "");
  return value.startsWith("Bearer ") ? value : "";
}

async function persistSnapshot(authorization, plan) {
  const runId = String(plan?.run_id || "").trim();
  if (!authorization || !runId) return { status: "SKIPPED", reason: !authorization ? "NO_AUTH" : "NO_RUN_ID" };
  try {
    const response = await fetch(SNAPSHOT_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify({ run_id: runId, snapshot: plan }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(JSON.stringify({ event: "final_snapshot_persist_failed", run_id: runId, status: response.status, code: data?.code || null }));
      return { status: "FAILED", code: data?.code || `HTTP_${response.status}` };
    }
    return { status: "PERSISTED", hash: data?.hash_sha256 || "", version: data?.snapshot_version || SNAPSHOT_VERSION };
  } catch (error) {
    console.error(JSON.stringify({ event: "final_snapshot_persist_exception", run_id: runId, message: String(error).slice(0, 300) }));
    return { status: "FAILED", code: "SNAPSHOT_PERSIST_EXCEPTION" };
  }
}

function historyRunId(pathname) {
  const match = pathname.match(/^\/api\/history\/([0-9a-f-]{36})$/i);
  return match?.[1] || "";
}

function applyFinalSnapshot(row) {
  if (!row || typeof row !== "object") return row;
  const validator = row.validator_json && typeof row.validator_json === "object" ? row.validator_json : {};
  const snapshot = validator.final_output_snapshot;
  const meta = validator.final_output_snapshot_meta;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { ...row, snapshot_source: "MODEL_OUTPUT_JSON", snapshot_meta: null };
  }
  return {
    ...row,
    model_output_json: snapshot,
    snapshot_source: "FINAL_OUTPUT_SNAPSHOT",
    snapshot_meta: meta || { schema_version: SNAPSHOT_VERSION },
  };
}

async function proxy(req, res) {
  let rawBody = null;
  try {
    const headers = {};
    for (const name of ["content-type", "authorization", "accept", "cookie", "user-agent"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      rawBody = await readBody(req);
      init.body = rawBody;
    }

    const response = await fetch(CHILD_ORIGIN + (req.url || "/"), init);
    const type = response.headers.get("content-type") || "application/octet-stream";
    const url = new URL(req.url || "/", "http://localhost");

    if (req.method === "POST" && url.pathname === "/api/gemini-plan" && type.includes("application/json")) {
      const text = await response.text();
      let plan = null;
      try { plan = JSON.parse(text); } catch {}
      const persistence = response.ok && plan && typeof plan === "object"
        ? await persistSnapshot(bearer(req), plan)
        : { status: "SKIPPED", reason: "GENERATION_NOT_PERSISTABLE" };
      const outgoing = {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-multiplan-final-snapshot": persistence.status,
        "x-multiplan-final-snapshot-version": persistence.version || SNAPSHOT_VERSION,
      };
      for (const name of [
        "x-multiplan-plan-engine","x-multiplan-safe-fallback","x-multiplan-v65-promotion",
        "x-multiplan-methodology-sequence","x-multiplan-session-count-preserved",
        "x-multiplan-workflow-ui","x-multiplan-pedagogical-review-ui",
      ]) {
        const value = response.headers.get(name); if (value) outgoing[name] = value;
      }
      res.writeHead(response.status, outgoing);
      res.end(text);
      return;
    }

    if (req.method === "GET" && historyRunId(url.pathname) && type.includes("application/json")) {
      const text = await response.text();
      let row = null;
      try { row = JSON.parse(text); } catch {}
      if (response.ok && row && typeof row === "object") {
        const finalRow = applyFinalSnapshot(row);
        return json(res, response.status, finalRow, {
          "x-multiplan-history-snapshot": finalRow.snapshot_source,
          "x-multiplan-final-snapshot-version": finalRow.snapshot_meta?.schema_version || "NONE",
        });
      }
      res.writeHead(response.status, { "content-type": type, "cache-control": "no-store" });
      res.end(text);
      return;
    }

    const data = Buffer.from(await response.arrayBuffer());
    const outgoing = {
      "content-type": type,
      "cache-control": response.headers.get("cache-control") || "no-store",
    };
    for (const name of [
      "x-multiplan-plan-engine","x-multiplan-safe-fallback","x-multiplan-v65-promotion",
      "x-multiplan-methodology-sequence","x-multiplan-session-count-preserved",
      "x-multiplan-workflow-ui","x-multiplan-pedagogical-review-ui",
      "x-multiplan-pedagogical-review","x-multiplan-review-mode","x-multiplan-review-context",
    ]) {
      const value = response.headers.get(name); if (value) outgoing[name] = value;
    }
    res.writeHead(response.status, outgoing);
    res.end(data);
  } catch (error) {
    json(res, String(error).includes("PAYLOAD_TOO_LARGE") ? 413 : 502, {
      code: String(error).includes("PAYLOAD_TOO_LARGE") ? "PAYLOAD_TOO_LARGE" : "V0124_HISTORY_FIDELITY_PROXY_ERROR",
      message: String(error).slice(0, 300),
    });
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/v0124_fidelity_health") {
    return json(res, 200, {
      ok: true,
      version: "0.12.4-shadow+history-fidelity",
      base: "0.12.4-shadow",
      snapshotVersion: SNAPSHOT_VERSION,
      preservesInternalModelOutput: true,
      historyPrefersFinalSnapshot: true,
      productionModified: false,
    });
  }
  return proxy(req, res);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan v0.12.4 shadow + history fidelity on ${PORT}; child ${CHILD_PORT}`);
});