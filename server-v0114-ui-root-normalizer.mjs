import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_UI_NORMALIZER_CHILD_PORT || 5801);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;

const child = spawn(process.execPath, ["server-v0114-ui-professional-rootfix.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[ui-root-normalizer] child exited code=${code} signal=${signal}`);
  if (!stopping) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => {
  stopping = true;
  try { child.kill(sig); } catch {}
  process.exit(0);
});

function readBody(req, max = 520000) {
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

async function proxy(req, res) {
  try {
    const parsed = new URL(req.url || "/", "http://localhost");
    const targetPath = parsed.pathname === "/" ? "/" : `${parsed.pathname}${parsed.search}`;
    const headers = {};
    for (const name of ["content-type", "authorization", "accept", "cookie", "user-agent"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const upstream = await fetch(CHILD_ORIGIN + targetPath, init);
    const data = Buffer.from(await upstream.arrayBuffer());
    const outHeaders = {
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      "cache-control": "no-store",
      "x-multiplan-root-normalized": parsed.pathname === "/" ? "true" : "false",
    };
    for (const name of [
      "x-multiplan-ui",
      "x-multiplan-plan-engine",
      "x-multiplan-safe-fallback",
      "x-multiplan-v65-promotion",
      "x-multiplan-v64-base",
      "x-multiplan-provider-degraded",
    ]) {
      const value = upstream.headers.get(name);
      if (value) outHeaders[name] = value;
    }
    res.writeHead(upstream.status, outHeaders);
    res.end(data);
  } catch (error) {
    res.writeHead(502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ code: "UI_ROOT_NORMALIZER_ERROR", message: String(error) }));
  }
}

http.createServer(proxy).listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan UI root normalizer on ${PORT}; child rootfix on ${CHILD_PORT}`);
});
