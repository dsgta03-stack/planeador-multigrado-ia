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
const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const safeText = (v: unknown, max = 900) => String(v ?? "").trim().slice(0, max);

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

function pdaTraceFindings(plan: any, authoritativeIds: string[]) {
  if (!Array.isArray(plan?.sessions) || !plan.sessions.length) return [];
  const findings: any[] = [];
  for (const s of plan.sessions) {
    const declared = strings(s?.pda_ids);
    const actual = actualSessionPdas(s);
    if (!actual.length || sameSet(declared, actual)) continue;
    const n = Number(s?.session_number) || null;
    if (authoritativeIds.length > 1 && sameSet(declared, authoritativeIds) && !sameSet(actual, authoritativeIds)) {
      findings.push({
        rule_id: "PDA-04", severity: "CRITICAL", status: "FAIL", scope: { session_number: n },
        failure: `La sesión declara los ${declared.length} PDA seleccionados, pero sus actividades trazables sólo movilizan ${actual.length}.`,
        pedagogical_reason: "No deben marcarse automáticamente todos los PDA como trabajados en todas las sesiones.",
        expected_behavior: "Declarar por sesión únicamente los PDA realmente movilizados; los demás deben quedar en desarrollo o no movilizados.",
        observed_evidence: `PDA declarados: ${declared.join(", ")}. PDA presentes en momentos de trabajo: ${actual.join(", ")}.`,
        recommendation: "Ajustar la trazabilidad de la sesión sin cambiar la selección curricular del docente.",
        source: "DETERMINISTIC-CONTEXT-POSTCHECK",
      });
    } else {
      findings.push({
        rule_id: "PDA-03", severity: "CRITICAL", status: "FAIL", scope: { session_number: n },
        failure: "Los PDA declarados en la cabecera de la sesión no coinciden con los PDA realmente movilizados en sus momentos de trabajo.",
        pedagogical_reason: "La trazabilidad por sesión debe distinguir con fidelidad qué PDA se trabajan, se desarrollan o no se movilizan.",
        expected_behavior: "La declaración de PDA de la sesión debe corresponder con las actividades y evidencias ejecutables.",
        observed_evidence: `PDA declarados: ${declared.join(", ") || "ninguno"}. PDA presentes en momentos de trabajo: ${actual.join(", ")}.`,
        recommendation: "Corregir la trazabilidad de la sesión sin alterar la selección curricular general del docente.",
        source: "DETERMINISTIC-CONTEXT-POSTCHECK",
      });
    }
  }
  return findings;
}

function methodologySession(plan: any, sessionNumber: number) {
  return (plan?.methodology_engine?.sessions || []).find((x: any) => Number(x?.session_number) === sessionNumber) || null;
}

function matchingRows(plan: any, scope: any) {
  const out: any[] = [];
  const n = Number(scope?.session_number || 0);
  const g = Number(scope?.grade || 0);
  const pda = String(scope?.pda_id || "").trim();
  const sessions = (plan?.sessions || []).filter((s: any) => !n || Number(s?.session_number) === n);
  for (const s of sessions) {
    for (const m of s?.work_moments || []) {
      const directPdas = strings(m?.direct_teacher_pda_ids);
      const directGrades = (m?.direct_teacher_grades || []).map(Number);
      if ((!pda || directPdas.includes(pda)) && (!g || directGrades.includes(g))) {
        if (m?.direct_teacher_action) out.push({ kind: "direct", action: safeText(m.direct_teacher_action), evidence: "", grades: directGrades, pda_ids: directPdas });
      }
      for (const b of m?.other_blocks || []) {
        const ids = strings(b?.pda_ids), grades = (b?.grades || []).map(Number);
        if ((!pda || ids.includes(pda)) && (!g || grades.includes(g))) out.push({ kind: "block", action: safeText(b?.activity || b?.action || b?.task), evidence: safeText(b?.evidence), grades, pda_ids: ids });
      }
      for (const t of m?.grade_tasks || []) {
        const ids = strings(t?.pda_ids), grade = Number(t?.grade || 0);
        if ((!pda || ids.includes(pda)) && (!g || grade === g)) out.push({ kind: "task", action: safeText(t?.action), evidence: safeText(t?.evidence), grades: grade ? [grade] : [], pda_ids: ids });
      }
    }
  }
  return out;
}

function isObservableEvidence(value: unknown) {
  const v = norm(value);
  if (!v) return false;
  const artifact = /(tarjeta|ficha|dibujo|resumen|registro|linea del tiempo|mapa|mural|texto|ensayo|album|cuadro|reporte|guion|lista|boceto|presentacion|exposicion|relato|grafica|tabla|modelo|cartel|infografia|bitacora|portafolio)/;
  if (artifact.test(v)) return true;
  if (/^(participacion|observacion|actividad|trabajo realizado|asistencia|escucho|escucha)$/.test(v)) return false;
  return v.length >= 18 && !/^(participacion en|observacion directa|actividad de|trabajo en)/.test(v);
}

