import http from "node:http";
import { spawn } from "node:child_process";

// This outer gateway keeps v0.12.1 intact and patches only the re-entrant UI observer.

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V0122_CHILD_PORT || 6701);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;

const child = spawn(process.execPath, ["server-v0121-plan-history.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let stopping = false;
child.on("exit", (code, signal) => {
  console.error(`[v0122] child exited code=${code} signal=${signal}`);
  if (!stopping) setTimeout(() => process.exit(code || 1), 50);
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    stopping = true;
    try { child.kill(signal); } catch {}
    process.exit(0);
  });
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readBody(req, max = 1_000_000) {
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

const BROKEN_OBSERVER = "new MutationObserver(update).observe(document.documentElement,{childList:true,subtree:true});setTimeout(update,300)";
const FIXED_OBSERVER = "const observer=new MutationObserver(()=>{observer.disconnect();try{update()}finally{observer.observe(document.documentElement,{childList:true,subtree:true})}});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(update,300)";

function patchMethodologyObserver(html) {
  if (!html.includes(BROKEN_OBSERVER)) {
    console.error(JSON.stringify({ event: "methodology_ui_freeze_patch_missing" }));
    return { html, patched: false };
  }
  return { html: html.replace(BROKEN_OBSERVER, FIXED_OBSERVER), patched: true };
}

async function proxy(req, res) {
  try {
    const headers = {};
    for (const name of ["content-type", "authorization", "accept", "cookie", "user-agent"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const response = await fetch(CHILD_ORIGIN + (req.url || "/"), init);
    const type = response.headers.get("content-type") || "application/octet-stream";

    if (req.method === "GET" && type.includes("text/html")) {
      const result = patchMethodologyObserver(await response.text());
      res.writeHead(response.status, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-multiplan-methodology-ui-freeze-fix": result.patched ? "v0.12.2" : "missing",
      });
      res.end(result.html);
      return;
    }

    const data = Buffer.from(await response.arrayBuffer());
    const outgoing = {
      "content-type": type,
      "cache-control": response.headers.get("cache-control") || "no-store",
    };
    for (const name of [
      "x-multiplan-plan-engine",
      "x-multiplan-safe-fallback",
      "x-multiplan-v65-promotion",
      "x-multiplan-methodology-sequence",
      "x-multiplan-session-count-preserved",
    ]) {
      const value = response.headers.get(name);
      if (value) outgoing[name] = value;
    }
    res.writeHead(response.status, outgoing);
    res.end(data);
  } catch (error) {
    json(res, 502, { code: "V0122_PROXY_ERROR", message: String(error) });
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/v0122_health") {
    return json(res, 200, {
      ok: true,
      version: "0.12.2",
      methodologyUi: "OBSERVER_REENTRANCY_GUARD",
      dataChanges: "NONE",
      base: "0.12.1",
    });
  }
  return proxy(req, res);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan v0.12.2 on ${PORT}; methodology UI observer reentrancy guard enabled`);
});
