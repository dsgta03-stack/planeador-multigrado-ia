import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { SNAPSHOT_VERSION, applyFinalSnapshot } from "../lib/v0124/history-fidelity.mjs";
import { REVIEW_VERSION, reviewWithCache } from "../lib/v0124/review-cache.mjs";
import { createMultiplanDocx, docxFilename } from "../lib/v0124/docx-export.mjs";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonicalize(value[key]);
      return out;
    }, {});
  }
  return value;
}
function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
function exportSource(plan) {
  return {
    grades: plan.grades,
    context: plan.context,
    problem: plan.problem,
    selected_pdas: plan.selected_pdas,
    methodology: plan.methodology_engine?.methodology_primary,
    project: plan.project,
    project_sequence: plan.project_sequence,
    sessions: plan.teacher_presentation?.sessions,
    resources: plan.resources,
  };
}
function helpers() {
  return {
    bearer: req => req.headers.authorization || "",
    readBody: req => new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", c => raw += c);
      req.on("end", () => resolve(raw));
      req.on("error", reject);
    }),
    json: (res, status, body, extra = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...extra });
      res.end(JSON.stringify(body));
    },
    copyHeaders: (response, names = []) => {
      const out = { "content-type": response.headers.get("content-type") || "application/json" };
      for (const name of names) {
        const value = response.headers.get(name);
        if (value) out[name] = value;
      }
      return out;
    },
  };
}
function request(body, auth = "Bearer test") {
  const req = Readable.from([JSON.stringify(body)]);
  req.headers = { authorization: auth };
  return req;
}
function responseCapture() {
  let status = 0, headers = {}, body = "";
  return {
    res: {
      writeHead: (s, h) => { status = s; headers = h; },
      end: x => { body = String(x || ""); },
    },
    get: () => ({ status, headers, body }),
  };
}

