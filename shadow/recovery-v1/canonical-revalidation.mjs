import { isDeepStrictEqual } from 'node:util';
import { assessStage7Recovery } from './decision.mjs';

/**
 * Stage 7 shadow-only curricular revalidation boundary.
 *
 * This module NEVER calls a model, writes a checkpoint, acquires a lease,
 * publishes a plan or declares READY_FOR_TEACHER. It operates on a single
 * authenticated, server-provided bundle. An independently persisted canonical
 * source record is mandatory: attempt/checkpoint values cannot substitute it.
 *
 * `gates` are dependency-injected existing certified curricular validators.
 * Unit tests may use mocks; passing mock gates is NOT production certification.
 */
export const STAGE7_CANONICAL_REVALIDATION_VERSION = 'STAGE7_CANONICAL_REVALIDATION_V1';
export const STAGE7_REQUIRED_GATES = Object.freeze([
  'projectComposition', 'blueprint', 'sessionGraph', 'worked',
  'methodology', 'functional', 'ltg', 'canonicalProjection',
]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN = /^[A-Za-z0-9_.-]{40,4096}$/;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const stable = x => Object.freeze({
  revalidation_version: STAGE7_CANONICAL_REVALIDATION_VERSION,
  provider_call_allowed: false,
  publication_allowed: false,
  ...x,
});
const blocked = (reason, gate) => stable({
  status: 'BLOCKED', next_action: reason,
  ...(gate ? { failed_gate: gate } : {}),
});
function deeplyFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const part of Object.values(value)) deeplyFreeze(part);
  return Object.freeze(value);
}
function isCanonicalBindingValid(bundle, actorId, runId, attemptId) {
  const c = bundle?.canonical;
  return bundle?.canonical_context_available === true && isObject(c) &&
    c.run_id === runId && c.attempt_id === attemptId &&
    c.run_owner_id === actorId && c.attempt_owner_id === actorId &&
    bundle.run_id === runId && bundle.attempt_id === attemptId &&
    bundle.run_owner_id === actorId && bundle.attempt_owner_id === actorId &&
    isObject(c.sources) && isObject(c.bindings) && isObject(c.versions) &&
    isObject(bundle.attempt_sources) && isObject(bundle.attempt_bindings) &&
    isObject(bundle.attempt_versions) &&
    isDeepStrictEqual(c.sources, bundle.attempt_sources) &&
    isDeepStrictEqual(c.bindings, bundle.attempt_bindings) &&
    isDeepStrictEqual(c.versions, bundle.attempt_versions) &&
    isDeepStrictEqual(c.attempt_sources, bundle.attempt_sources) &&
    isDeepStrictEqual(c.attempt_bindings, bundle.attempt_bindings) &&
    isDeepStrictEqual(c.attempt_versions, bundle.attempt_versions);
}

/**
 * `readTrustedBundle` must enforce row ownership and return a coherent
 * single-transaction view, not multiple independently timed SELECTs.
 * `gates` must be wired to certified validators by a future integration;
 * this shadow implementation offers a test seam only.
 */
export function createStage7CanonicalRevalidator({ verifySession, readTrustedBundle, gates } = {}) {
  if (typeof verifySession !== 'function' || typeof readTrustedBundle !== 'function') {
    throw Error('STAGE7_REVALIDATION_TRUSTED_READERS_REQUIRED');
  }
  if (!isObject(gates) || !STAGE7_REQUIRED_GATES.every(k => typeof gates[k] === 'function')) {
    throw Error('STAGE7_REVALIDATION_ALL_GATES_REQUIRED');
  }
  return Object.freeze({
    async inspect({ accessToken, runId, attemptId } = {}) {
      if (!UUID.test(runId || '') || !UUID.test(attemptId || '')) return blocked('INVALID_ID');
      if (!TOKEN.test(accessToken || '')) return blocked('AUTHENTICATION_REQUIRED');
      let actorId;
      try { actorId = await verifySession({ accessToken }); }
      catch { return blocked('AUTHENTICATION_UNAVAILABLE'); }
      if (!UUID.test(actorId || '')) return blocked('AUTHENTICATION_REQUIRED');

      let bundle;
      try {
        bundle = await readTrustedBundle({ actorId, runId, attemptId, accessToken });
      } catch { return blocked('ATOMIC_RECOVERY_READ_UNAVAILABLE'); }
      if (!isObject(bundle) || !isObject(bundle.state) || !Array.isArray(bundle.registered_operations)) {
        return blocked('ATOMIC_BUNDLE_INVALID');
      }
      if (bundle.canonical_context_available !== true || !isObject(bundle.canonical)) {
        return blocked('CANONICAL_CONTEXT_NOT_PERSISTED');
      }
      if (!isCanonicalBindingValid(bundle, actorId, runId, attemptId)) {
        return blocked('OWNER_OR_CANONICAL_BINDING_MISMATCH');
      }

      const c = bundle.canonical;
      const policy = assessStage7Recovery({
        expected: { owner_id: actorId, run_id: runId, sources: c.sources,
          bindings: c.bindings, versions: c.versions },
        state: bundle.state,
        registeredOperations: bundle.registered_operations,
      });
      if (!['SNAPSHOT_AVAILABLE', 'FINAL_SNAPSHOT_FOUND'].includes(policy.status)) {
        return stable({ status: policy.status, next_action: policy.next_action,
          ...(policy.family ? { family: policy.family } : {}) });
      }

      // assessStage7Recovery already validated the outer SHA256, inner digest,
      // immutable bindings, snapshot structure, and durable operation identity.
      // Reparse only from that SAME trusted bundle; never accept browser snapshot.
      let snap;
      try { snap = JSON.parse(bundle.state.payload).data.snapshot; }
      catch { return blocked('CHECKPOINT_SNAPSHOT_UNAVAILABLE'); }
      if (!isObject(snap)) return blocked('CHECKPOINT_SNAPSHOT_UNAVAILABLE');
      const readonlyContext = deeplyFreeze(structuredClone({
        actorId, runId, attemptId, snapshot: snap,
        sources: c.sources, bindings: c.bindings, versions: c.versions,
      }));

      for (const gate of STAGE7_REQUIRED_GATES) {
        try {
          const result = await gates[gate](readonlyContext);
          if (!isObject(result) || result.status !== 'PASS') {
            return blocked('CURRICULAR_REVALIDATION_REQUIRED', gate);
          }
        } catch { return blocked('CURRICULAR_VALIDATOR_UNAVAILABLE', gate); }
      }
      return stable({
        status: 'SHADOW_GATES_PASSED',
        next_action: 'REVALIDATE_WITH_CERTIFIED_PIPELINE_BEFORE_PUBLICATION',
        source_checkpoint_status: policy.status,
        gates_checked: STAGE7_REQUIRED_GATES.length,
      });
    },
  });
}
