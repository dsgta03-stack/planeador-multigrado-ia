import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ENGINE = "V6.5-METHODOLOGY-ENGINE-BETA.10-PROMOTION-GATE";
const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BETA9 = `${URL}/functions/v1/plan-support-methodology-v65-beta9`;
const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", ...extra } });
const nums = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map(Number).filter(Number.isInteger))];
const strs = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map((v) => String(v).trim()).filter(Boolean))].sort();
const stable = (x: unknown) => JSON.stringify(x);

function coreRows(sessions: any[]) {
  return (sessions || []).map((s: any) => ({
    session_number: Number(s.session_number),
    total_minutes: Number(s.total_minutes),
    work_moments: (s.work_moments || []).map((m: any) => ({
      moment: Number(m.moment),
      minutes: Number(m.minutes),
      direct_teacher_grades: nums(m.direct_teacher_grades).sort((a, b) => a - b),
      direct_teacher_pda_ids: strs(m.direct_teacher_pda_ids),
      direct_ltg_refs: m.direct_ltg_refs || [],
      other_blocks: (m.other_blocks || []).map((b: any) => ({
        grades: nums(b.grades).sort((a, c) => a - c),
        pda_ids: strs(b.pda_ids),
        ltg_refs: b.ltg_refs || [],
      })),
    })),
  }));
}

function selectedTaskRows(sessions: any[], transverse: Set<number>) {
  const rows: any[] = [];
  for (const s of sessions || []) for (const m of s.work_moments || []) for (const t of m.grade_tasks || []) {
    const grade = Number(t.grade);
    if (transverse.has(grade)) continue;
    rows.push({
      session_number: Number(s.session_number),
      moment: Number(m.moment),
      grade,
      mode: String(t.mode || ""),
      curriculum_mode: String(t.curriculum_mode || ""),
      pda_ids: strs(t.pda_ids),
      ltg_refs: t.ltg_refs || [],
    });
  }
  return rows.sort((a, b) => stable(a).localeCompare(stable(b)));
}

function transversalRows(sessions: any[], transverse: Set<number>) {
  const rows: any[] = [];
  for (const s of sessions || []) for (const m of s.work_moments || []) for (const t of m.grade_tasks || []) {
    const grade = Number(t.grade);
    if (!transverse.has(grade)) continue;
    rows.push({
      session_number: Number(s.session_number),
      moment: Number(m.moment),
      grade,
      mode: String(t.mode || ""),
      curriculum_mode: String(t.curriculum_mode || ""),
      pda_ids: strs(t.pda_ids),
      ltg_refs: t.ltg_refs || [],
      has_procedure: Array.isArray(t.procedure) && t.procedure.length >= 3 && t.procedure.length <= 6,
    });
  }
  return rows.sort((a, b) => stable(a).localeCompare(stable(b)));
}

function expectedTransversalKeys(base: any, transverse: Set<number>) {
  const keys: string[] = [];
  for (const s of base?.sessions || []) for (const m of s.work_moments || []) {
    const direct = new Set(nums(m.direct_teacher_grades));
    const auto = new Set((m.other_blocks || []).flatMap((b: any) => nums(b.grades)));
    for (const grade of transverse) {
      const mode = direct.has(grade) ? "DIRECT" : auto.has(grade) ? "AUTONOMOUS" : "";
      if (mode) keys.push(`${Number(s.session_number)}|${Number(m.moment)}|${grade}|${mode}`);
    }
  }
  return keys.sort();
}

function actualTransversalKeys(rows: any[]) {
  return rows.map((r: any) => `${r.session_number}|${r.moment}|${r.grade}|${r.mode}`).sort();
}