function hasObservableEvidence(plan: any, scope: any) {
  const rows = matchingRows(plan, scope);
  if (rows.some(r => isObservableEvidence(r.evidence))) return true;
  const pda = String(scope?.pda_id || "").trim();
  if (pda) {
    const ev = (plan?.evaluation || []).find((x: any) => String(x?.pda_id || "") === pda);
    if (ev && isObservableEvidence(ev?.evidence)) return true;
  }
  return false;
}

function sessionHasConcreteAdvance(plan: any, sessionNumber: number) {
  const scope = { session_number: sessionNumber };
  const rows = matchingRows(plan, scope);
  const hasEvidence = rows.some(r => isObservableEvidence(r.evidence));
  const meta = methodologySession(plan, sessionNumber);
  const hasAdvance = !!safeText(meta?.project_advance || meta?.product_relation, 300);
  return hasEvidence && hasAdvance;
}

function pdaObservedEvidence(plan: any, scope: any, officialRows: any[]) {
  const pda = String(scope?.pda_id || "").trim();
  const official = officialRows.find((x: any) => String(x?.pda_id || "") === pda);
  const rows = matchingRows(plan, scope);
  const action = rows.map(r => r.action).find(Boolean) || "";
  const evidence = rows.map(r => r.evidence).find(Boolean) || "";
  const parts = [];
  if (official?.pda_official) parts.push(`PDA oficial: "${safeText(official.pda_official, 420)}"`);
  if (action) parts.push(`Acción ejecutable: "${action}"`);
  if (evidence) parts.push(`Evidencia: "${evidence}"`);
  return parts.join(". ");
}

function multigradeObservedEvidence(plan: any, sessionNumber: number) {
  const s = (plan?.sessions || []).find((x: any) => Number(x?.session_number) === sessionNumber);
  if (!s) return "";
  for (const m of s?.work_moments || []) {
    for (const b of m?.other_blocks || []) {
      const grades = (b?.grades || []).map(Number).filter(Number.isInteger);
      const action = safeText(b?.activity || b?.action || b?.task, 500);
      if (grades.length > 1 && action) return `Grados ${grades.join(", ")}: "${action}"`;
    }
  }
  return "";
}

function calibratedSummary(findings: any[]) {
  const by = (prefixes: string[], ok: string) => {
    const rows = findings.filter((x: any) => prefixes.some(p => String(x?.rule_id || "").startsWith(p)));
    if (!rows.length) return ok;
    return rows.slice(0, 2).map((x: any) => `${x.rule_id}: ${safeText(x.failure, 180)}`).join(" | ");
  };
  return {
    project: by(["PRJ-", "SES-", "COH-"], "Sin hallazgos críticos de trayectoria/progresión en las reglas evaluadas."),
    pda_alignment: by(["PDA-", "EVD-"], "Sin hallazgos críticos de alineación PDA-evidencia en las reglas evaluadas."),
    methodology: by(["MET-"], "Sin hallazgos metodológicos críticos en las reglas evaluadas."),
    multigrade: by(["MG-"], "Sin hallazgos críticos de organización multigrado en las reglas evaluadas."),
    time: by(["TIME-"], "Sin hallazgos críticos de tiempo en las reglas evaluadas."),
  };
}

