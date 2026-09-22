import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ENGINE = "V6.5-METHODOLOGY-ENGINE-BETA.9-TRANSVERSAL-ISOLATION";
const MODEL = "gemini-3.5-flash-lite";
const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI = Deno.env.get("Multiplan")!;
const BETA7 = `${URL}/functions/v1/plan-support-methodology-v65-beta7`;
const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", ...extra } });
const nums = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map(Number).filter(Number.isInteger))];
const strs = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map((v) => String(v).trim()).filter(Boolean))];
const norm = (x: unknown) => String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
const key = (x: any) => `${Number(x.session_number)}|${Number(x.moment)}|${Number(x.grade)}|${String(x.mode)}`;
const STOP = new Set(["para", "como", "cada", "debe", "deben", "grado", "alumnos", "docente", "trabajo", "proyecto", "sesion"]);
const words = (x: unknown) => [...new Set(norm(x).split(" ").filter((w) => w.length >= 5 && !STOP.has(w)))];

const stepSchema = { type: "OBJECT", properties: {
  step: { type: "INTEGER" }, minutes: { type: "INTEGER" }, student_action: { type: "STRING" },
  teacher_support_or_preinstruction: { type: "STRING" }, self_check: { type: "STRING" },
  if_stuck: { type: "STRING" }, expected_result: { type: "STRING" },
}, required: ["step", "minutes", "student_action", "teacher_support_or_preinstruction", "self_check", "if_stuck", "expected_result"] };
const taskSchema = { type: "OBJECT", properties: {
  session_number: { type: "INTEGER" }, moment: { type: "INTEGER" }, grade: { type: "INTEGER" },
  mode: { type: "STRING", enum: ["DIRECT", "AUTONOMOUS"] }, methodology_phase: { type: "STRING" },
  action: { type: "STRING" }, procedure: { type: "ARRAY", minItems: 3, maxItems: 6, items: stepSchema }, evidence: { type: "STRING" },
  product_contribution: { type: "STRING" }, transition: { type: "STRING" }, methodology_link: { type: "STRING" },
}, required: ["session_number", "moment", "grade", "mode", "methodology_phase", "action", "procedure", "evidence", "product_contribution", "transition", "methodology_link"] };
const responseSchema = { type: "OBJECT", properties: {
  methodology: { type: "STRING" }, phase_sequence: { type: "ARRAY", items: { type: "OBJECT", properties: {
    session_number: { type: "INTEGER" }, phase: { type: "STRING" }, purpose: { type: "STRING" },
  }, required: ["session_number", "phase", "purpose"] } },
  tasks: { type: "ARRAY", items: taskSchema },
  grade_contributions: { type: "ARRAY", items: { type: "OBJECT", properties: {
    grade: { type: "INTEGER" }, contribution: { type: "STRING" }, evidence: { type: "STRING" },
    why_it_matters: { type: "STRING" },
  }, required: ["grade", "contribution", "evidence", "why_it_matters"] } },
}, required: ["methodology", "phase_sequence", "tasks", "grade_contributions"] };

const SYSTEM = `Eres especialista en metodologias de la Nueva Escuela Mexicana y primaria multigrado. Reescribe UNICAMENTE las tareas de grados SIN PDA. No recibes PDA, contenidos oficiales, LTG ni criterios de otros grados. Conserva exactamente las claves de cada tarea, su modo y minutos. La metodologia elegida debe verse en una secuencia real entre sesiones, pero cada actividad debe seguir anclada en safe_action, safe_evidence y product_contribution. Cada procedure debe contener obligatoriamente entre 3 y 6 pasos concretos; la suma exacta de minutes debe ser igual a los minutes de la tarea. forbidden_concepts es una barrera estricta: no uses esos conceptos, sinonimos ni actividades equivalentes. DIRECT incluye intervencion concreta del docente. AUTONOMOUS incluye instruccion previa, autocontrol y alternativa si el alumno se atora, sin interrumpir al docente. No inventes beneficiarios, internet, dispositivos, visitas, cantidades, porcentajes, resultados medicos ni recursos no proporcionados. Devuelve una tarea por cada required_task, sin omitir ni agregar claves.`;