const runId = "44444444-4444-4444-8444-444444444444";
const finalPlan = {
  run_id: runId,
  base_run_id: "55555555-5555-4555-8555-555555555555",
  grades: [1, 2, 3, 4, 5, 6],
  context: "Escuela primaria multigrado con un docente y recursos básicos.",
  problem: "La comunidad escolar reconoce poco el origen y significado de sus símbolos culturales.",
  selected_pdas: [
    { grade: 1, pda_id: "F3-ENS-1-026", pda_official: "Reconoce símbolos presentes en su comunidad y comunica lo que indaga sobre ellos." },
    { grade: 3, pda_id: "F4-ENS-3-030", pda_official: "Indaga el significado histórico y social de símbolos de identidad." },
    { grade: 6, pda_id: "F5-LEN-6-069", pda_official: "Integra información de diversas fuentes para comunicar hallazgos a una audiencia." },
  ],
  methodology_engine: {
    methodology_primary: { id: "proyectos_comunitarios", label: "Aprendizaje Basado en Proyectos Comunitarios" },
    integrated_project: {
      title: "Guardianes de nuestra identidad",
      display_title: "Guardianes de nuestra identidad",
      collective_product_or_service: "Exposición comunitaria de identidad cultural",
      unifying_mission: "Investigar, explicar y compartir el significado de símbolos de identidad de la comunidad.",
      grade_contributions: [1, 2, 3, 4, 5, 6].map(grade => ({ grade, contribution: `Aporte de ${grade}.º`, evidence: `Evidencia ${grade}.º` })),
    },
  },
  project: {
    title: "Guardianes de nuestra identidad",
    final_product: "Exposición comunitaria de identidad cultural",
    mission: "Investigar, explicar y compartir el significado de símbolos de identidad de la comunidad.",
    grade_contributions: [1, 2, 3, 4, 5, 6].map(grade => ({ grade, contribution: `Aporte de ${grade}.º`, evidence: `Evidencia ${grade}.º` })),
  },
  project_sequence: [
    { session_number: 1, phase: "Planeación", purpose: "Delimitar la pregunta del proyecto.", project_advance: "Preguntas y fuentes definidas.", partial_product: "Mapa inicial de símbolos y preguntas.", prepares_next: "Organizar la indagación." },
    { session_number: 2, phase: "Acción", purpose: "Indagar y registrar información.", project_advance: "Hallazgos organizados por grado.", partial_product: "Fichas de indagación.", prepares_next: "Integrar la exposición." },
    { session_number: 3, phase: "Intervención", purpose: "Integrar y socializar el producto común.", project_advance: "Exposición comunitaria terminada.", partial_product: "Montaje y guion final.", prepares_next: "Cierre y reflexión." },
  ],
  sessions: [
    { session_number: 1, total_minutes: 90, purpose: "Delimitar la pregunta del proyecto.", project_stage: "Planeación" },
    { session_number: 2, total_minutes: 90, purpose: "Indagar y registrar información.", project_stage: "Acción" },
    { session_number: 3, total_minutes: 90, purpose: "Integrar y socializar el producto común.", project_stage: "Intervención" },
  ],
  teacher_presentation: {
    project_title: "Guardianes de nuestra identidad",
    project_final_product: "Exposición comunitaria de identidad cultural",
    sessions: [
      { session_number: 1, total_minutes: 90, phase: "Planeación", purpose: "Delimitar la pregunta del proyecto.", project_advance: "Preguntas y fuentes definidas.", partial_product: "Mapa inicial de símbolos y preguntas.", prepares_next: "Organizar la indagación.", teacher_narrative: "Recuperaré saberes previos y plantearemos preguntas comunes.", activity_blocks: [{ label: "Trabajo multigrado", grades: [1,2,3,4,5,6], narrative: "Cada grado formula preguntas acordes con sus PDA." }], closure_narrative: "Cerraremos acordando qué información buscará cada grado." },
      { session_number: 2, total_minutes: 90, phase: "Acción", purpose: "Indagar y registrar información.", project_advance: "Hallazgos organizados por grado.", partial_product: "Fichas de indagación.", prepares_next: "Integrar la exposición.", teacher_narrative: "Acompañaré la consulta, registro y contraste de información.", activity_blocks: [{ label: "Trabajo diferenciado", grades: [1,2,3,4,5,6], narrative: "Cada grado registra evidencias y hallazgos que aportan al producto común." }], closure_narrative: "Compartiremos hallazgos y seleccionaremos evidencias." },
      { session_number: 3, total_minutes: 90, phase: "Intervención", purpose: "Integrar y socializar el producto común.", project_advance: "Exposición comunitaria terminada.", partial_product: "Montaje y guion final.", prepares_next: "Cierre y reflexión.", teacher_narrative: "Coordinaré el montaje de la exposición común.", activity_blocks: [{ label: "Integración", grades: [1,2,3,4,5,6], narrative: "Los aportes de cada grado se integran en una sola exposición." }], closure_narrative: "Valoraremos el producto común y lo aprendido." },
    ],
  },
  products: [
    { grade: 1, name: "Tarjetas ilustradas" },
    { grade: 3, name: "Fichas explicativas" },
    { grade: 6, name: "Guion de exposición" },
  ],
  resources: ["Pizarrón", "Cuadernos", "Libros", "Entorno"],
};

const staleInternal = {
  run_id: runId,
  grades: [6],
  methodology_engine: { methodology_primary: { id: "steam", label: "STEAM" } },
  teacher_presentation: { project_title: "Versión interna anterior", sessions: [{ session_number: 1, total_minutes: 30 }] },
};
const finalHash = hash(finalPlan);
const historicalRow = {
  run_id: runId,
  model_output_json: structuredClone(staleInternal),
  validator_json: {
    final_output_snapshot: structuredClone(finalPlan),
    final_output_snapshot_meta: { schema_version: SNAPSHOT_VERSION, hash_sha256: finalHash },
  },
};

const reopened = applyFinalSnapshot(historicalRow);
assert.equal(reopened.snapshot_source, "FINAL_OUTPUT_SNAPSHOT");
assert.deepEqual(reopened.model_output_json, finalPlan);
assert.equal(hash(reopened.model_output_json), finalHash, "Generada y reabierta deben tener el mismo hash canónico");
assert.deepEqual(historicalRow.model_output_json, staleInternal, "El model_output_json histórico no debe sobrescribirse");
assert.equal(reopened.model_output_json.methodology_engine.methodology_primary.id, "proyectos_comunitarios");
assert.equal(reopened.model_output_json.teacher_presentation.sessions.length, 3);
assert.deepEqual(reopened.model_output_json.teacher_presentation.sessions.map(s => s.total_minutes), [90, 90, 90]);
assert.deepEqual(reopened.model_output_json.selected_pdas.map(x => x.pda_id), ["F3-ENS-1-026", "F4-ENS-3-030", "F5-LEN-6-069"]);
assert.equal(reopened.model_output_json.project.final_product, "Exposición comunitaria de identidad cultural");

