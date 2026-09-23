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
const strings = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map(v => String(v || "").trim()).filter(Boolean))].sort();
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

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

function actualSessionPdas(session: any) {
  const ids: string[] = [];
  for (const m of session?.work_moments || []) {
    ids.push(...strings(m?.direct_teacher_pda_ids));
    for (const b of m?.other_blocks || []) ids.push(...strings(b?.pda_ids));
    for (const t of m?.grade_tasks || []) ids.push(...strings(t?.pda_ids));
  }
  return strings(ids);
}

function pda04Findings(plan: any, authoritativeIds: string[]) {
  if (authoritativeIds.length < 2 || !Array.isArray(plan?.sessions) || plan.sessions.length < 2) return [];
  const findings: any[] = [];
  for (const s of plan.sessions) {
    const declared = strings(s?.pda_ids);
    const actual = actualSessionPdas(s);
    if (sameSet(declared, authoritativeIds) && actual.length && !sameSet(actual, authoritativeIds)) {
      findings.push({
        rule_id: "PDA-04",
        severity: "CRITICAL",
        status: "FAIL",
        scope: { session_number: Number(s?.session_number) || null },
        failure: `La sesión declara los ${authoritativeIds.length} PDA seleccionados, pero sus actividades trazables sólo movilizan ${actual.length}.`,
        pedagogical_reason: "No deben marcarse automáticamente todos los PDA como trabajados en todas las sesiones.",
        expected_behavior: "Declarar por sesión únicamente los PDA realmente movilizados; los demás deben quedar en desarrollo o no movilizados.",
        observed_evidence: `PDA declarados: ${declared.join(", ")}. PDA presentes en momentos de trabajo: ${actual.join(", ")}.`,
        recommendation: "Ajustar la trazabilidad de la sesión sin cambiar la selección curricular del docente.",
        source: "DETERMINISTIC-CONTEXT-POSTCHECK",
      });
    }
  }
  return findings;
}

function mergePostchecks(core: any, extra: any[], contextSource: string) {
  if (!core || typeof core !== "object") return core;
  const rows = [...(Array.isArray(core.findings) ? core.findings : []), ...extra];
  const seen = new Set<string>();
  core.findings = rows.filter((x: any) => {
    const key = `${x?.rule_id || ""}|${x?.scope?.session_number || ""}|${x?.scope?.grade || ""}|${x?.scope?.pda_id || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!core.rule_results || typeof core.rule_results !== "object") core.rule_results = {};
  if (extra.length) core.rule_results["PDA-04"] = { status: "FAIL", detail: "La declaración de PDA por sesión excede los PDA trazables en sus actividades." };
  else if (!("PDA-04" in core.rule_results)) core.rule_results["PDA-04"] = { status: "PASS", detail: "No se detectó sobredeclaración estructural de PDA por sesión." };
  core.critical_count = core.findings.filter((x: any) => x?.severity === "CRITICAL").length;
  core.warning_count = core.findings.filter((x: any) => x?.severity === "WARNING").length;
  core.status = core.critical_count ? "BLOCKED" : core.warning_count ? "NEEDS_ADJUSTMENT" : (core.semantic_review?.status === "DEGRADED" ? "NEEDS_ADJUSTMENT" : "PEDAGOGICALLY_COHERENT");
  core.score = Math.max(0, Math.min(Number(core.score ?? 100), 100 - core.critical_count * 15 - core.warning_count * 4));
  core.review_context_source = contextSource;
  return core;
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

    const contextSource = baseInput ? "OWNED_BASE_RUN" : "PLAN_AND_REQUEST_FALLBACK";
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
      review_context_source: contextSource,
    };

    const response = await fetch(CORE_REVIEW_URL, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: authorization },
      body: JSON.stringify(enriched),
      signal: AbortSignal.timeout(135_000),
    });
    const raw = await response.text();
    if (!response.ok) return new Response(raw, { status: response.status, headers: { ...CORS, "content-type": response.headers.get("content-type") || "application/json; charset=utf-8" } });
    let core: any;
    try { core = JSON.parse(raw); } catch { return json({ code: "PEDAGOGICAL_REVIEW_INVALID_CORE_RESPONSE" }, 502); }
    const merged = mergePostchecks(core, pda04Findings(plan, authoritativeIds), contextSource);
    return new Response(JSON.stringify(merged), {
      status: 200,
      headers: {
        ...CORS,
        "content-type": "application/json; charset=utf-8",
        "x-multiplan-pedagogical-review": response.headers.get("x-multiplan-pedagogical-review") || "PEDAGOGICAL-REVIEW-V1-SHADOW",
        "x-multiplan-review-context": baseInput ? "OWNED_BASE_RUN" : "FALLBACK",
        "x-multiplan-review-postcheck": "PDA-04-V1",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "pedagogical_review_context_error", message: String(error).slice(0, 500) }));
    return json({ code: "PEDAGOGICAL_REVIEW_CONTEXT_ERROR" }, 500);
  }
});
