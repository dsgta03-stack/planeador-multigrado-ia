import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Pure shadow boundary: no network, provider call, lease acquisition or SQL write.
export const RECOVERY_SHADOW_DECISION_VERSION = 'STAGE7_RECOVERY_SHADOW_DECISION_V1';
const SHA256 = /^[a-f0-9]{64}$/;
const REVIEW_FAMILIES = ['WORKED', 'METHODOLOGY', 'FUNCTIONAL'];
const RETRYABLE_PROVIDER_STATUSES = new Set(['429', '500', '502', '503', '504']);
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const validText = x => typeof x === 'string' && x.length > 0;
const decision = (status, next_action, info = {}) => Object.freeze({
  decision_version: RECOVERY_SHADOW_DECISION_VERSION,
  status,
  next_action,
  provider_call_allowed: false,
  ...info,
});
const blocked = reason => decision('BLOCKED', reason);
const sha = text => createHash('sha256').update(text, 'utf8').digest('hex');

function matchesBindings(actual, expected) {
  return isObject(actual) && isObject(expected) && isDeepStrictEqual(actual, expected);
}

function validSnapshot(snapshot, bindings) {
  if (!isObject(snapshot)) return false;
  if (!['blueprintEnvelope','blueprintApproval','graph','proposal','semantic',
    'semanticProvider','projectComposition'].every(k => isObject(snapshot[k]))) return false;
  return snapshot.blueprint_hash === bindings.blueprint_hash &&
    snapshot.graph_hash === bindings.graph_hash &&
    snapshot.graph.graph_id === bindings.graph_id &&
    String(snapshot.graph.revision) === String(bindings.graph_revision) &&
    snapshot.projectComposition.composition_id === bindings.composition_id;
}

/**
 * Decide from authenticated, server-provided recovery state and authoritative
 * operation registration. Never authorize a provider request in this function.
 *
 * expected: {owner_id, run_id, sources, bindings, versions};
 * state: the read_state JSON plus revision and checkpoint content;
 * registeredOperations: durable operations belonging to this attempt only.
 */
