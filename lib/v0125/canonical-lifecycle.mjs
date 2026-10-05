import { deepFreeze } from '../../shadow/project-blueprint-v1/contracts.mjs';
import { SNAPSHOT_VERSION } from '../v0124/history-fidelity.mjs';
import { canonicalPlanHash } from './blueprint-canonical-adapter.mjs';
import { canonicalPlanFromPipelineResult } from './pipeline-canonical-bridge.mjs';

export const CANONICAL_LIFECYCLE_VERSION = 'CANONICAL_PLAN_LIFECYCLE_V1';

function assertPlanHash(plan, expected, code) {
  const actual = canonicalPlanHash(plan);
  if (!expected || actual !== expected) throw Error(code);
  return actual;
}

export function canonicalLifecycleFromPipeline({ sources, pipelineResult, run_id = null, base_run_id = null }) {
  const bridge = canonicalPlanFromPipelineResult({ sources, pipelineResult, run_id, base_run_id });
  const plan = bridge.plan;
  const planHash = assertPlanHash(plan, bridge.canonical_plan_hash, 'CANONICAL_LIFECYCLE_BRIDGE_HASH_MISMATCH');

  const lifecycle = {
    lifecycle_version: CANONICAL_LIFECYCLE_VERSION,
    status: 'CANONICAL_LIFECYCLE_READY',
    bridge_version: bridge.bridge_version,
    source_pipeline_version: bridge.source_pipeline_version,
    approved_blueprint_hash: bridge.approved_blueprint_hash,
    approved_graph_hash: bridge.approved_graph_hash,
    teacher_projection_hash: bridge.teacher_projection_hash,
    canonical_plan_hash: planHash,
    plan,
    snapshot: {
      schema_version: SNAPSHOT_VERSION,
      canonical_plan_hash: planHash,
      plan,
    },
    review: {
      canonical_plan_hash: planHash,
      payload: { plan },
    },
    export: {
      canonical_plan_hash: planHash,
      plan,
    },
  };

  return deepFreeze(lifecycle);
}

export function assertCanonicalLifecycle(lifecycle) {
  if (!lifecycle || lifecycle.lifecycle_version !== CANONICAL_LIFECYCLE_VERSION || lifecycle.status !== 'CANONICAL_LIFECYCLE_READY') {
    throw Error('CANONICAL_LIFECYCLE_INVALID');
  }
  const expected = lifecycle.canonical_plan_hash;
  assertPlanHash(lifecycle.plan, expected, 'CANONICAL_LIFECYCLE_PLAN_HASH_MISMATCH');
  assertPlanHash(lifecycle.snapshot?.plan, expected, 'CANONICAL_LIFECYCLE_SNAPSHOT_HASH_MISMATCH');
  assertPlanHash(lifecycle.review?.payload?.plan, expected, 'CANONICAL_LIFECYCLE_REVIEW_HASH_MISMATCH');
  assertPlanHash(lifecycle.export?.plan, expected, 'CANONICAL_LIFECYCLE_EXPORT_HASH_MISMATCH');
  if (lifecycle.snapshot?.canonical_plan_hash !== expected) throw Error('CANONICAL_LIFECYCLE_SNAPSHOT_BINDING_MISMATCH');
  if (lifecycle.review?.canonical_plan_hash !== expected) throw Error('CANONICAL_LIFECYCLE_REVIEW_BINDING_MISMATCH');
  if (lifecycle.export?.canonical_plan_hash !== expected) throw Error('CANONICAL_LIFECYCLE_EXPORT_BINDING_MISMATCH');
  return true;
}
