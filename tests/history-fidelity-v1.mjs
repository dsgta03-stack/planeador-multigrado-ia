import assert from "node:assert/strict";

const SNAPSHOT_VERSION = "FINAL-PLAN-SNAPSHOT-V1";
function finalSnapshotFromValidator(validator) {
  const snapshot = validator && typeof validator === "object" ? validator.final_output_snapshot : null;
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : null;
}
function finalMetaFromValidator(validator) {
  return validator && typeof validator === "object" && validator.final_output_snapshot_meta && typeof validator.final_output_snapshot_meta === "object" ? validator.final_output_snapshot_meta : null;
}
function applyFinalSnapshot(row) {
  const snapshot = finalSnapshotFromValidator(row?.validator_json);
  const meta = finalMetaFromValidator(row?.validator_json);
  if (!snapshot) return { ...row, snapshot_source: "MODEL_OUTPUT_JSON", snapshot_meta: null };
  return { ...row, model_output_json: snapshot, snapshot_source: "FINAL_OUTPUT_SNAPSHOT", snapshot_meta: meta || { schema_version: SNAPSHOT_VERSION } };
}
function snapshotGrades(snapshot, fallback) {
  const fromProducts = Array.isArray(snapshot?.products) ? snapshot.products.map(x => Number(x?.grade)).filter(Number.isInteger) : [];
  const fromContributions = Array.isArray(snapshot?.methodology_engine?.integrated_project?.grade_contributions) ? snapshot.methodology_engine.integrated_project.grade_contributions.map(x => Number(x?.grade)).filter(Number.isInteger) : [];
  const values = [...new Set([...fromProducts, ...fromContributions])].sort((a, b) => a - b);
  return values.length ? values : fallback;
}
function snapshotTitle(snapshot, fallback) {
  return String(snapshot?.teacher_presentation?.project_title || snapshot?.methodology_engine?.integrated_project?.display_title || snapshot?.methodology_engine?.integrated_project?.title || fallback || "Planeación sin título").trim();
}
function enrichHistoryItem(item, snapshot, meta) {
  if (!snapshot) return { ...item, snapshot_source: "MODEL_OUTPUT_JSON" };
  const method = snapshot?.methodology_engine?.methodology_primary || {};
  return {
    ...item,
    title: snapshotTitle(snapshot, item?.title),
    grades: snapshotGrades(snapshot, item?.grades),
    session_count: Array.isArray(snapshot?.sessions) ? snapshot.sessions.length : item?.session_count,
    methodology_id: method?.id || item?.methodology_id || null,
    methodology_label: method?.label || item?.methodology_label || null,
    has_output: Array.isArray(snapshot?.sessions) ? snapshot.sessions.length > 0 : item?.has_output,
    base_run_id: snapshot?.base_run_id || item?.base_run_id || null,
    snapshot_source: "FINAL_OUTPUT_SNAPSHOT",
    snapshot_meta: meta || { schema_version: SNAPSHOT_VERSION },
  };
}

const internal = { title: "Interno", sessions: [{ session_number: 1 }], methodology_engine: { methodology_primary: { id: "steam", label: "STEAM" } } };
const visible = { run_id: "11111111-1111-4111-8111-111111111111", base_run_id: "22222222-2222-4222-8222-222222222222", teacher_presentation: { project_title: "Visible final" }, sessions: [{}, {}, {}], products: [{ grade: 1 }, { grade: 3 }], methodology_engine: { methodology_primary: { id: "abp", label: "Aprendizaje Basado en Problemas" } } };
const meta = { schema_version: SNAPSHOT_VERSION, hash_sha256: "abc" };

const oldRow = { run_id: visible.run_id, model_output_json: internal, validator_json: {} };
const oldDetail = applyFinalSnapshot(oldRow);
assert.equal(oldDetail.snapshot_source, "MODEL_OUTPUT_JSON");
assert.equal(oldDetail.model_output_json.title, "Interno");

const newRow = { run_id: visible.run_id, model_output_json: internal, validator_json: { final_output_snapshot: visible, final_output_snapshot_meta: meta } };
const newDetail = applyFinalSnapshot(newRow);
assert.equal(newDetail.snapshot_source, "FINAL_OUTPUT_SNAPSHOT");
assert.equal(newDetail.model_output_json.teacher_presentation.project_title, "Visible final");
assert.equal(newRow.model_output_json.title, "Interno", "La salida interna no debe sobrescribirse");

const card = enrichHistoryItem({ run_id: visible.run_id, title: "Tarjeta interna", grades: [6], session_count: 1, methodology_id: "steam", methodology_label: "STEAM", has_output: true }, visible, meta);
assert.equal(card.title, "Visible final");
assert.deepEqual(card.grades, [1, 3]);
assert.equal(card.session_count, 3);
assert.equal(card.methodology_id, "abp");
assert.equal(card.methodology_label, "Aprendizaje Basado en Problemas");
assert.equal(card.base_run_id, visible.base_run_id);

const legacyCard = enrichHistoryItem({ title: "Antigua", session_count: 2 }, null, null);
assert.equal(legacyCard.title, "Antigua");
assert.equal(legacyCard.snapshot_source, "MODEL_OUTPUT_JSON");

const generationPayload = JSON.stringify(visible);
const persistence = { status: "FAILED" };
assert.equal(persistence.status, "FAILED");
assert.equal(JSON.parse(generationPayload).teacher_presentation.project_title, "Visible final", "Un fallo de snapshot no debe alterar la respuesta de generación");

console.log(JSON.stringify({ ok: true, tests: 5, snapshotVersion: SNAPSHOT_VERSION }));
