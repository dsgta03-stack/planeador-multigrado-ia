import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const REVIEW_VERSION = "PEDAGOGICAL-REVIEW-V1.1-SHADOW-CALIBRATION";
const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}
async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return json({ code: "AUTH_REQUIRED" }, 401);
    const auth = await db.auth.getUser(token);
    const userId = auth.data.user?.id;
    if (auth.error || !userId) return json({ code: "AUTHENTICATED_USER_REQUIRED" }, 401);

    const body = await req.json();
    const action = String(body?.action || "get").toLowerCase();
    const runId = String(body?.run_id || body?.plan?.run_id || "").trim();
    const plan = body?.plan;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) return json({ code: "INVALID_RUN_ID" }, 400);
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) return json({ code: "PLAN_REQUIRED" }, 400);
    if (!["get","put"].includes(action)) return json({ code: "INVALID_ACTION" }, 400);

    const row = await db.from("plan_runs").select("run_id,user_id,validator_json").eq("run_id", runId).eq("user_id", userId).limit(1).maybeSingle();
    if (row.error) return json({ code: "CACHE_LOOKUP_FAILED" }, 502);
    if (!row.data) return json({ code: "PLAN_NOT_FOUND" }, 404);

    const validator = row.data.validator_json && typeof row.data.validator_json === "object" ? row.data.validator_json : {};
    const planHash = await sha256(plan);
    const snapshotHash = String(validator?.final_output_snapshot_meta?.hash_sha256 || "");
    if (snapshotHash && snapshotHash !== planHash) {
      return json({ code: "SNAPSHOT_HASH_MISMATCH", plan_hash: planHash, snapshot_hash: snapshotHash, review_version: REVIEW_VERSION }, 409);
    }

    const cache = validator?.pedagogical_review_cache;
    if (action === "get") {
      const hit = !!(cache && cache.review_version === REVIEW_VERSION && cache.snapshot_hash === planHash && cache.result && typeof cache.result === "object");
      return json({ hit, review_version: REVIEW_VERSION, snapshot_hash: planHash, result: hit ? cache.result : null });
    }

    const result = body?.result;
    if (!result || typeof result !== "object" || Array.isArray(result)) return json({ code: "REVIEW_RESULT_REQUIRED" }, 400);
    const nextValidator = {
      ...validator,
      pedagogical_review_cache: {
        review_version: REVIEW_VERSION,
        snapshot_hash: planHash,
        stored_at: new Date().toISOString(),
        result,
      },
    };
    const updated = await db.from("plan_runs").update({ validator_json: nextValidator, updated_at: new Date().toISOString() }).eq("run_id", runId).eq("user_id", userId).select("run_id").maybeSingle();
    if (updated.error || !updated.data) return json({ code: "CACHE_PERSIST_FAILED" }, 502);
    return json({ ok: true, review_version: REVIEW_VERSION, snapshot_hash: planHash });
  } catch (error) {
    console.error(JSON.stringify({ event: "pedagogical_review_cache_v1_error", message: String(error).slice(0, 500) }));
    return json({ code: "PEDAGOGICAL_REVIEW_CACHE_ERROR" }, 500);
  }
});