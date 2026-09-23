import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CORE_REVIEW_URL = `${URL}/functions/v1/plan-review-pedagogical-v1`;
const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
const strings = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map(v => String(v || "").trim()).filter(Boolean))];

function planPdaIds(plan: any) {
  const ids: string[] = [];
  for (const x of plan?.pda_justifications || []) if (x?.pda_id) ids.push(String(x.pda_id));
  for (const x of plan?.evaluation || []) if (x?.pda_id) ids.push(String(x.pda_id));
  for (const s of plan?.sessions || []) {
    ids.push(...strings(s?.pda_ids));
    for (const m of s?.work_moments || []) {
      ids.push(...strings(m?.direct_teacher_pda_ids));
      for (const b of m?.other_blocks || []) ids.push(...strings(b?.pda_ids));
      for (const t of m?.grade_tasks || []) ids.push(...strings(t?.pda_ids));
    }
  }
  return strings(ids);
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
    const plan = body?.plan;
    if (!plan || typeof plan !== "object") return json({ code: "PLAN_REQUIRED" }, 400);

    let baseInput: any = null;
    const baseRunId = String(plan?.base_run_id || plan?.methodology_engine?.base_run_id || "").trim();
    if (baseRunId) {
      const base = await db.from("plan_runs").select("input_json").eq("run_id", baseRunId).eq("user_id", userId).limit(1).maybeSingle();
      if (!base.error && base.data?.input_json) baseInput = base.data.input_json;
    }

    const authoritativeIds = strings(baseInput?.pda_ids).length ? strings(baseInput?.pda_ids) : planPdaIds(plan);
    let officialRows: any[] = [];
    if (authoritativeIds.length) {
      const pda = await db.from("pda").select("pda_id,grade,field,content_official,pda_official").in("pda_id", authoritativeIds);
      if (!pda.error && Array.isArray(pda.data)) officialRows = pda.data;
    }
    const order = new Map(authoritativeIds.map((id, i) => [id, i]));
    officialRows.sort((a, b) => (order.get(String(a.pda_id)) ?? 9999) - (order.get(String(b.pda_id)) ?? 9999));

    const enriched = {
      ...body,
      context: String(baseInput?.contexto ?? body?.context ?? ""),
      problem: String(baseInput?.situacion_problema ?? body?.problem ?? ""),
      methodology: String(baseInput?.methodology_selection ?? body?.methodology ?? ""),
      requested_sessions: Number(baseInput?.sesiones ?? body?.requested_sessions ?? plan?.requestedSessions ?? 0) || null,
      minutes_per_session: Number(baseInput?.minutos ?? body?.minutes_per_session ?? plan?.minutesPerSession ?? 0) || null,
      selected_pdas: officialRows.length ? officialRows.map(row => ({
        id: row.pda_id,
        grade: Number(row.grade) || null,
        field: row.field,
        content: row.content_official,
        text: row.pda_official,
      })) : (Array.isArray(body?.selected_pdas) ? body.selected_pdas : []),
      review_context_source: baseInput ? "OWNED_BASE_RUN" : "PLAN_AND_REQUEST_FALLBACK",
    };

    const response = await fetch(CORE_REVIEW_URL, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: authorization },
      body: JSON.stringify(enriched),
      signal: AbortSignal.timeout(135_000),
    });
    const data = await response.arrayBuffer();
    return new Response(data, {
      status: response.status,
      headers: {
        ...CORS,
        "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "x-multiplan-pedagogical-review": response.headers.get("x-multiplan-pedagogical-review") || "PEDAGOGICAL-REVIEW-V1-SHADOW",
        "x-multiplan-review-context": baseInput ? "OWNED_BASE_RUN" : "FALLBACK",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "pedagogical_review_context_error", message: String(error).slice(0, 500) }));
    return json({ code: "PEDAGOGICAL_REVIEW_CONTEXT_ERROR" }, 500);
  }
});
