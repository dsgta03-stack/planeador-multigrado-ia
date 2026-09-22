import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.PORT || 3000);
const BACKEND_PORT = Number(process.env.MULTIPLAN_UI_CHILD_PORT || 5701);
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;
const UI_SOURCE_PORT = Number(process.env.MULTIPLAN_UI_SOURCE_PORT || 3101);
const UI_SOURCE_ORIGIN = `http://127.0.0.1:${UI_SOURCE_PORT}`;

const child = spawn(process.execPath, ["server-v0113-v65beta10-promoted.mjs"], {
  env: { ...process.env, PORT: String(BACKEND_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});
let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[ui-v0114-rootfix] child exited code=${code} signal=${signal}`);
  if (!stopping) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => {
  stopping = true;
  try { child.kill(sig); } catch {}
  process.exit(0);
});

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
function readBody(req, max = 520000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => {
      raw += c;
      if (raw.length > max) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}
function between(text, start, end) {
  const a = text.indexOf(start);
  if (a < 0) return "";
  const from = a + start.length;
  const b = text.indexOf(end, from);
  return b < 0 ? "" : text.slice(from, b);
}

const uiWrapperSource = readFileSync(new URL("./server-v0114-ui-professional.mjs", import.meta.url), "utf8");
const professionalStyle = between(uiWrapperSource, "function style(){return String.raw`", "`}\n\nfunction script()");
const professionalScript = between(uiWrapperSource, "function script(){return String.raw`", "`}\n\nasync function proxy");
if (!professionalStyle || !professionalScript) {
  console.error("[ui-v0114-rootfix] unable to extract professional UI assets");
}

async function serveRoot(res) {
  let last = null;
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(UI_SOURCE_ORIGIN + "/", { headers: { "cache-control": "no-cache", accept: "text/html" } });
      const type = r.headers.get("content-type") || "";
      const body = await r.text();
      last = { status: r.status, type, body };
      if (r.ok && type.includes("text/html") && body.includes("</body>")) {
        let html = body;
        html = html.replace("</head>", professionalStyle + "</head>").replace("</body>", professionalScript + "</body>");
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-multiplan-ui": "professional-beta-v2-rootfix",
        });
        res.end(html);
        return;
      }
    } catch (e) {
      last = { error: String(e) };
    }
    await new Promise(r => setTimeout(r, 100));
  }
  json(res, 502, { code: "UI_SOURCE_UNAVAILABLE", detail: last?.error || `status=${last?.status} type=${last?.type}` });
}

async function proxy(req, res) {
  try {
    const headers = {};
    for (const n of ["content-type", "authorization", "accept", "cookie"]) if (req.headers[n]) headers[n] = req.headers[n];
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const r = await fetch(BACKEND_ORIGIN + req.url, init);
    const data = Buffer.from(await r.arrayBuffer());
    const h = { "content-type": r.headers.get("content-type") || "application/octet-stream", "cache-control": r.headers.get("cache-control") || "no-store" };
    for (const n of ["x-multiplan-plan-engine", "x-multiplan-safe-fallback", "x-multiplan-v65-promotion", "x-multiplan-v64-base", "x-multiplan-provider-degraded"]) {
      const v = r.headers.get(n);
      if (v) h[n] = v;
    }
    res.writeHead(r.status, h);
    res.end(data);
  } catch (e) {
    json(res, 502, { code: "UI_BETA_PROXY_ERROR", message: String(e) });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/ui-health") {
    return json(res, 200, {
      ok: true,
      version: "0.11.4-ui-beta-rootfix",
      ui: "PROFESSIONAL-DASHBOARD-V2",
      base: "0.11.3",
      rootSource: "v0.8.4c-ui",
      visibleMultigradePrimary: "V6.5-METHODOLOGY-ENGINE-BETA.10-PROMOTION-GATE",
      visibleMultigradeFallback: "V6.4-MULTIGRADE-DIDACTIC-BETA.6.3-COVERAGE-CONCEPT-GUARD",
      backendBehaviorModified: false,
    });
  }
  if (req.method === "GET" && req.url === "/") return serveRoot(res);
  return proxy(req, res);
});

server.listen(PORT, "0.0.0.0", () => console.log(`Multiplan UI v0.11.4 rootfix on ${PORT}; root from ${UI_SOURCE_PORT}; API via v0.11.3/Beta.10`));
