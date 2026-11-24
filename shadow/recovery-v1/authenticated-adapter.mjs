import { isDeepStrictEqual } from 'node:util';
import { assessStage7Recovery } from './decision.mjs';

/**
 * Shadow integration boundary (not installed on any production route).
 * An authenticated request is required, and all source-of-truth values are
 * reloaded from a trusted server-side reader, never from the browser payload.
 * This adapter cannot acquire leases, persist checkpoints or call a provider.
 */
export const STAGE7_AUTHENTICATED_ADAPTER_VERSION = 'STAGE7_AUTHENTICATED_ADAPTER_V1';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const blocked = reason => Object.freeze({
  adapter_version: STAGE7_AUTHENTICATED_ADAPTER_VERSION,
  status: 'BLOCKED', next_action: reason, provider_call_allowed: false,
});

/**
 * Verify a real Supabase Auth session against a fixed project, not by decoding
 * browser JWT claims without checking a signature or the session's validity.
 * A caller supplies a publishable/anon API key, NEVER a service-role secret.
 */
export function createSupabaseSessionVerifier({ projectRef, publishableKey, fetchImpl = fetch } = {}) {
  if (!/^[a-z0-9]{20}$/.test(projectRef || '') ||
      typeof publishableKey !== 'string' || !publishableKey ||
      typeof fetchImpl !== 'function') throw Error('INVALID_SUPABASE_AUTH_CONFIGURATION');
  const endpoint = `https://${projectRef}.supabase.co/auth/v1/user`;
  return async ({ accessToken } = {}) => {
    if (typeof accessToken !== 'string' || !/^[A-Za-z0-9_.-]{40,4096}$/.test(accessToken)) return null;
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'GET',
        headers: { apikey: publishableKey, authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(7_000),
      });
      if (!response.ok) return null;
      const user = await response.json();
      return UUID.test(user?.id || '') && user?.aud === 'authenticated' ? user.id : null;
    } catch {
      // Network/timeout/invalid JSON: authentication never succeeds by fallback.
      return null;
    }
  };
}

/**
 * Trusted reader contract:
 *   readCanonicalContext({actorId, runId, attemptId}) -> {
 *      run_id, run_owner_id, attempt_id, attempt_owner_id,
 *      sources, bindings, versions, attempt_sources, attempt_bindings,
 *      attempt_versions
 *   }
 *   readState({actorId,runId,attemptId}) -> read_state JSON (full payload)
 *   readOperations({actorId,runId,attemptId}) -> authorized operations list
 *
 * A future implementation must enforce owner/RLS on the server and must fetch
 * canonical sources/bindings independently of the attempt row. The current
 * laboratory worker does not expose all these fields; do not fake them.
 */
export function createStage7AuthenticatedAdapter({
  verifySession, readCanonicalContext, readState, readOperations,
} = {}) {
  if ([verifySession, readCanonicalContext, readState, readOperations]
    .some(fn => typeof fn !== 'function')) throw Error('STAGE7_TRUSTED_READERS_REQUIRED');

  return Object.freeze({
    async inspect({ accessToken, runId, attemptId } = {}) {
      if (!UUID.test(runId || '') || !UUID.test(attemptId || '')) return blocked('INVALID_ID');
      if (typeof accessToken !== 'string' || !accessToken) return blocked('AUTHENTICATION_REQUIRED');
      let actorId;
      try { actorId = await verifySession({ accessToken }); }
      catch { return blocked('AUTHENTICATION_UNAVAILABLE'); }
      if (!UUID.test(actorId || '')) return blocked('AUTHENTICATION_REQUIRED');

      const scope = Object.freeze({ actorId, runId, attemptId });
      let canonical;
      try { canonical = await readCanonicalContext(scope); }
      catch { return blocked('AUTHORITATIVE_CONTEXT_UNAVAILABLE'); }
      if (!isObj(canonical) ||
          canonical.run_id !== runId || canonical.attempt_id !== attemptId ||
          canonical.run_owner_id !== actorId || canonical.attempt_owner_id !== actorId ||
          !isObj(canonical.sources) || !isObj(canonical.bindings) || !isObj(canonical.versions) ||
          !isDeepStrictEqual(canonical.sources, canonical.attempt_sources) ||
          !isDeepStrictEqual(canonical.bindings, canonical.attempt_bindings) ||
          !isDeepStrictEqual(canonical.versions, canonical.attempt_versions)) {
        return blocked('OWNER_OR_CANONICAL_BINDING_MISMATCH');
      }

      let state, registeredOperations;
      try {
        // Both reads are scoped to the same verified identity/run/attempt.
        state = await readState(scope);
        registeredOperations = await readOperations(scope);
      } catch { return blocked('DURABLE_RECOVERY_READ_FAILED'); }

      const assessment = assessStage7Recovery({
        expected: {
          owner_id: actorId,
          run_id: runId,
          sources: canonical.sources,
          bindings: canonical.bindings,
          versions: canonical.versions,
        },
        state, registeredOperations,
      });
      // An adapter result is a policy observation, NEVER permission to generate.
      return Object.freeze({
        adapter_version: STAGE7_AUTHENTICATED_ADAPTER_VERSION,
        status: assessment.status,
        next_action: assessment.next_action,
        provider_call_allowed: false,
        ...(assessment.family ? { family: assessment.family } : {}),
      });
    },
  });
}

/**
 * Shadow-only preflight seam for a future server pipeline orchestration.
 * Returns only an assessment. Never invokes a pipeline or model, even when a
 * valid checkpoint is seen; curricular gates must be re-run separately.
 */
export async function inspectStage7BeforePipeline({ adapter, accessToken, runId, attemptId } = {}) {
  if (!adapter || typeof adapter.inspect !== 'function') throw Error('STAGE7_ADAPTER_REQUIRED');
  return adapter.inspect({ accessToken, runId, attemptId });
}