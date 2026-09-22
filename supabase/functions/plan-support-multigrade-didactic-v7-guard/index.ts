import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ENGINE = "V6.4-MULTIGRADE-DIDACTIC-BETA.6.3-COVERAGE-CONCEPT-GUARD";
const MODEL = "gemini-3.1-flash-lite";
const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI = Deno.env.get("Multiplan")!;
const BASE = `${URL}/functions/v1/plan-support-gemini-transversal-lock`;
const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", ...headers } });
const nums = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map(Number).filter(Number.isInteger))];
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
const rowKey = (x: any) => `${Number(x.session_number)}|${Number(x.moment)}|${Number(x.grade)}|${String(x.mode)}`;

function terms(plan: any) {
  return [...new Set((plan?.transversal_forbidden_policy?.match_terms || []).map(norm).filter((x: string) => x.length >= 4))];
}

function expectedRows(plan: any) {
  const transverse = new Set(nums(plan?.transversal_grades));
  const out: any[] = [];
  for (const session of plan?.sessions || []) {
    for (const moment of session?.work_moments || []) {
      const direct = new Set(nums(moment?.direct_teacher_grades));
      const autonomous = new Set((moment?.other_blocks || []).flatMap((block: any) => nums(block?.grades)));
      for (const grade of transverse) {
        const mode = direct.has(grade) ? "DIRECT" : autonomous.has(grade) ? "AUTONOMOUS" : "";
        if (!mode) continue;
        out.push({ session_number: Number(session.session_number), moment: Number(moment.moment), grade, mode, minutes: Number(moment.minutes) });
      }
    }
  }
  return out;
}

function executionRows(plan: any) {
  const out: any[] = [];
  for (const session of plan?.sessions || []) for (const moment of session?.work_moments || []) for (const execution of moment?.transversal_execution || []) {
    out.push({ ...execution, session_number: Number(session.session_number), moment: Number(moment.moment), grade: Number(execution.grade), mode: String(execution.mode || "") });
  }
  return out;
}

function conceptHits(plan: any, forbidden: string[]) {
  const out: any[] = [];
  for (const execution of executionRows(plan)) {
    const text = norm(JSON.stringify(execution));
    const hitTerms = forbidden.filter((term) => text.includes(term));
    if (hitTerms.length) out.push({ ...execution, hit_terms: hitTerms });
  }
  return out;
}

const stepSchema = { type: "OBJECT", properties: { step: { type: "INTEGER" }, minutes: { type: "INTEGER" }, student_action: { type: "STRING" }, teacher_support_or_preinstruction: { type: "STRING" }, self_check: { type: "STRING" }, if_stuck: { type: "STRING" }, expected_result: { type: "STRING" } }, required: ["step", "minutes", "student_action", "teacher_support_or_preinstruction", "self_check", "if_stuck", "expected_result"] };
const executionSchema = { type: "OBJECT", properties: { session_number: { type: "INTEGER" }, moment: { type: "INTEGER" }, grade: { type: "INTEGER" }, mode: { type: "STRING", enum: ["DIRECT", "AUTONOMOUS"] }, activity_title: { type: "STRING" }, action_detail: { type: "STRING" }, procedure: { type: "ARRAY", minItems: 3, maxItems: 6, items: stepSchema }, evidence_detail: { type: "STRING" }, product_contribution: { type: "STRING" }, transition: { type: "STRING" } }, required: ["session_number", "moment", "grade", "mode", "activity_title", "action_detail", "procedure", "evidence_detail", "product_contribution", "transition"] };
const responseSchema = { type: "OBJECT", properties: { executions: { type: "ARRAY", items: executionSchema } }, required: ["executions"] };