function mergeAndCalibrate(core: any, plan: any, traceFindings: any[], contextSource: string, officialRows: any[]) {
  if (!core || typeof core !== "object") return core;
  if (!core.rule_results || typeof core.rule_results !== "object") core.rule_results = {};

  const traceByRule = new Map<string, any[]>();
  for (const f of traceFindings) {
    if (!traceByRule.has(f.rule_id)) traceByRule.set(f.rule_id, []);
    traceByRule.get(f.rule_id)!.push(f);
  }
  core.rule_results["PDA-04"] = traceByRule.has("PDA-04")
    ? { status: "FAIL", detail: "Se detectó sobredeclaración de todos los PDA respecto de las actividades trazables." }
    : { status: "PASS", detail: "No se detectó sobredeclaración automática de todos los PDA." };
  core.rule_results["PDA-03"] = traceByRule.has("PDA-03")
    ? { status: "FAIL", detail: "La declaración de PDA por sesión no coincide con sus momentos de trabajo." }
    : { status: "PASS", detail: "La declaración de PDA por sesión coincide con los PDA trazables en las sesiones evaluadas." };

  const authoritative = new Set(["TIME-01", "SES-03", "PRJ-04", "EVD-05", "PDA-06", "PDA-04", "PDA-03"]);
  const suppressed: any[] = [];
  const kept: any[] = [];
  for (const row of Array.isArray(core.findings) ? core.findings : []) {
    const rule = String(row?.rule_id || "");
    const source = String(row?.source || "");
    if (source === "SEMANTIC" && authoritative.has(rule) && core.rule_results?.[rule]?.status === "PASS") {
      suppressed.push({ rule_id: rule, reason: "DETERMINISTIC_PASS", scope: row?.scope || {} });
      continue;
    }
    if (source === "SEMANTIC" && rule === "SES-01" && sessionHasConcreteAdvance(plan, Number(row?.scope?.session_number || 0))) {
      suppressed.push({ rule_id: rule, reason: "CONCRETE_ADVANCE_VERIFIED", scope: row?.scope || {} });
      continue;
    }
    if (source === "SEMANTIC" && rule === "EVD-01" && hasObservableEvidence(plan, row?.scope || {})) {
      suppressed.push({ rule_id: rule, reason: "OBSERVABLE_EVIDENCE_VERIFIED", scope: row?.scope || {} });
      continue;
    }
    const next = { ...row };
    if (source === "SEMANTIC" && rule === "PDA-01") {
      const evidence = pdaObservedEvidence(plan, row?.scope || {}, officialRows);
      if (evidence) next.observed_evidence = evidence;
    }
    if (source === "SEMANTIC" && rule === "MG-01") {
      const evidence = multigradeObservedEvidence(plan, Number(row?.scope?.session_number || 0));
      if (evidence) {
        next.failure = "Varios grados comparten una misma tarea ejecutable sin diferenciación visible de complejidad, apoyo, producto o responsabilidad en ese bloque.";
        next.observed_evidence = evidence;
        next.recommendation = "Diferenciar la tarea por grado de acuerdo con los PDA y después integrar las aportaciones al proyecto común.";
      }
    }
    kept.push(next);
  }

  const rows = [...kept, ...traceFindings];
  const seen = new Set<string>();
  core.findings = rows.filter((x: any) => {
    const key = `${x?.rule_id || ""}|${x?.scope?.session_number || ""}|${x?.scope?.grade || ""}|${x?.scope?.pda_id || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  core.critical_count = core.findings.filter((x: any) => x?.severity === "CRITICAL").length;
  core.warning_count = core.findings.filter((x: any) => x?.severity === "WARNING").length;
  core.status = core.critical_count ? "BLOCKED" : core.warning_count ? "NEEDS_ADJUSTMENT" : (core.semantic_review?.status === "DEGRADED" ? "NEEDS_ADJUSTMENT" : "PEDAGOGICALLY_COHERENT");
  core.score = Math.max(0, 100 - core.critical_count * 15 - core.warning_count * 4);
  if (core.semantic_review?.status === "DEGRADED") core.score = Math.min(core.score, 79);

  const notEvaluable = strings(core.not_evaluable_rules).filter((id: string) => core.rule_results?.[id]?.status !== "PASS" && core.rule_results?.[id]?.status !== "FAIL");
  core.not_evaluable_rules = notEvaluable;
  core.not_evaluable_count = notEvaluable.length;
  core.raw_semantic_summary = core.summary || {};
  core.summary = calibratedSummary(core.findings);
  core.review_context_source = contextSource;
  core.calibration = {
    version: "PEDAGOGICAL-REVIEW-V1.1-SHADOW-CALIBRATION",
    suppressed_semantic_findings: suppressed,
    deterministic_trace_rules: ["PDA-03", "PDA-04"],
  };
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
        id: row.pda_id, grade: Number(row.grade) || null, field: row.field, content: row.content_official, text: row.pda_official,
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

    const trace = pdaTraceFindings(plan, authoritativeIds);
    const merged = mergeAndCalibrate(core, plan, trace, contextSource, officialRows);
    return new Response(JSON.stringify(merged), {
      status: 200,
      headers: {
        ...CORS,
        "content-type": "application/json; charset=utf-8",
        "x-multiplan-pedagogical-review": response.headers.get("x-multiplan-pedagogical-review") || "PEDAGOGICAL-REVIEW-V1-SHADOW",
        "x-multiplan-review-context": baseInput ? "OWNED_BASE_RUN" : "FALLBACK",
        "x-multiplan-review-postcheck": "PEDAGOGICAL-V1.1-CALIBRATED",
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "pedagogical_review_context_error", message: String(error).slice(0, 500) }));
    return json({ code: "PEDAGOGICAL_REVIEW_CONTEXT_ERROR" }, 500);
  }
});
