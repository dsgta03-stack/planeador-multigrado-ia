import { deepFreeze } from '../../shadow/project-blueprint-v1/contracts.mjs';
import { runShadowPipeline } from '../../shadow/pipeline-v1/pipeline.mjs';
import { canonicalLifecycleFromPipeline } from './canonical-lifecycle.mjs';

export const UNIFIED_PREVIEW_ORCHESTRATOR_VERSION = 'UNIFIED_PREVIEW_ORCHESTRATOR_V1';

const text = value => String(value ?? '').trim();

/**
 * Parallel v0.12.5 orchestration layer.
 *
 * It does not replace or mutate the certified shadow pipeline. The pipeline is
 * executed exactly once. Only READY_FOR_TEACHER may be promoted into the
 * canonical lifecycle consumed by snapshot/review/export compatibility paths.
 */
export async function runUnifiedPreview({
  sources,
  drivers = {},
  options = {},
  run_id = null,
  base_run_id = null,
  pipelineRunner = runShadowPipeline,
} = {}) {
  if (typeof pipelineRunner !== 'function') throw Error('UNIFIED_PREVIEW_PIPELINE_RUNNER_REQUIRED');

  const pipelineResult = await pipelineRunner({ sources, drivers, options });
  const pipelineStatus = text(pipelineResult?.status) || 'UNKNOWN';

  if (pipelineStatus !== 'READY_FOR_TEACHER') {
    return deepFreeze({
      orchestrator_version: UNIFIED_PREVIEW_ORCHESTRATOR_VERSION,
      status: 'PIPELINE_NOT_READY',
      pipeline_status: pipelineStatus,
      canonical_lifecycle: null,
      pipeline_result: pipelineResult ?? null,
    });
  }

  const canonicalLifecycle = canonicalLifecycleFromPipeline({
    sources,
    pipelineResult,
    run_id,
    base_run_id,
  });

  return deepFreeze({
    orchestrator_version: UNIFIED_PREVIEW_ORCHESTRATOR_VERSION,
    status: 'CANONICAL_LIFECYCLE_READY',
    pipeline_status: pipelineStatus,
    canonical_plan_hash: canonicalLifecycle.canonical_plan_hash,
    canonical_lifecycle: canonicalLifecycle,
    pipeline_result: pipelineResult,
  });
}