const SYSTEM = `Eres especialista en ejecución didáctica multigrado. Genera únicamente tareas para grados SIN PDA. No recibes PDA, contenidos oficiales, LTG, criterios ni tareas de grados con PDA. Usa sólo la problemática, contexto, características del grado, recursos y apoyos proporcionados. Cada required_task debe producir exactamente una ejecución con las mismas claves, modo y minutos. Cada procedimiento debe tener de 3 a 6 pasos y sumar exactamente los minutos de required_task. forbidden_concepts es una barrera estricta: no uses esos términos, sinónimos ni actividades equivalentes. DIRECT incluye apoyo concreto del docente. AUTONOMOUS incluye instrucción previa, autocontrol y una alternativa si el alumnado se atora sin interrumpir al docente. Mantén una progresión entre sesiones hacia un producto común. No inventes internet, dispositivos, visitas, beneficiarios, cantidades, resultados médicos ni recursos no declarados.`;

async function callGemini(prompt: unknown) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": GEMINI },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: [{ role: "user", parts: [{ text: JSON.stringify(prompt) }] }], generationConfig: { responseMimeType: "application/json", responseSchema } }), signal: AbortSignal.timeout(180000),
  });
  const raw = await response.json();
  if (!response.ok) throw new Error(`GEMINI_${response.status}:${JSON.stringify(raw).slice(0, 700)}`);
  const text = raw?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
  if (!text) throw new Error("GEMINI_EMPTY");
  return JSON.parse(text);
}

function normalizeSteps(steps: any[], target: number) {
  if (!Array.isArray(steps) || !steps.length) return;
  steps.splice(6);
  while (steps.length < 3) steps.push({ ...steps[steps.length - 1], step: steps.length + 1, minutes: 1 });
  steps.forEach((step: any, index: number) => { step.step = index + 1; step.minutes = Math.max(1, Number(step.minutes) || 1); });
  const weights = steps.map((step: any) => Math.max(1, step.minutes - 1));
  const distributable = Math.max(0, target - steps.length);
  const totalWeight = weights.reduce((sum: number, value: number) => sum + value, 0) || weights.length;
  const allocation = weights.map((weight: number) => 1 + Math.floor(distributable * weight / totalWeight));
  let remaining = target - allocation.reduce((sum: number, value: number) => sum + value, 0);
  let cursor = 0;
  while (remaining > 0) { allocation[cursor % allocation.length]++; remaining--; cursor++; }
  while (remaining < 0 && cursor < 1000) { const index = cursor % allocation.length; if (allocation[index] > 1) { allocation[index]--; remaining++; } cursor++; }
  steps.forEach((step: any, index: number) => { step.minutes = allocation[index]; });
}

function validateGenerated(required: any[], generated: any[]) {
  const errors: string[] = [];
  const expected = new Map(required.map((row) => [rowKey(row), row]));
  const received = new Map<string, any>();
  for (const row of generated || []) { const key = rowKey(row); if (received.has(key)) errors.push(`duplicate_${key}`); received.set(key, row); }
  for (const key of expected.keys()) if (!received.has(key)) errors.push(`missing_${key}`);
  for (const key of received.keys()) if (!expected.has(key)) errors.push(`unexpected_${key}`);
  for (const [key, row] of received) {
    const source: any = expected.get(key); if (!source) continue;
    normalizeSteps(row.procedure, Number(source.minutes));
    if (!Array.isArray(row.procedure) || row.procedure.length < 3 || row.procedure.length > 6) errors.push(`steps_${key}`);
    const total = (row.procedure || []).reduce((sum: number, step: any) => sum + (Number(step.minutes) || 0), 0);
    if (total !== Number(source.minutes)) errors.push(`minutes_${key}_${total}_${source.minutes}`);
  }
  return errors;
}