async function callGemini(prompt: unknown) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": GEMINI },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(prompt) }] }], generationConfig: { responseMimeType: "application/json", responseSchema } }),
    signal: AbortSignal.timeout(180000),
  });
  const raw = await r.json();
  if (!r.ok) throw new Error(`GEMINI_${r.status}:${JSON.stringify(raw).slice(0, 700)}`);
  const text = raw?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
  if (!text) throw new Error("GEMINI_EMPTY");
  return JSON.parse(text);
}

function safeTasks(base: any, trans: number[]) {
  const t = new Set(trans), out: any[] = [];
  for (const s of base?.sessions || []) for (const m of s?.work_moments || []) {
    for (const g of m?.grade_tasks || []) {
      if (!t.has(Number(g.grade)) || g.curriculum_mode !== "TRANSVERSAL_PROJECT") continue;
      out.push({ session_number: Number(s.session_number), moment: Number(m.moment), grade: Number(g.grade), mode: String(g.mode), minutes: Number(m.minutes), safe_action: String(g.action || ""), safe_evidence: String(g.evidence || ""), assessment: String(g.assessment || ""), product_contribution: String(g.product_contribution || "") });
    }
  }
  return out;
}

function core(base: any, sessions: any[]) {
  const project = (s: any) => (s || []).map((x: any) => ({ session_number: Number(x.session_number), total_minutes: Number(x.total_minutes), work_moments: (x.work_moments || []).map((m: any) => ({ moment: Number(m.moment), minutes: Number(m.minutes), direct_teacher_grades: nums(m.direct_teacher_grades).sort(), direct_teacher_pda_ids: strs(m.direct_teacher_pda_ids).sort(), direct_ltg_refs: m.direct_ltg_refs || [], other_blocks: (m.other_blocks || []).map((b: any) => ({ grades: nums(b.grades).sort(), pda_ids: strs(b.pda_ids).sort(), ltg_refs: b.ltg_refs || [] })) })) }));
  return JSON.stringify(project(base?.sessions)) === JSON.stringify(project(sessions));
}

function validate(generated: any, required: any[], forbidden: string[], methodology: string) {
  const errors: string[] = [], expected = new Map(required.map((x: any) => [key(x), x])), got = new Map();
  for (const x of generated?.tasks || []) { const k = key(x); if (got.has(k)) errors.push(`duplicate_${k}`); got.set(k, x); }
  for (const k of expected.keys()) if (!got.has(k)) errors.push(`missing_${k}`);
  for (const k of got.keys()) if (!expected.has(k)) errors.push(`unexpected_${k}`);
  const hits: any[] = [];
  for (const [k, x] of got) {
    const src: any = expected.get(k); if (!src) continue;
    const procedure = Array.isArray(x.procedure) ? x.procedure : [];
    if (procedure.length < 3 || procedure.length > 6) errors.push(`steps_${k}`);
    const sum = procedure.reduce((n: number, p: any) => n + Math.max(0, Number(p.minutes) || 0), 0);
    if (sum !== Number(src.minutes)) errors.push(`minutes_${k}_${sum}_${src.minutes}`);
    const anchor = new Set(words(`${src.safe_action} ${src.safe_evidence} ${src.product_contribution}`));
    const used = words(`${x.action} ${JSON.stringify(procedure)} ${x.evidence} ${x.product_contribution}`).filter((w) => anchor.has(w));
    if (used.length < Math.min(2, anchor.size)) errors.push(`anchor_${k}`);
    const text = norm(JSON.stringify(x)); const found = forbidden.filter((term) => text.includes(norm(term)));
    if (found.length) hits.push({ key: k, terms: found });
  }
  if (norm(generated?.methodology) !== norm(methodology)) errors.push("methodology_changed");
  const sessionIds = [...new Set(required.map((x: any) => x.session_number))].sort((a, b) => a - b);
  const phaseIds = (generated?.phase_sequence || []).map((x: any) => Number(x.session_number)).sort((a: number, b: number) => a - b);
  if (JSON.stringify(sessionIds) !== JSON.stringify(phaseIds)) errors.push("phase_coverage");
  return { errors, hits, tasks: got };
}