export function assessStage7Recovery({ state, expected, registeredOperations = [] } = {}) {
  if (!isObject(expected) || !validText(expected.owner_id) ||
      !validText(expected.run_id) || !isObject(expected.sources) ||
      !isObject(expected.bindings) || !isObject(expected.versions) ||
      !isObject(state) || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
      !Array.isArray(registeredOperations)) return blocked('INVALID_AUTHENTICATED_CONTEXT');

  if (Object.keys(expected.sources).sort().join(',') !== 'constraints,curriculum,methodology' ||
      !['constraints','curriculum','methodology'].every(k => isObject(expected.sources[k]))) {
    return blocked('REQUIRED_SOURCE_ARTIFACTS_MISSING');
  }
  if (!matchesBindings(state.bindings, expected.bindings) ||
      !matchesBindings(state.versions, expected.versions)) return blocked('BINDINGS_OR_VERSIONS_CHANGED');
  if (expected.versions.checkpoint_version !== 'LOCAL_REVIEW_CHECKPOINT_V1' ||
      !SHA256.test(expected.versions.code_version || '') ||
      !['blueprint_hash','graph_hash','sources_hash','critical_input_hash'].every(
        k => SHA256.test(expected.bindings[k] || ''))) return blocked('UNVERIFIED_BINDING_FORMAT');

  if (state.revision === 0) {
    if (state.payload != null || state.payload_sha256 != null || registeredOperations.length !== 0 ||
        state.finished === true) return blocked('REVISION_ZERO_NOT_EMPTY');
    return decision('CHECKPOINT_REQUIRED', 'PERSIST_INITIAL_CHECKPOINT_BEFORE_PROVIDER');
  }

  if (typeof state.payload !== 'string' || !SHA256.test(state.payload_sha256 || '') ||
      sha(state.payload) !== state.payload_sha256) return blocked('CHECKPOINT_SHA256_INVALID');

  let envelope;
  try { envelope = JSON.parse(state.payload); } catch { return blocked('CHECKPOINT_JSON_INVALID'); }
  const data = envelope?.data;
  if (!isObject(envelope) || !isObject(data) ||
      data.owner !== expected.owner_id || data.project_id !== expected.run_id ||
      data.version !== expected.versions.checkpoint_version ||
      data.code_version !== expected.versions.code_version ||
      !isDeepStrictEqual(data.sources, expected.sources) || !isObject(data.families) ||
      typeof data.finished !== 'boolean') return blocked('CHECKPOINT_IDENTITY_OR_SOURCE_MISMATCH');
  if (!SHA256.test(envelope.digest || '')) return blocked('CHECKPOINT_INNER_DIGEST_MISSING');
  if (sha(JSON.stringify(data)) !== envelope.digest) return blocked('CHECKPOINT_INNER_DIGEST_INVALID');
  if (!validSnapshot(data.snapshot, expected.bindings)) return blocked('SNAPSHOT_BINDING_OR_STRUCTURE_INVALID');
  if (state.finished !== data.finished) return blocked('FINISHED_FLAG_MISMATCH');
  if (state.resumable !== true) return blocked('SNAPSHOT_NOT_RESUMABLE');

  const names = Object.keys(data.families);
  if (names.some(k => !REVIEW_FAMILIES.includes(k)) ||
      registeredOperations.length > 120) return blocked('UNKNOWN_REVIEW_FAMILY');

  // A retry after a confirmed, retryable provider failure creates a NEW
  // request_id and an operation row that supersedes the old row. Therefore the
  // database can legitimately contain several operation rows for ONE family.
  // Require exactly one linear chain per family, no forks, no missing ancestors,
  // no input/version changes, and the current checkpoint request must be its
  // unique leaf. A raw "one row per family" check would wrongly reject a
  // legitimate recovery after a 503 followed by a durable retry registration.
  const registrations = new Map(REVIEW_FAMILIES.map(k => [k, []]));
  const globalIds = new Set();
  for (const op of registeredOperations) {
    if (!isObject(op) || !REVIEW_FAMILIES.includes(op.family) ||
        !validText(op.request_id) || globalIds.has(op.request_id)) {
      return blocked('DURABLE_OPERATION_NOT_UNIQUE');
    }
    globalIds.add(op.request_id);
    if (op.input_hash !== expected.bindings.critical_input_hash ||
        (op.code_version != null && op.code_version !== expected.versions.code_version) ||
        (op.registered_revision != null && (!Number.isSafeInteger(op.registered_revision) ||
          op.registered_revision < 1 || op.registered_revision > state.revision))) {
      return blocked('DURABLE_OPERATION_HISTORY_INVALID');
    }
    registrations.get(op.family).push(op);
  }
  const byFamily = new Map();
  for (const family of REVIEW_FAMILIES) {
    const ops = registrations.get(family);
    if (!ops.length) continue;
    if (data.families[family] === undefined) return blocked('ORPHANED_DURABLE_OPERATION');
    const map = new Map(ops.map(op => [op.request_id, op]));
    const linked = new Set();
    let rootCount = 0;
    for (const op of ops) {
      if (op.supersedes == null) {rootCount++;continue;}
      const parent = map.get(op.supersedes);
      if (!parent || parent.request_id === op.request_id || linked.has(op.supersedes) ||
          (op.registered_revision != null && parent.registered_revision != null &&
            op.registered_revision <= parent.registered_revision)) {
        return blocked('DURABLE_OPERATION_HISTORY_INVALID');
      }
      linked.add(op.supersedes);
    }
    const leaves = ops.filter(op => !linked.has(op.request_id));
    if (rootCount !== 1 || leaves.length !== 1) {
      return blocked('DURABLE_OPERATION_HISTORY_INVALID');
    }
    if (leaves[0].request_id !== data.families[family]?.request_id) {
      return blocked('DURABLE_OPERATION_NOT_PROVEN');
    }
    // Every element must be reachable backwards from the current leaf; a
    // disconnected cycle must not count as a legitimate supersession chain.
    const reached = new Set();
    let current = leaves[0];
    while (current && !reached.has(current.request_id)) {
      reached.add(current.request_id);
      current = current.supersedes == null ? null : map.get(current.supersedes);
    }
    if (reached.size !== ops.length || current != null) {
      return blocked('DURABLE_OPERATION_HISTORY_INVALID');
    }
    byFamily.set(family, leaves[0]);
  }

  for (const family of REVIEW_FAMILIES) {
    const row = data.families[family], registered = byFamily.get(family);
    if (row === undefined) {
      if (registered) return blocked('ORPHANED_DURABLE_OPERATION');
      continue;
    }
    if (!isObject(row) || row.focus !== family ||
        row.code_version !== expected.versions.code_version ||
        row.input_hash !== expected.bindings.critical_input_hash ||
        !['PENDING','ACCEPTED','FAILED','COMPLETED'].includes(row.status) ||
        !new RegExp('^sessiongraph-review-' + family.toLowerCase() +
          '-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$').test(row.request_id || '')) {
      return blocked('REVIEW_OPERATION_BINDING_INVALID');
    }
    if (!registered || registered.request_id !== row.request_id ||
        registered.input_hash !== row.input_hash) {
      return blocked('DURABLE_OPERATION_NOT_PROVEN');
    }
    if (row.status === 'PENDING') {
      return decision('UNKNOWN_OUTCOME', 'RECONCILE_SAME_REQUEST_ID_NO_AUTOMATIC_RETRY', { family });
    }
    if (row.status === 'ACCEPTED') {
      return decision('IN_FLIGHT', 'WAIT_FOR_DURABLE_PROVIDER_OUTCOME', { family });
    }
    if (row.status === 'FAILED') {
      if (!RETRYABLE_PROVIDER_STATUSES.has(String(row.provider_status ?? ''))) {
        return blocked('NONRETRYABLE_PROVIDER_FAILURE');
      }
      return decision('RETRY_REGISTRATION_REQUIRED',
        'AUTHORIZE_NEW_PENDING_WITH_SAME_INPUT_HASH_AND_DATABASE_FENCE', { family });
    }
    if (!isObject(row.result) || !Array.isArray(row.result.rows) ||
        row.result.provider?.request_id !== row.request_id ||
        row.result.provider?.focus !== family || !SHA256.test(row.result_hash || '')) {
      return blocked('COMPLETED_REVIEW_NOT_VERIFIED');
    }
  }

  if (state.finished) {
    if (data.final_status !== 'READY_FOR_TEACHER' ||
        !REVIEW_FAMILIES.every(k => data.families[k]?.status === 'COMPLETED')) {
      return blocked('FINAL_REVIEW_INCOMPLETE');
    }
    // Final still requires canonical/pedagogical gate verification by the caller.
    return decision('FINAL_SNAPSHOT_FOUND', 'REVALIDATE_CANONICAL_AND_CURRICULAR_GATES');
  }
  return decision('SNAPSHOT_AVAILABLE', 'REVALIDATE_BLUEPRINT_GRAPH_AND_WORKED_GATES');
}
