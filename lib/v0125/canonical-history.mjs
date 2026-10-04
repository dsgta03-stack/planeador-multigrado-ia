import { SNAPSHOT_VERSION, applyFinalSnapshot, enrichHistoryList, persistSnapshot } from '../v0124/history-fidelity.mjs';
import { canonicalPlanHash } from './blueprint-canonical-adapter.mjs';
import { assertCanonicalPlanBinding } from './canonical-plan-services.mjs';

export const CANONICAL_HISTORY_VERSION = 'CANONICAL_HISTORY_V1';

const bearerToken = value => typeof value === 'string' && /^Bearer \S+$/.test(value);

export async function persistCanonicalSnapshot({
  authorization,
  plan,
  canonical_plan_hash,
  persistImpl = persistSnapshot,
} = {}) {
  if (!bearerToken(authorization)) {
    return {
      status: 'SKIPPED',
      reason: 'AUTH_REQUIRED',
      canonical_plan_hash: null,
      snapshot_version: SNAPSHOT_VERSION,
    };
  }

  let hash;
  try {
    hash = assertCanonicalPlanBinding({ plan, canonical_plan_hash });
  } catch (error) {
    return {
      status: 'REJECTED',
      reason: String(error?.message || error),
      canonical_plan_hash: null,
      snapshot_version: SNAPSHOT_VERSION,
    };
  }

  if (!String(plan?.run_id || '').trim()) {
    return {
      status: 'SKIPPED',
      reason: 'NO_RUN_ID',
      canonical_plan_hash: hash,
      snapshot_version: SNAPSHOT_VERSION,
    };
  }

  try {
    const persisted = await persistImpl(authorization, plan);
    return {
      ...persisted,
      canonical_plan_hash: hash,
      snapshot_version: persisted?.version || SNAPSHOT_VERSION,
    };
  } catch (error) {
    return {
      status: 'FAILED',
      reason: 'SNAPSHOT_PERSIST_EXCEPTION',
      message: String(error?.message || error).slice(0, 300),
      canonical_plan_hash: hash,
      snapshot_version: SNAPSHOT_VERSION,
    };
  }
}

export function canonicalizeHistoryDetail(row) {
  const detail = applyFinalSnapshot(row);
  if (!detail || typeof detail !== 'object') return detail;

  if (detail.snapshot_source !== 'FINAL_OUTPUT_SNAPSHOT' || !detail.model_output_json || typeof detail.model_output_json !== 'object') {
    return {
      ...detail,
      canonical_history_status: 'LEGACY_UNBOUND',
      canonical_plan_hash: null,
    };
  }

  const hash = canonicalPlanHash(detail.model_output_json);
  const metaHash = String(detail.snapshot_meta?.canonical_plan_hash || '').trim();
  if (metaHash && metaHash !== hash) throw Error('HISTORY_SNAPSHOT_MISMATCH');

  return {
    ...detail,
    canonical_history_status: 'CANONICAL_SNAPSHOT',
    canonical_plan_hash: hash,
  };
}

export async function enrichCanonicalHistoryList(items, authorization, { enrichImpl = enrichHistoryList } = {}) {
  const enriched = await enrichImpl(items, authorization);
  return enriched.map(item => ({
    ...item,
    canonical_history_status: item?.snapshot_source === 'FINAL_OUTPUT_SNAPSHOT' ? 'SNAPSHOT_AVAILABLE' : 'LEGACY_UNBOUND',
  }));
}