function deriveSafeExecution(plan: any, required: any) {
  const session = (plan?.sessions || []).find((row: any) => Number(row.session_number) === Number(required.session_number));
  const moment = (session?.work_moments || []).find((row: any) => Number(row.moment) === Number(required.moment));
  const product = (plan?.products || []).find((row: any) => Number(row.grade) === Number(required.grade));
  const autonomousBlock = (moment?.other_blocks || []).find((block: any) => nums(block?.grades).includes(Number(required.grade)));
  const isDirect = required.mode === "DIRECT";
  const actionDetail = String(isDirect ? moment?.direct_student_action || moment?.direct_teacher_action_detail : autonomousBlock?.activity_detail || autonomousBlock?.activity || "");
  const evidenceDetail = String(isDirect ? moment?.direct_evidence_detail : autonomousBlock?.evidence_detail || autonomousBlock?.evidence || product?.final_evidence || "Evidencia del proyecto común");
  const productContribution = String(product?.final_evidence || product?.partial_products?.[0] || `Aporte de ${required.grade}.º al producto común`);
  const sourceSteps = isDirect ? (moment?.direct_procedure || []) : (autonomousBlock?.procedure || []);
  let procedure = sourceSteps.map((step: any, index: number) => ({
    step: index + 1,
    minutes: Number(step.minutes) || 1,
    student_action: String(step.student_action || step.expected_result || actionDetail || "Realiza el paso indicado para aportar al proyecto común."),
    teacher_support_or_preinstruction: String(step.teacher_action || (isDirect ? "El docente modela y acompaña este paso." : autonomousBlock?.instructions_before_rotation || "El docente deja la consigna antes de rotar.")),
    self_check: String(step.self_check || step.check_before_next || "Comprueba que el resultado del paso esté completo."),
    if_stuck: String(step.if_stuck || (isDirect ? "Solicita una explicación breve al docente durante la atención directa." : "Consulta el ejemplo del pizarrón o pide apoyo a un compañero sin interrumpir al docente.")),
    expected_result: String(step.expected_result || "Avance verificable del aporte del grado."),
  }));
  if (!procedure.length) {
    procedure = [
      { step: 1, minutes: 1, student_action: actionDetail || "Realiza la consigna indicada para aportar al proyecto común.", teacher_support_or_preinstruction: isDirect ? "El docente explica, modela un ejemplo y comprueba que la consigna se comprendió." : "Antes de rotar, el docente deja la consigna y un ejemplo visible.", self_check: "Comprueba que identificaste qué debes hacer y qué evidencia debes conservar.", if_stuck: isDirect ? "Pide una aclaración breve durante la atención directa." : "Revisa el ejemplo visible o solicita apoyo a un compañero sin interrumpir al docente.", expected_result: "Inicio verificable de la tarea." },
      { step: 2, minutes: 1, student_action: "Desarrolla la tarea y registra el avance de manera ordenada.", teacher_support_or_preinstruction: isDirect ? "El docente acompaña el desarrollo y hace una verificación breve." : "El docente deja un criterio sencillo de avance antes de atender a otro grupo.", self_check: "Compara tu avance con la consigna y corrige lo que falte.", if_stuck: isDirect ? "Explica al docente en qué paso surgió la dificultad." : "Vuelve al ejemplo, divide la tarea en una parte más pequeña y continúa.", expected_result: "Avance suficiente para construir la evidencia." },
      { step: 3, minutes: 1, student_action: "Revisa, termina y conserva la evidencia para integrarla al producto común.", teacher_support_or_preinstruction: isDirect ? "El docente revisa el cierre y orienta una corrección concreta si hace falta." : "El docente deja indicado dónde conservar la evidencia y cómo verificarla.", self_check: "Confirma que la evidencia esté completa, legible y relacionada con la consigna.", if_stuck: isDirect ? "Solicita una última indicación concreta antes de cerrar." : "Usa la lista de verificación y marca lo completado antes de pedir ayuda.", expected_result: evidenceDetail || productContribution || "Evidencia terminada y lista para el proyecto común." },
    ];
  }
  normalizeSteps(procedure, Number(required.minutes));
  return { ...required,
    activity_title: String(isDirect ? moment?.direct_activity_title : autonomousBlock?.activity_title || `Aporte transversal de ${required.grade}.º`),
    action_detail: actionDetail || "Desarrolla un aporte seguro y verificable al proyecto común.",
    procedure,
    evidence_detail: evidenceDetail,
    product_contribution: productContribution,
    transition: String(isDirect ? moment?.direct_transition : autonomousBlock?.transition || "Guarda la evidencia y prepárate para el siguiente momento."),
  };
}

