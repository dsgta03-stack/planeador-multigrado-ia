const SUPABASE_URL = "https://dvcrwzxznuqongutnifn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_a2rcBHsCpg2Nr1KE1I_o1A_j2lXRDoA";
const SNAPSHOT_URL = `${SUPABASE_URL}/functions/v1/persist-final-plan-snapshot-v1`;
export const SNAPSHOT_VERSION = "FINAL-PLAN-SNAPSHOT-V1";

export function finalSnapshotFromValidator(validator) {
  const snapshot = validator && typeof validator === "object" ? validator.final_output_snapshot : null;
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : null;
}
function finalMetaFromValidator(validator) {
  return validator && typeof validator === "object" && validator.final_output_snapshot_meta && typeof validator.final_output_snapshot_meta === "object"
    ? validator.final_output_snapshot_meta : null;
}
export async function persistSnapshot(authorization, plan) {
  const runId = String(plan?.run_id || "").trim();
  if (!authorization || !runId) return { status: "SKIPPED", reason: !authorization ? "NO_AUTH" : "NO_RUN_ID" };
  try {
    const response = await fetch(SNAPSHOT_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization },
      body: JSON.stringify({ run_id: runId, snapshot: plan }),
      signal: AbortSignal.timeout(8_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error(JSON.stringify({ event: "final_snapshot_persist_failed", run_id: runId, status: response.status, code: data?.code || null }));
      return { status: "FAILED", code: data?.code || `HTTP_${response.status}` };
    }
    return { status: "PERSISTED", hash: data?.hash_sha256 || "", version: data?.snapshot_version || SNAPSHOT_VERSION };
  } catch (error) {
    console.error(JSON.stringify({ event: "final_snapshot_persist_exception", run_id: runId, message: String(error).slice(0, 300) }));
    return { status: "FAILED", code: "SNAPSHOT_PERSIST_EXCEPTION" };
  }
}
export function applyFinalSnapshot(row) {
  if (!row || typeof row !== "object") return row;
  const snapshot = finalSnapshotFromValidator(row.validator_json);
  const meta = finalMetaFromValidator(row.validator_json);
  if (!snapshot) return { ...row, snapshot_source: "MODEL_OUTPUT_JSON", snapshot_meta: null };
  return { ...row, model_output_json: snapshot, snapshot_source: "FINAL_OUTPUT_SNAPSHOT", snapshot_meta: meta || { schema_version: SNAPSHOT_VERSION } };
}
async function fetchSnapshotRows(authorization, runIds) {
  if (!authorization || !runIds.length) return [];
  const ids = [...new Set(runIds.filter(id => /^[0-9a-f-]{36}$/i.test(id)))];
  if (!ids.length) return [];
  const url = `${SUPABASE_URL}/rest/v1/plan_runs?select=run_id,validator_json&run_id=in.(${ids.join(",")})`;
  try {
    const response = await fetch(url, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization, accept: "application/json", "accept-profile": "public" },
      signal: AbortSignal.timeout(12_000),
    });
    const data = await response.json().catch(() => []);
    if (!response.ok) return [];
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function snapshotGrades(snapshot, fallback) {
  const products = Array.isArray(snapshot?.products) ? snapshot.products.map(x => Number(x?.grade)).filter(Number.isInteger) : [];
  const contributions = Array.isArray(snapshot?.methodology_engine?.integrated_project?.grade_contributions)
    ? snapshot.methodology_engine.integrated_project.grade_contributions.map(x => Number(x?.grade)).filter(Number.isInteger) : [];
  const values = [...new Set([...products, ...contributions])].sort((a, b) => a - b);
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
export async function enrichHistoryList(items, authorization) {
  if (!Array.isArray(items) || !items.length) return Array.isArray(items) ? items : [];
  const rows = await fetchSnapshotRows(authorization, items.map(x => String(x?.run_id || "")));
  const map = new Map(rows.map(row => [String(row?.run_id || ""), row]));
  return items.map(item => {
    const row = map.get(String(item?.run_id || ""));
    return enrichHistoryItem(item, finalSnapshotFromValidator(row?.validator_json), finalMetaFromValidator(row?.validator_json));
  });
}