function apply(out: any, base: any, generated: any, trans: number[]) {
  const t = new Set(trans), map = new Map((generated.tasks || []).map((x: any) => [key(x), x]));
  for (const s of out?.methodology_engine?.transformed_sessions || []) {
    const bs = (base.sessions || []).find((x: any) => Number(x.session_number) === Number(s.session_number));
    for (const m of s.work_moments || []) {
      const bm = (bs?.work_moments || []).find((x: any) => Number(x.moment) === Number(m.moment));
      const selected = (m.grade_tasks || []).filter((x: any) => !t.has(Number(x.grade)));
      const transverse: any[] = [];
      for (const g of bm?.grade_tasks || []) {
        if (!t.has(Number(g.grade))) continue;
        const x: any = map.get(key({ session_number: s.session_number, moment: m.moment, grade: g.grade, mode: g.mode }));
        if (!x) continue;
        transverse.push({ grade: Number(g.grade), curriculum_mode: "TRANSVERSAL_PROJECT", pda_ids: [], mode: x.mode, action: x.action, procedure: x.procedure, evidence: x.evidence, product_contribution: x.product_contribution, transition: x.transition, methodology_phase: x.methodology_phase, methodology_link: x.methodology_link, source: "V65_BETA9_ISOLATED_TRANSVERSAL" });
      }
      m.grade_tasks = [...selected, ...transverse].sort((a: any, b: any) => Number(a.grade) - Number(b.grade));
      m.transversal_methodology_tasks = transverse;
    }
  }
  const gc = new Map((generated.grade_contributions || []).map((x: any) => [Number(x.grade), x]));
  const rows = out?.methodology_engine?.integrated_project?.grade_contributions || [];
  for (const row of rows) if (t.has(Number(row.grade))) {
    const x: any = gc.get(Number(row.grade));
    row.curricular_mode = "TRANSVERSAL_PROJECT"; row.pda_ids = [];
    if (x) { row.evidence = x.evidence; row.function_in_collective_product = x.contribution; row.why_it_matters = x.why_it_matters; }
    row.curricular_note = `${row.grade}.º participa con una tarea adaptada al proyecto comun, sin PDA ni LTG atribuidos automaticamente.`;
  }
  out.methodology_engine.transversal_methodology = { status: "APPLIED", isolation: "NO_FOREIGN_PDA_OR_LTG_IN_PROMPT", methodology: generated.methodology, phase_sequence: generated.phase_sequence, grades: trans };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  let runId: string | null = null;
  try {
    const auth = req.headers.get("Authorization") || "", token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json({ code: "AUTH_REQUIRED" }, 401);
    const au = await db.auth.getUser(token); if (au.error || !au.data.user?.id) return json({ code: "AUTHENTICATED_USER_REQUIRED" }, 401);
    const body = await req.json(), base = body?.base_plan;
    if (!base?.engineVersion?.startsWith("V6.4")) return json({ code: "V65_BETA9_REQUIRES_V64_BASE_PLAN" }, 400);
    const trans = nums(base.transversal_grades || []), methodology = String(body.methodology_selection || body.metodologia || "auto");
    const upstream = await fetch(BETA7, { method: "POST", headers: { "content-type": "application/json", Authorization: auth }, body: JSON.stringify(body), signal: AbortSignal.timeout(420000) });
    const text = await upstream.text(); let out: any; try { out = JSON.parse(text); } catch { return json({ code: "V65_BETA9_BETA7_PARSE_ERROR" }, 502); }
    if (!upstream.ok) return json({ code: "V65_BETA9_BETA7_FAILED", upstream: out }, 502);
    const primary = out?.methodology_engine?.methodology_primary;
    const selected = out?.methodology_engine?.selected_methodology;
    const chosen = String(
      (primary && typeof primary === "object" ? primary.label || primary.id : primary) ||
      (selected && typeof selected === "object" ? selected.label || selected.id : selected) ||
      methodology,
    );
    const required = safeTasks(base, trans), forbidden = strs(base?.transversal_forbidden_policy?.match_terms || []);
    let generated = { methodology: chosen, phase_sequence: [], tasks: [], grade_contributions: [] };
    if (required.length) generated = await callGemini({ problem: String(body.situacion_problema || ""), context: String(body.contexto || ""), resources: String(body.recursos || ""), supports: String(body.apoyos || ""), methodology: chosen, transversal_grades: trans, forbidden_concepts: forbidden, required_tasks: required, instruction: "La fase metodologica organiza la tarea segura; no sustituye su tema ni importa contenidos curriculares." });
    const check = validate(generated, required, forbidden, chosen);
    apply(out, base, generated, trans);
    const sessions = out?.methodology_engine?.transformed_sessions || [], immutable = core(base, sessions);
    const upstreamApproved = out?.methodology_engine?.validator?.status === "APROBADO";
    const gates = { upstream_approved: upstreamApproved, immutable_core_identical: immutable, exact_transversal_coverage: check.errors.filter((x) => /^(missing|unexpected|duplicate)/.test(x)).length === 0, no_foreign_concepts: check.hits.length === 0, transversal_procedure_valid: check.errors.length === 0, teacher_selection_preserved: true };
    const status = Object.values(gates).every(Boolean) ? "APROBADO" : "REVISAR";
    const ins = await db.from("plan_runs").insert({ user_id: au.data.user.id, engine_version: ENGINE, retrieval_version: `${base.engineVersion}+METHODOLOGY-TRANSVERSAL-ISOLATION-V9`, input_json: { situacion_problema: body.situacion_problema || null, methodology_selection: methodology, transversal_grades: trans }, retrieval_json: { base_run_id: base.run_id || null, beta7_run_id: out.run_id || null }, model_provider: "google", model_name: required.length ? MODEL : "none-extra", status, request_hash: crypto.randomUUID() }).select("run_id").single();
    if (ins.data?.run_id) runId = ins.data.run_id;
    out.engineVersion = ENGINE; out.run_id = runId; out.base_run_id = base.run_id || null; out.base_engine_version = base.engineVersion;
    out.methodology_engine.version = ENGINE;
    out.methodology_engine.validator = { ...out.methodology_engine.validator, status, errors: [...(out?.methodology_engine?.validator?.errors || []), ...check.errors, ...check.hits.map((x) => `foreign_concept_${x.key}_${x.terms.join("_")}`)], warnings: status === "APROBADO" ? [] : ["La capa metodologica transversal permanece no visible hasta superar todas las compuertas."], gates, transversal_isolation: { grades: trans, required_tasks: required.length, generated_tasks: generated.tasks?.length || 0, forbidden_terms: forbidden, hits: check.hits, prompt_excludes_pda_ltg: true } };
    if (runId) await db.from("plan_runs").update({ model_output_json: out, validator_json: out.methodology_engine.validator, status, error_message: null }).eq("run_id", runId);
    return json(out, 200, { "x-multiplan-plan-engine": ENGINE, "x-multiplan-v65-mode": "shadow-non-governing" });
  } catch (e) {
    if (runId) await db.from("plan_runs").update({ status: "ERROR", error_message: String(e) }).eq("run_id", runId);
    return json({ code: "V65_BETA9_ERROR", run_id: runId, message: String(e) }, 500, { "x-multiplan-plan-engine": ENGINE });
  }
});
