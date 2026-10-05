import { deepFreeze } from '../../shadow/project-blueprint-v1/contracts.mjs';
import { buildPipelineSourcesFromProductionRequest } from '../../shadow/router-integration-v1/source-adapter.mjs';
import { CERTIFIED_PLAN_HTTP_STATUS } from '../v0124/certified-plan-route.mjs';
import { runUnifiedPreview } from './unified-preview-orchestrator.mjs';

export const UNIFIED_PREVIEW_ROUTE_VERSION = 'UNIFIED_PREVIEW_ROUTE_V1';

const safeStatus = status => typeof status === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(status) ? status : 'UNKNOWN';
const failure = (http_status, status, code, extra = {}) => deepFreeze({
  http_status,
  body: {
    route_version: UNIFIED_PREVIEW_ROUTE_VERSION,
    status,
    renderable: false,
    canonical_plan_hash: null,
    plan: null,
    code,
    ...extra,
  },
});

/**
 * Pure v0.12.5 route boundary. It prepares authoritative source artifacts,
 * runs the already-certified pipeline runner exactly once through the unified
 * orchestrator, and only exposes a canonical plan when the pipeline is ready.
 */
export function createUnifiedPreviewRoute({ curriculumLookup, pipelineRunner, orchestrator = runUnifiedPreview } = {}) {
  if (typeof curriculumLookup !== 'function') throw Error('UNIFIED_PREVIEW_CURRICULUM_LOOKUP_REQUIRED');
  if (typeof pipelineRunner !== 'function') throw Error('UNIFIED_PREVIEW_PIPELINE_RUNNER_REQUIRED');
  if (typeof orchestrator !== 'function') throw Error('UNIFIED_PREVIEW_ORCHESTRATOR_REQUIRED');

  return async function handleUnifiedPreview({ body, authorization = null, run_id = null, base_run_id = null } = {}) {
    let prepared;
    try {
      prepared = await buildPipelineSourcesFromProductionRequest(body, { curriculumLookup });
    } catch (error) {
      return failure(503, 'SHADOW_ERROR', 'UNIFIED_PREVIEW_SOURCE_BOUNDARY_ERROR', { message: String(error?.message || error).slice(0, 500) });
    }

    if (prepared?.status === 'NEEDS_TEACHER_INPUT') {
      return failure(422, 'NEEDS_TEACHER_INPUT', 'NEEDS_TEACHER_INPUT', {
        missing_teacher_fields: [...(prepared.missing_teacher_fields || [])],
      });
    }
    if (prepared?.status !== 'READY_FOR_PIPELINE') {
      return failure(503, 'SHADOW_ERROR', 'UNIFIED_PREVIEW_SOURCE_NOT_READY');
    }

    const sources = deepFreeze({
      constraints: prepared.sources.constraints,
      curriculum: prepared.sources.curriculum,
      methodology: prepared.sources.methodology,
    });

    let result;
    try {
      result = await orchestrator({
        sources,
        run_id,
        base_run_id,
        pipelineRunner: ({ sources: authoritativeSources }) => pipelineRunner(authoritativeSources, { authorization }),
      });
    } catch (error) {
      return failure(503, 'SHADOW_ERROR', 'UNIFIED_PREVIEW_ORCHESTRATION_ERROR', { message: String(error?.message || error).slice(0, 500) });
    }

    if (result?.status !== 'CANONICAL_LIFECYCLE_READY') {
      const pipelineStatus = safeStatus(result?.pipeline_status);
      return failure(CERTIFIED_PLAN_HTTP_STATUS[pipelineStatus] || 500, pipelineStatus, 'PIPELINE_NOT_READY');
    }

    const lifecycle = result.canonical_lifecycle;
    if (!lifecycle || lifecycle.status !== 'CANONICAL_LIFECYCLE_READY' || !lifecycle.plan || !lifecycle.canonical_plan_hash) {
      return failure(503, 'SHADOW_ERROR', 'UNIFIED_PREVIEW_CANONICAL_LIFECYCLE_INVALID');
    }

    return deepFreeze({
      http_status: 200,
      body: {
        route_version: UNIFIED_PREVIEW_ROUTE_VERSION,
        status: 'READY_FOR_TEACHER',
        renderable: true,
        canonical_plan_hash: lifecycle.canonical_plan_hash,
        approved_blueprint_hash: lifecycle.approved_blueprint_hash,
        approved_graph_hash: lifecycle.approved_graph_hash,
        teacher_projection_hash: lifecycle.teacher_projection_hash,
        plan: lifecycle.plan,
      },
    });
  };
}
