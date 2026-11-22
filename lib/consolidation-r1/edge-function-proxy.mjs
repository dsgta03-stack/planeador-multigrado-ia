const SUPABASE_URL = "https://dvcrwzxznuqongutnifn.supabase.co";
const ROUTES = Object.freeze({
  "/api/retrieve": "evaluate-pda-gemini-lab",
  "/api/material": "generate-teaching-material-lab",
  "/api/methodology-recommendation": "recommend-methodology-v1",
});

export function createEdgeFunctionProxy({ readBody, bearer, json, fetchImpl=fetch } = {}) {
  if (typeof readBody !== "function" || typeof bearer !== "function" || typeof json !== "function" || typeof fetchImpl !== "function") {
    throw Error("CONSOLIDATED_EDGE_PROXY_HELPERS_REQUIRED");
  }
  return async function edgeFunctionProxy(req, res, pathname) {
    const fn = ROUTES[pathname];
    if (!fn) return false;
    if (req.method !== "POST") { json(res, 405, { code: "METHOD_NOT_ALLOWED" }); return true; }
    const authorization = bearer(req);
    if (!authorization) { json(res, 401, { code: "AUTH_REQUIRED" }); return true; }
    try {
      const raw = await readBody(req);
      const response = await fetchImpl(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization },
        body: raw || "{}",
        signal: AbortSignal.timeout(pathname === "/api/methodology-recommendation" ? 90_000 : 140_000),
      });
      const data = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, {
        "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-multiplan-single-app-proxy": fn,
      });
      res.end(data);
    } catch (error) {
      const tooLarge = String(error?.message || error).includes("PAYLOAD_TOO_LARGE");
      json(res, tooLarge ? 413 : 502, { code: tooLarge ? "PAYLOAD_TOO_LARGE" : "UPSTREAM_PROXY_ERROR" });
    }
    return true;
  };
}