function minutesAreExact(sessions: any[], transverse: Set<number>) {
  for (const s of sessions || []) for (const m of s.work_moments || []) for (const t of m.grade_tasks || []) {
    if (!transverse.has(Number(t.grade))) continue;
    if (!Array.isArray(t.procedure) || t.procedure.length < 3 || t.procedure.length > 6) return false;
    const total = t.procedure.reduce((sum: number, p: any) => sum + Math.max(0, Number(p.minutes) || 0), 0);
    if (total !== Number(m.minutes)) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  let runId: string | null = null;
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json({ code: "AUTH_REQUIRED" }, 401);
    const au = await db.auth.getUser(token);
    if (au.error || !au.data.user?.id) return json({ code: "AUTHENTICATED_USER_REQUIRED" }, 401);

    const body = await req.json();
    const base = body?.base_plan;
    if (!base?.engineVersion?.startsWith("V6.4")) return json({ code: "V65_BETA10_REQUIRES_V64_BASE_PLAN" }, 400);

    const upstream = await fetch(BETA9, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: auth },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(560000),
    });
    const text = await upstream.text();
    let out: any;
    try { out = JSON.parse(text); } catch { return json({ code: "V65_BETA10_BETA9_PARSE_ERROR" }, 502); }
    if (!upstream.ok) return json({ code: "V65_BETA10_BETA9_FAILED", upstream: out }, 502);

    const sessions = out?.methodology_engine?.transformed_sessions || [];
    const transverse = new Set(nums(base?.transversal_grades));
    const selectedBefore = selectedTaskRows(base?.sessions || [], transverse);
    const selectedAfter = selectedTaskRows(sessions, transverse);
    const transRows = transversalRows(sessions, transverse);
    const expectedKeys = expectedTransversalKeys(base, transverse);
    const actualKeys = actualTransversalKeys(transRows);

    const upstreamApproved = out?.methodology_engine?.validator?.status === "APROBADO";
    const gates = {
      beta9_approved: upstreamApproved,
      immutable_v64_core: stable(coreRows(base?.sessions || [])) === stable(coreRows(sessions)),
      teacher_selection_preserved: stable(selectedBefore) === stable(selectedAfter),
      exact_transversal_coverage: stable(expectedKeys) === stable(actualKeys),
      transversal_pda_empty: transRows.every((r: any) => r.pda_ids.length === 0),
      transversal_ltg_empty: transRows.every((r: any) => !r.ltg_refs || r.ltg_refs.length === 0),
      transversal_mode_explicit: transRows.every((r: any) => r.curriculum_mode === "TRANSVERSAL_PROJECT"),
      transversal_procedure_shape_valid: transRows.every((r: any) => r.has_procedure),
      transversal_minutes_exact: minutesAreExact(sessions, transverse),
    };
    const status = Object.values(gates).every(Boolean) ? "APROBADO" : "REVISAR";
    const failures = Object.entries(gates).filter(([, ok]) => !ok).map(([name]) => name);

    const inserted = await db.from("plan_runs").insert({
      user_id: au.data.user.id,
      engine_version: ENGINE,
      retrieval_version: `${base.engineVersion}+BETA9+DETERMINISTIC-PROMOTION-GATE`,
      input_json: { methodology_selection: body.methodology_selection || body.metodologia || "auto", transversal_grades: [...transverse] },
      retrieval_json: { base_run_id: base.run_id || null, beta9_run_id: out.run_id || null },
      model_provider: "composite",
      model_name: "beta9+deterministic-promotion-gate",
      status,
      request_hash: crypto.randomUUID(),
    }).select("run_id").single();
    if (inserted.data?.run_id) runId = inserted.data.run_id;

    out.engineVersion = ENGINE;
    out.run_id = runId;
    out.base_run_id = base.run_id || null;
    out.beta9_run_id = out.beta9_run_id || out?.methodology_engine?.beta9_run_id || null;
    out.methodology_engine.version = ENGINE;
    out.methodology_engine.promotion_gate = {
      status,
      promotable: status === "APROBADO",
      gates,
      failures,
      teacher_selection_fingerprint: { before_count: selectedBefore.length, after_count: selectedAfter.length, exact: gates.teacher_selection_preserved },
      transversal_fingerprint: { expected_count: expectedKeys.length, actual_count: actualKeys.length, exact: gates.exact_transversal_coverage },
    };
    out.methodology_engine.validator = {
      ...out.methodology_engine.validator,
      status,
      gates: { ...(out.methodology_engine.validator?.gates || {}), ...gates },
      promotion_failures: failures,
      warnings: status === "APROBADO" ? [] : ["V6.5 Beta.10 permanece no gobernante hasta superar todas las compuertas deterministas."],
    };

    if (runId) await db.from("plan_runs").update({ model_output_json: out, validator_json: out.methodology_engine.validator, status, error_message: failures.length ? failures.join(",") : null }).eq("run_id", runId);
    return json(out, 200, { "x-multiplan-plan-engine": ENGINE, "x-multiplan-v65-mode": "promotion-candidate-shadow" });
  } catch (e) {
    if (runId) await db.from("plan_runs").update({ status: "ERROR", error_message: String(e) }).eq("run_id", runId);
    return json({ code: "V65_BETA10_ERROR", run_id: runId, message: String(e) }, 500, { "x-multiplan-plan-engine": ENGINE });
  }
});