function attachCoverage(plan: any, rows: any[]) {
  const map = new Map(rows.map((row) => [rowKey(row), row]));
  const transverse = new Set(nums(plan?.transversal_grades));
  for (const session of plan?.sessions || []) {
    for (const moment of session?.work_moments || []) {
      const direct = new Set(nums(moment?.direct_teacher_grades));
      const covered = new Set([...direct, ...(moment?.other_blocks || []).flatMap((block: any) => nums(block?.grades))]);
      const expected = [...transverse].filter((grade) => covered.has(grade)).map((grade) => { const mode = direct.has(grade) ? "DIRECT" : "AUTONOMOUS"; return map.get(rowKey({ session_number: session.session_number, moment: moment.moment, grade, mode })); }).filter(Boolean);
      moment.transversal_execution = expected.sort((a: any, b: any) => Number(a.grade) - Number(b.grade));
      const selectedTasks = (moment.grade_tasks || []).filter((task: any) => !transverse.has(Number(task.grade)));
      const transversalTasks = expected.map((row: any) => ({ grade: Number(row.grade), curriculum_mode: "TRANSVERSAL_PROJECT", pda_ids: [], ltg_refs: [], mode: String(row.mode), action: String(row.action_detail || row.activity_title || ""), evidence: String(row.evidence_detail || ""), assessment: "Seguimiento formativo de la evidencia del proyecto, sin atribución curricular automática.", product_contribution: String(row.product_contribution || ""), source: "V64_BETA63_ISOLATED_COVERAGE" }));
      moment.grade_tasks = [...selectedTasks, ...transversalTasks].sort((a: any, b: any) => Number(a.grade) - Number(b.grade));
      moment.direct_transversal_tasks = transversalTasks.filter((task: any) => task.mode === "DIRECT");
      for (const block of moment?.other_blocks || []) { const blockGrades = new Set(nums(block?.grades)); block.transversal_tasks = transversalTasks.filter((task: any) => task.mode === "AUTONOMOUS" && blockGrades.has(Number(task.grade))); }
    }
  }
}

