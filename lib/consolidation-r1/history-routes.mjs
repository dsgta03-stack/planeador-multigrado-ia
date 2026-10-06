import { canonicalizeHistoryDetail, enrichCanonicalHistoryList } from "../v0125/canonical-history.mjs";
import { finalSnapshotFromValidator } from "../v0124/history-fidelity.mjs";

const SUPABASE_URL = "https://dvcrwzxznuqongutnifn.supabase.co";

const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||""));

export function createCanonicalHistoryHandlers({ env=process.env, fetchImpl=fetch, bearer, json } = {}) {
  if (typeof fetchImpl !== "function" || typeof bearer !== "function" || typeof json !== "function") {
    throw Error("CONSOLIDATED_HISTORY_HELPERS_REQUIRED");
  }
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || "").trim();

  async function rest(path, authorization) {
    if (!publishableKey) throw Error("SUPABASE_PUBLISHABLE_KEY_REQUIRED");
    return fetchImpl(SUPABASE_URL + "/rest/v1/" + path, {
      headers: {
        apikey: publishableKey,
        authorization,
        accept: "application/json",
        "accept-profile": "public",
      },
      signal: AbortSignal.timeout(20_000),
    });
  }

  async function enrichList(items, authorization) {
    if (!Array.isArray(items) || !items.length) return Array.isArray(items) ? items : [];
    const ids = [...new Set(items.map(item => String(item?.run_id || "")).filter(uuid))];
    if (!ids.length) return items.map(item => ({ ...item, snapshot_source: "MODEL_OUTPUT_JSON" }));

    const response = await rest(`plan_runs?select=run_id,validator_json&run_id=in.(${ids.join(",")})`, authorization);
    const rows = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(rows)) return items.map(item => ({ ...item, snapshot_source: "MODEL_OUTPUT_JSON" }));
    const byId = new Map(rows.map(row => [String(row?.run_id || ""), row]));

    return items.map(item => {
      const snapshot = finalSnapshotFromValidator(byId.get(String(item?.run_id || ""))?.validator_json);
      if (!snapshot) return { ...item, snapshot_source: "MODEL_OUTPUT_JSON" };
      const methodology = snapshot?.methodology_engine?.methodology_primary || {};
      const grades = Array.isArray(snapshot?.grades) && snapshot.grades.length ? snapshot.grades : item?.grades;
      const title = String(
        snapshot?.project?.title ||
        snapshot?.teacher_presentation?.project_title ||
        item?.title ||
        "Planeación sin título"
      ).trim();
      return {
        ...item,
        title,
        grades,
        session_count: Array.isArray(snapshot?.sessions) ? snapshot.sessions.length : item?.session_count,
        methodology_id: methodology?.id || item?.methodology_id || null,
        methodology_label: methodology?.label || item?.methodology_label || null,
        has_output: Array.isArray(snapshot?.sessions) ? snapshot.sessions.length > 0 : item?.has_output,
        base_run_id: snapshot?.base_run_id || item?.base_run_id || null,
        snapshot_source: "FINAL_OUTPUT_SNAPSHOT",
      };
    });
  }

  async function list(req, res) {
    const authorization = bearer(req);
    if (!authorization) return json(res, 401, { code: "AUTH_REQUIRED" });
    try {
      const select = [
        "run_id","created_at","updated_at","status","engine_version","title",
        "grades","session_count","minutes_per_session","methodology_id",
        "methodology_label","has_output","base_run_id",
      ].join(",");
      const response = await rest(`plan_history?select=${select}&order=created_at.desc&limit=100`, authorization);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const status = response.status === 401 || response.status === 403 ? response.status : 502;
        return json(res, status, { code: status < 500 ? "AUTH_REQUIRED" : "HISTORY_READ_FAILED" });
      }
      const items = await enrichCanonicalHistoryList(
        Array.isArray(data) ? data : [],
        authorization,
        { enrichImpl: enrichList },
      );
      return json(res, 200, { items }, { "x-multiplan-history": "CANONICAL_SINGLE_APP_R1" });
    } catch {
      return json(res, 502, { code: "HISTORY_READ_FAILED" });
    }
  }

  async function detail(req, res, runId) {
    const authorization = bearer(req);
    if (!authorization) return json(res, 401, { code: "AUTH_REQUIRED" });
    if (!uuid(runId)) return json(res, 400, { code: "INVALID_RUN_ID" });
    try {
      const select = "run_id,created_at,updated_at,status,engine_version,input_json,model_output_json,validator_json,error_message";
      const response = await rest(`plan_runs?select=${select}&run_id=eq.${encodeURIComponent(runId)}&limit=1`, authorization);
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const status = response.status === 401 || response.status === 403 ? response.status : 502;
        return json(res, status, { code: status < 500 ? "AUTH_REQUIRED" : "HISTORY_DETAIL_FAILED" });
      }
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) return json(res, 404, { code: "PLAN_NOT_FOUND" });
      try {
        return json(res, 200, canonicalizeHistoryDetail(row), { "x-multiplan-history": "CANONICAL_SINGLE_APP_R1" });
      } catch (error) {
        if (String(error?.message || error) === "HISTORY_SNAPSHOT_MISMATCH") {
          return json(res, 409, { code: "HISTORY_SNAPSHOT_MISMATCH" });
        }
        throw error;
      }
    } catch {
      return json(res, 502, { code: "HISTORY_DETAIL_FAILED" });
    }
  }

  return Object.freeze({ list, detail });
}
