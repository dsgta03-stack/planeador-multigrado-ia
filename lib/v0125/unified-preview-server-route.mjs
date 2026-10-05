import { createCertifiedPipelineRunner } from '../v0124/certified-runtime.mjs';
import { createSupabaseCurriculumLookup } from '../../shadow/router-integration-v1/supabase-curriculum.mjs';
import { createUnifiedPreviewRoute } from './unified-preview-route.mjs';
import { persistCanonicalSnapshot } from './canonical-history.mjs';

export const UNIFIED_PREVIEW_SERVER_ROUTE_VERSION = 'UNIFIED_PREVIEW_SERVER_ROUTE_V1';
const PROJECT_SUPABASE_URL = 'https://dvcrwzxznuqongutnifn.supabase.co';

const closed = (json, res, status, code) => json(res, status, {
  server_route_version: UNIFIED_PREVIEW_SERVER_ROUTE_VERSION,
  status: 'UNAVAILABLE',
  renderable: false,
  canonical_plan_hash: null,
  plan: null,
  code,
});

/**
 * Mountable v0.12.5 HTTP boundary.
 *
 * Construction is side-effect free: no provider, Supabase, child process or
 * network work occurs until an enabled, authenticated POST request arrives.
 *
 * Mainline compatibility note: current v0.12.4 certified-runtime accepts the
 * real Supabase Edge Function pathname directly. Do not rewrite the endpoint
 * here; pass the configured endpoint and fetch implementation unchanged.
 */
export function createUnifiedPreviewServerRoute({
  env = process.env,
  readBody,
  bearer,
  json,
  runtimeFactory = createCertifiedPipelineRunner,
  curriculumLookupFactory = createSupabaseCurriculumLookup,
  routeFactory = createUnifiedPreviewRoute,
  snapshotPersister = persistCanonicalSnapshot,
  fetchImpl = fetch,
} = {}) {
  if (typeof readBody !== 'function' || typeof bearer !== 'function' || typeof json !== 'function') {
    throw Error('UNIFIED_PREVIEW_HTTP_HELPERS_REQUIRED');
  }
  if (typeof snapshotPersister !== 'function') throw Error('UNIFIED_PREVIEW_SNAPSHOT_PERSISTER_REQUIRED');

  return async function handleUnifiedPreviewServerRoute(req, res) {
    if (env.MULTIPLAN_V0125_UNIFIED_PREVIEW_ENABLED !== '1') {
      return closed(json, res, 404, 'UNIFIED_PREVIEW_ROUTE_DISABLED');
    }
    if (req.method !== 'POST') return closed(json, res, 405, 'METHOD_NOT_ALLOWED');

    const authorization = bearer(req);
    if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) {
      return closed(json, res, 401, 'USER_AUTHORIZATION_REQUIRED');
    }

    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch (error) {
      const tooLarge = String(error?.message || error).includes('PAYLOAD_TOO_LARGE');
      return closed(json, res, tooLarge ? 413 : 400, tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON');
    }

    try {
      const pipelineRunner = runtimeFactory({
        endpoint: env.MULTIPLAN_CERTIFIED_R2_ENDPOINT,
        token: env.MULTIPLAN_CERTIFIED_R2_TOKEN,
        identity: env.MULTIPLAN_CERTIFIED_R2_IDENTITY,
        fetchImpl,
      });
      const curriculumLookup = curriculumLookupFactory({
        url: PROJECT_SUPABASE_URL,
        publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
        authorization,
        fetchImpl,
      });
      const route = routeFactory({ curriculumLookup, pipelineRunner });
      const result = await route({
        body,
        authorization,
        run_id: body?.run_id ?? null,
        base_run_id: body?.base_run_id ?? null,
      });

      if (!Number.isInteger(result?.http_status) || result.http_status < 100 || result.http_status > 599 || !result?.body) {
        throw Error('UNIFIED_PREVIEW_ROUTE_RESPONSE_INVALID');
      }

      let snapshotPersistence = null;
      if (result.http_status === 200) {
        if (result.body.status !== 'READY_FOR_TEACHER' || result.body.renderable !== true || !result.body.plan || !result.body.canonical_plan_hash) {
          throw Error('UNIFIED_PREVIEW_ROUTE_SUCCESS_INVALID');
        }

        try {
          snapshotPersistence = await snapshotPersister({
            authorization,
            plan: result.body.plan,
            canonical_plan_hash: result.body.canonical_plan_hash,
          });
        } catch (error) {
          snapshotPersistence = {
            status: 'FAILED',
            reason: 'SNAPSHOT_PERSIST_EXCEPTION',
            message: String(error?.message || error).slice(0, 300),
            canonical_plan_hash: result.body.canonical_plan_hash,
          };
        }

        if (!snapshotPersistence || typeof snapshotPersistence !== 'object') {
          snapshotPersistence = {
            status: 'FAILED',
            reason: 'SNAPSHOT_PERSIST_INVALID_RESULT',
            canonical_plan_hash: result.body.canonical_plan_hash,
          };
        }
        if (snapshotPersistence.status === 'REJECTED') {
          return closed(json, res, 503, 'UNIFIED_PREVIEW_CANONICAL_SNAPSHOT_REJECTED');
        }
      } else if (result.body.plan !== null || result.body.canonical_plan_hash !== null) {
        throw Error('UNIFIED_PREVIEW_ROUTE_FAILURE_EXPOSED_PLAN');
      }

      return json(res, result.http_status, {
        server_route_version: UNIFIED_PREVIEW_SERVER_ROUTE_VERSION,
        ...result.body,
        ...(result.http_status === 200 ? { snapshot_persistence: snapshotPersistence } : {}),
      });
    } catch {
      return closed(json, res, 503, 'UNIFIED_PREVIEW_ROUTE_UNAVAILABLE');
    }
  };
}
