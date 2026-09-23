import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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
    const runId = String(body?.run_id || "").trim();
    const snapshot = body?.snapshot;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) return json({ code: "INVALID_RUN_ID" }, 400);
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return json({ code: "SNAPSHOT_REQUIRED" }, 400);

    const owned = await db.from("plan_runs").select("run_id,user_id,validator_json").eq("run_id", runId).eq("user_id", userId).limit(1).maybeSingle();
    if (owned.error) return json({ code: "SNAPSHOT_LOOKUP_FAILED" }, 502);
    if (!owned.data) return json({ code: "PLAN_NOT_FOUND" }, 404);

    const hash = await sha256(snapshot);
    const validator = owned.data.validator_json && typeof owned.data.validator_json === "object" ? owned.data.validator_json : {};
    const nextValidator = {
      ...validator,
      final_output_snapshot: snapshot,
      final_output_snapshot_meta: {
        schema_version: "FINAL-PLAN-SNAPSHOT-V1",
        hash_sha256: hash,
        captured_at: new Date().toISOString(),
        source: "VISIBLE_HTTP_RESPONSE",
      },
    };
    const updated = await db.from("plan_runs").update({ validator_json: nextValidator, updated_at: new Date().toISOString() }).eq("run_id", runId).eq("user_id", userId).select("run_id").maybeSingle();
    if (updated.error || !updated.data) return json({ code: "SNAPSHOT_PERSIST_FAILED" }, 502);
    return json({ ok: true, run_id: runId, snapshot_version: "FINAL-PLAN-SNAPSHOT-V1", hash_sha256: hash });
  } catch (error) {
    console.error(JSON.stringify({ event: "persist_final_plan_snapshot_v1_error", message: String(error).slice(0, 500) }));
    return json({ code: "SNAPSHOT_PERSIST_ERROR" }, 500);
  }
});