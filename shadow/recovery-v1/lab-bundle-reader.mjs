import { createStage7AuthenticatedAdapter } from './authenticated-adapter.mjs';
/**
 * Read-only client for the isolated MULTIPLAN-LAB Edge worker. The worker
 * independently verifies the bearer with Supabase Auth and enforces its SQL
 * executor/owner RLS boundary. No DB secrets or service-role keys are used.
 *
 * This client cannot invent missing original canonical sources. A lab fixture
 * with only input_json.lab_fixture MUST produce a fail-closed adapter result.
 */
export const STAGE7_LAB_BUNDLE_READER_VERSION = 'STAGE7_LAB_BUNDLE_READER_V1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_.-]{40,4096}$/;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);

export function createStage7LabBundleReader({ projectRef, publishableKey, fetchImpl = fetch } = {}) {
  if (!/^[a-z0-9]{20}$/.test(projectRef || '') ||
      typeof publishableKey !== 'string' || publishableKey.length < 1 ||
      typeof fetchImpl !== 'function') throw Error('STAGE7_LAB_READER_CONFIGURATION_INVALID');
  const endpoint = \`https://\${projectRef}.supabase.co/functions/v1/multiplan-stage7-worker-lab\`;
  return async function readTrustedBundle({ actorId, runId, attemptId, accessToken } = {}) {
    // actorId is supplied ONLY after /auth/v1/user verified the actual session.
    if (!UUID.test(actorId || '') || !UUID.test(runId || '') ||
        !UUID.test(attemptId || '') || !TOKEN.test(accessToken || '')) {
      throw Error('STAGE7_LAB_READER_SCOPE_INVALID');
    }
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          authorization: \`Bearer \${accessToken}\`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'read_bundle', run_id: runId, attempt_id: attemptId }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw Error('STAGE7_LAB_READER_NETWORK_UNAVAILABLE');
    }
    if (!response?.ok) throw Error('STAGE7_LAB_READER_HTTP_REJECTED');
    let reply;
    try { reply = await response.json(); }
    catch { throw Error('STAGE7_LAB_READER_INVALID_RESPONSE'); }
    if (reply?.ok !== true || !isObject(reply?.bundle)) {
      throw Error('STAGE7_LAB_READER_INVALID_RESPONSE');
    }
    const bundle = reply.bundle;
    if (bundle.run_id !== runId || bundle.attempt_id !== attemptId ||
        bundle.run_owner_id !== actorId || bundle.attempt_owner_id !== actorId ||
        !isObject(bundle.attempt_sources) || !isObject(bundle.attempt_bindings) ||
        !isObject(bundle.attempt_versions) || !isObject(bundle.state) ||
        !Array.isArray(bundle.registered_operations) ||
        typeof bundle.canonical_context_available !== 'boolean' ||
        (bundle.canonical_context_available && !isObject(bundle.canonical))) {
      throw Error('STAGE7_LAB_READER_BINDING_INVALID');
    }
    // Never promote attempt bindings to 'canonical'. Canonical must be
    // independently recorded for the source run, which the lab lacks today.
    return bundle;
  };
}

/**
 * A single authenticated bundle is fetched per inspect. This is a shadow-only
 * adapter: it never persists state, creates leases, nor invokes a provider.
 * Canonical data must come from the original run, not the attempt snapshot.
 */
export function createStage7LabRecoveryInspector({verifySession, readTrustedBundle}={}) {
  if (typeof verifySession !== 'function' || typeof readTrustedBundle !== 'function') {
    throw Error('STAGE7_LAB_INSPECTOR_REQUIRES_TRUSTED_SERVICES');
  }
  const refuse = reason => Object.freeze({
    status:'BLOCKED',next_action:reason,provider_call_allowed:false,
  });
  return Object.freeze({
    async inspect({accessToken,runId,attemptId}={}) {
      if (!UUID.test(runId || '') || !UUID.test(attemptId || '')) return refuse('INVALID_ID');
      if (!TOKEN.test(accessToken || '')) return refuse('AUTHENTICATION_REQUIRED');
      let actorId;
      try {actorId=await verifySession({accessToken});}
      catch {return refuse('AUTHENTICATION_UNAVAILABLE');}
      if (!UUID.test(actorId || '')) return refuse('AUTHENTICATION_REQUIRED');
      let bundle;
      try {bundle=await readTrustedBundle({actorId,runId,attemptId,accessToken});}
      catch {return refuse('DURABLE_RECOVERY_READ_FAILED');}
      if (bundle.canonical_context_available !== true ||
          !isObject(bundle.canonical)) return refuse('CANONICAL_CONTEXT_NOT_PERSISTED');
      // A fresh adapter per request avoids cross-request/global state and never
      // reads canonical input from a caller-controlled browser field.
      const safe=createStage7AuthenticatedAdapter({
        verifySession:async()=>actorId,
        readCanonicalContext:async()=>bundle.canonical,
        readState:async()=>bundle.state,
        readOperations:async()=>bundle.registered_operations,
      });
      return safe.inspect({accessToken,runId,attemptId});
    },
  });
}