function coverageErrors(plan: any) {
  const expected = expectedRows(plan).map(rowKey).sort();
  const actualRows = executionRows(plan);
  const actual = actualRows.map(rowKey).sort();
  const errors: string[] = [];
  if (JSON.stringify(expected) !== JSON.stringify(actual)) errors.push("transversal_execution_exact_coverage");
  const transverse = new Set(nums(plan?.transversal_grades));
  for (const session of plan?.sessions || []) for (const moment of session?.work_moments || []) {
    const taskMap = new Map((moment?.grade_tasks || []).map((task: any) => [Number(task.grade), task]));
    for (const row of expectedRows({ transversal_grades: [...transverse], sessions: [session] }).filter((row) => Number(row.moment) === Number(moment.moment))) {
      const task: any = taskMap.get(Number(row.grade));
      if (!task || task.curriculum_mode !== "TRANSVERSAL_PROJECT" || (task.pda_ids || []).length) errors.push(`grade_task_${row.session_number}_${row.moment}_${row.grade}`);
    }
  }
  return errors;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json({ code: "AUTH_REQUIRED" }, 401);
    const authUser = await db.auth.getUser(token);
    if (authUser.error || !authUser.data.user?.id) return json({ code: "AUTHENTICATED_USER_REQUIRED" }, 401);
    const raw = await req.text();
    let body: any; try { body = JSON.parse(raw || "{}"); } catch { return json({ code: "INVALID_JSON" }, 400); }
    const upstream = await fetch(BASE, { method: "POST", headers: { "content-type": "application/json", Authorization: auth }, body: raw || "{}", signal: AbortSignal.timeout(560000) });
    const text = await upstream.text();
    let plan: any; try { plan = JSON.parse(text); } catch { return new Response(text, { status: upstream.status, headers: { ...CORS, "content-type": "text/plain" } }); }
    if (!upstream.ok) return json(plan, upstream.status, { "x-multiplan-plan-engine": plan?.engineVersion || "V6.4-MULTIGRADE-DIDACTIC-BETA.6.1-TRANSVERSAL-V13" });
    const expected = expectedRows(plan);
    const existing = executionRows(plan);
    const existingKeys = new Set(existing.map(rowKey));
    const missing = expected.filter((row) => !existingKeys.has(rowKey(row)));
    let generated: any[] = [];
    if (missing.length && terms(plan).length === 0) {
      generated = missing.map((row) => deriveSafeExecution(plan, row));
      const errors = validateGenerated(missing, generated);
      if (errors.length) return json({ code: "V64_TRANSVERSAL_DERIVATION_FAILED", errors }, 422, { "x-multiplan-plan-engine": ENGINE });
    } else if (missing.length) {
      const response = await callGemini({ problem: String(body.situacion_problema || ""), context: String(body.contexto || ""), students_by_grade: body.alumnos_por_grado || {}, reading: String(body.lectura || ""), writing: String(body.escritura || ""), autonomy: String(body.autonomia || ""), resources: String(body.recursos || ""), supports: String(body.apoyos || ""), forbidden_concepts: terms(plan), required_tasks: missing, instruction: "Crea tareas transversales aisladas, adaptadas al grado y al proyecto común, sin importar currículo de otros grados." });
      generated = response?.executions || [];
      const errors = validateGenerated(missing, generated);
      if (errors.length) return json({ code: "V64_TRANSVERSAL_COVERAGE_GENERATION_FAILED", errors }, 422, { "x-multiplan-plan-engine": ENGINE });
    }
    attachCoverage(plan, [...existing, ...generated]);
    const forbidden = terms(plan);
    let hits = conceptHits(plan, forbidden);
    const conceptRepairRequired = hits.length > 0;
    if (hits.length) {
      const contaminatedKeys = new Set(hits.map(rowKey));
      const repairTasks = expected.filter((row) => contaminatedKeys.has(rowKey(row)));
      const repaired = await callGemini({ problem: String(body.situacion_problema || ""), context: String(body.contexto || ""), students_by_grade: body.alumnos_por_grado || {}, reading: String(body.lectura || ""), writing: String(body.escritura || ""), autonomy: String(body.autonomia || ""), resources: String(body.recursos || ""), supports: String(body.apoyos || ""), forbidden_concepts: forbidden, required_tasks: repairTasks, mandatory_correction: "Elimina toda referencia a forbidden_concepts sin cambiar claves, modo, minutos ni el problema común." });
      const replacements = repaired?.executions || [];
      const errors = validateGenerated(repairTasks, replacements);
      if (errors.length) return json({ code: "V64_TRANSVERSAL_REPAIR_FAILED", errors }, 422, { "x-multiplan-plan-engine": ENGINE });
      const replacementMap = new Map(replacements.map((row: any) => [rowKey(row), row]));
      attachCoverage(plan, executionRows(plan).map((row) => replacementMap.get(rowKey(row)) || row));
      hits = conceptHits(plan, forbidden);
    }
    const coverage = coverageErrors(plan);
    if (coverage.length || hits.length) return json({ code: "V64_TRANSVERSAL_GUARD_FAILED", coverage_errors: coverage, concept_hits: hits.map((row) => ({ session_number: row.session_number, moment: row.moment, grade: row.grade, terms: row.hit_terms })) }, 422, { "x-multiplan-plan-engine": ENGINE });
    plan.v64_base_engine_version = plan.engineVersion;
    plan.engineVersion = ENGINE;
    plan.transversal_isolation_applied = nums(plan?.transversal_grades).length > 0;
    plan.transversal_execution_coverage_guard = { status: "PASS", expected_tasks: expected.length, generated_missing_tasks: missing.length, exact_coverage: true, pda_ids_empty: true };
    plan.transversal_execution_concept_guard = { status: "PASS", forbidden_terms_count: forbidden.length, repaired: conceptRepairRequired, remaining_hits: [] };
    return json(plan, 200, { "x-multiplan-plan-engine": ENGINE, "x-multiplan-transversal-lock": "coverage-and-concept-guard-pass", "x-multiplan-detailed-concept-guard": "pass" });
  } catch (error) {
    return json({ code: "V64_COVERAGE_CONCEPT_GUARD_ERROR", message: String(error) }, 500, { "x-multiplan-plan-engine": ENGINE });
  }
});