const reviewResult = {
  status: "NEEDS_ADJUSTMENT",
  score: 86,
  critical_count: 0,
  warning_count: 2,
  findings: [{ rule_id: "MET-02" }, { rule_id: "TIME-04" }],
};
let cachedResult = null;
let reviewExecutions = 0;
globalThis.fetch = async (url, options = {}) => {
  const u = String(url);
  if (u.includes("pedagogical-review-cache-v1")) {
    const payload = JSON.parse(options.body || "{}");
    const planHash = hash(payload.plan);
    if (planHash !== finalHash) {
      return new Response(JSON.stringify({ code: "SNAPSHOT_HASH_MISMATCH", plan_hash: planHash, snapshot_hash: finalHash }), { status: 409, headers: { "content-type": "application/json" } });
    }
    if (payload.action === "get") {
      return new Response(JSON.stringify(cachedResult ? { hit: true, result: cachedResult, review_version: REVIEW_VERSION, snapshot_hash: finalHash } : { hit: false }), { status: 200, headers: { "content-type": "application/json" } });
    }
    cachedResult = payload.result;
    return new Response(JSON.stringify({ ok: true, review_version: REVIEW_VERSION, snapshot_hash: finalHash }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("plan-review-pedagogical-context-v1")) {
    reviewExecutions += 1;
    return new Response(JSON.stringify(reviewResult), { status: 200, headers: { "content-type": "application/json", "x-multiplan-review-postcheck": "V1.1" } });
  }
  throw new Error(`Unexpected URL ${u}`);
};

let cap = responseCapture();
await reviewWithCache(request({ plan: finalPlan }), cap.res, helpers());
let reviewFresh = cap.get();
assert.equal(reviewFresh.status, 200);
assert.deepEqual(JSON.parse(reviewFresh.body), reviewResult);
assert.equal(reviewFresh.headers["x-multiplan-review-cache"], "MISS_STORED");

cap = responseCapture();
await reviewWithCache(request({ plan: reopened.model_output_json }), cap.res, helpers());
const reviewHistory = cap.get();
assert.equal(reviewHistory.status, 200);
assert.deepEqual(JSON.parse(reviewHistory.body), reviewResult, "La revisión del histórico debe coincidir exactamente");
assert.equal(reviewHistory.headers["x-multiplan-review-cache"], "HIT");
assert.equal(reviewExecutions, 1, "Reabrir el mismo snapshot no debe ejecutar otra revisión semántica");

const altered = structuredClone(reopened.model_output_json);
altered.teacher_presentation.sessions[1].purpose = "Cambio no guardado";
cap = responseCapture();
await reviewWithCache(request({ plan: altered }), cap.res, helpers());
assert.equal(cap.get().status, 409);
assert.equal(JSON.parse(cap.get().body).code, "HISTORY_SNAPSHOT_MISMATCH");

assert.equal(hash(exportSource(finalPlan)), hash(exportSource(reopened.model_output_json)), "El exportador debe recibir la misma fuente semántica en plan nuevo e histórico");
assert.equal(docxFilename(finalPlan), docxFilename(reopened.model_output_json));
const freshDocx = await createMultiplanDocx(finalPlan);
const historyDocx = await createMultiplanDocx(reopened.model_output_json);
for (const buffer of [freshDocx, historyDocx]) {
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 5000);
  assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
}

console.log(JSON.stringify({
  ok: true,
  tests: 18,
  snapshotVersion: SNAPSHOT_VERSION,
  reviewVersion: REVIEW_VERSION,
  canonicalHash: finalHash,
  reviewExecutions,
  docxFreshBytes: freshDocx.length,
  docxHistoryBytes: historyDocx.length,
}));
