import { adaptTeacherProjectionToCanonicalPlan, canonicalPlanHash } from './blueprint-canonical-adapter.mjs';

export const PIPELINE_CANONICAL_BRIDGE_VERSION = 'PIPELINE_CANONICAL_BRIDGE_V1';

const text = value => String(value ?? '').trim();

function assertReadyPipelineResult(result) {
  if (!result || typeof result !== 'object') throw Error('PIPELINE_CANONICAL_RESULT_REQUIRED');
  if (result.status !== 'READY_FOR_TEACHER') throw Error('PIPELINE_CANONICAL_REQUIRES_READY_FOR_TEACHER');
  if (!result.teacher_plan || typeof result.teacher_plan !== 'object') throw Error('PIPELINE_CANONICAL_TEACHER_PLAN_REQUIRED');
  if (!result.blueprint_approval || result.blueprint_approval.status !== 'APPROVED') throw Error('PIPELINE_CANONICAL_BLUEPRINT_APPROVAL_REQUIRED');
  if (!result.session_approval || result.session_approval.status !== 'APPROVED') throw Error('PIPELINE_CANONICAL_SESSION_APPROVAL_REQUIRED');

  const projectionBlueprintHash = text(result.teacher_plan?.source?.approved_blueprint_hash);
  const pipelineBlueprintHash = text(result.blueprint_approval?.approved_blueprint_hash);
  if (!projectionBlueprintHash || projectionBlueprintHash !== pipelineBlueprintHash) {
    throw Error('PIPELINE_CANONICAL_BLUEPRINT_BINDING_MISMATCH');
  }

  const projectionGraphHash = text(result.teacher_plan?.source?.approved_graph_hash);
  const pipelineGraphHash = text(result.session_approval?.approved_graph_hash);
  if (!projectionGraphHash || projectionGraphHash !== pipelineGraphHash) {
    throw Error('PIPELINE_CANONICAL_SESSION_BINDING_MISMATCH');
  }
}

export function canonicalPlanFromPipelineResult({ sources, pipelineResult, run_id = null, base_run_id = null }) {
  assertReadyPipelineResult(pipelineResult);

  const plan = adaptTeacherProjectionToCanonicalPlan({
    sources,
    teacherPlan: pipelineResult.teacher_plan,
    run_id,
    base_run_id,
  });

  return Object.freeze({
    bridge_version: PIPELINE_CANONICAL_BRIDGE_VERSION,
    status: 'CANONICAL_PLAN_READY',
    source_pipeline_version: text(pipelineResult.pipeline_version),
    approved_blueprint_hash: text(pipelineResult.blueprint_approval.approved_blueprint_hash),
    approved_graph_hash: text(pipelineResult.session_approval.approved_graph_hash),
    teacher_projection_hash: text(pipelineResult.teacher_plan.projection_hash),
    canonical_plan_hash: canonicalPlanHash(plan),
    plan,
  });
}
