import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherProjectionHash } from '../shadow/pipeline-v1/projection.mjs';
import { runUnifiedPreview, UNIFIED_PREVIEW_ORCHESTRATOR_VERSION } from '../lib/v0125/unified-preview-orchestrator.mjs';
import { assertCanonicalLifecycle } from '../lib/v0125/canonical-lifecycle.mjs';

function fixture() {
  const sources = {
    constraints: {
      grades: [1, 3],
      selected_pda_ids: ['p1'],
      requested_sessions: 1,
      minutes_per_session: 90,
      original_problem: 'El grupo necesita comprender sus acuerdos escolares.',
      original_context: 'Escuela multigrado sin internet.',
      available_resources: ['papel', 'lápices'],
      supports: ['modelado docente'],
      constraints_hash: 'a'.repeat(64),
    },
    curriculum: {
      pdas: [{ pda_id: 'p1', grade: 1, field: 'De lo Humano y lo Comunitario', pda_official: 'Explica situaciones y propone acuerdos.' }],
      snapshot_hash: 'b'.repeat(64),
    },
    methodology: {
      selected_id: 'proyectos_comunitarios',
      selection_source: 'TEACHER',
      catalog_version: 'METHODOLOGY_CATALOG_V1',
      methodology_decision_id: 'm1',
    },
  };

  const projectionBody = {
    projection_version: 'TEACHER_PLAN_PROJECTION_V1',
    status: 'READY_FOR_TEACHER',
    source: {
      blueprint_id: 'bp1',
      blueprint_revision: 1,
      approved_blueprint_hash: 'c'.repeat(64),
      graph_id: 'sg1',
      graph_revision: 1,
      approved_graph_hash: 'd'.repeat(64),
    },
    project: {
      problem_frame: { original_problem: sources.constraints.original_problem },
      guiding_question: { question: '¿Cómo podemos explicar y mejorar nuestros acuerdos?' },
      methodology: { selected_id: 'proyectos_comunitarios' },
      final_outcome: { name: 'Museo de acuerdos escolares', purpose: 'Explicar y poner en práctica acuerdos escolares.' },
      pda_analysis: [],
      grade_contributions: [
        { grade: 1, contribution: 'Explicaciones ilustradas', evidence: 'Tarjetas' },
        { grade: 3, contribution: 'Participación transversal', evidence: 'Registro' },
      ],
      project_stages: [],
      ltg_strategy: { mode: 'NONE', selections: [] },
    },
    sessions: [{
      session_number: 1,
      methodology_operations: ['IDENTIFICACION', 'RECUPERACION'],
      session_project_goal: 'Reconocer el problema y recuperar saberes.',
      project_state_after: 'Acuerdos y preguntas identificados.',
      expected_partial_product: 'Mapa inicial de acuerdos.',
      next_session_dependency: '',
      pda_focus: ['p1'],
      total_minutes: 90,
      activities: [{
        title: 'Identificamos acuerdos',
        contribution_mode: 'DIRECT',
        common_student_action: 'Reconocen situaciones y explican acuerdos.',
        grade_participation: [{ grade: 1 }, { grade: 3 }],
        teacher_role: 'Modela preguntas y organiza el intercambio.',
        minutes: 90,
        output: 'Mapa inicial',
        evidence: 'Registro del mapa',
      }],
    }],
    traceability: {},
  };

  const teacherPlan = { ...projectionBody, projection_hash: teacherProjectionHash(projectionBody) };
  const readyResult = {
    pipeline_version: 'MULTIPLAN_SHADOW_PIPELINE_V1',
    status: 'READY_FOR_TEACHER',
    blueprint_approval: { status: 'APPROVED', approved_blueprint_hash: projectionBody.source.approved_blueprint_hash },
    session_approval: { status: 'APPROVED', approved_graph_hash: projectionBody.source.approved_graph_hash },
    teacher_plan: teacherPlan,
  };
  return { sources, readyResult };
}

test('orchestrator runs pipeline once and promotes only READY_FOR_TEACHER into canonical lifecycle', async () => {
  const { sources, readyResult } = fixture();
  let calls = 0;
  const drivers = { marker: 'drivers' };
  const options = { marker: 'options' };
  const runner = async input => {
    calls += 1;
    assert.strictEqual(input.sources, sources);
    assert.strictEqual(input.drivers, drivers);
    assert.strictEqual(input.options, options);
    return readyResult;
  };

  const result = await runUnifiedPreview({
    sources,
    drivers,
    options,
    run_id: '11111111-1111-4111-8111-111111111111',
    pipelineRunner: runner,
  });

  assert.equal(calls, 1);
  assert.equal(result.orchestrator_version, UNIFIED_PREVIEW_ORCHESTRATOR_VERSION);
  assert.equal(result.status, 'CANONICAL_LIFECYCLE_READY');
  assert.equal(result.pipeline_status, 'READY_FOR_TEACHER');
  assert.equal(result.canonical_lifecycle.plan.run_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(result.canonical_plan_hash, result.canonical_lifecycle.canonical_plan_hash);
  assert.equal(assertCanonicalLifecycle(result.canonical_lifecycle), true);
});

test('orchestrator preserves pipeline rejection and never fabricates canonical output', async () => {
  const { sources } = fixture();
  let calls = 0;
  const rejected = { pipeline_version: 'MULTIPLAN_SHADOW_PIPELINE_V1', status: 'SESSION_GRAPH_REJECTED', errors: [{ code: 'BPD-TEST' }] };
  const result = await runUnifiedPreview({
    sources,
    pipelineRunner: async () => { calls += 1; return rejected; },
  });

  assert.equal(calls, 1);
  assert.equal(result.status, 'PIPELINE_NOT_READY');
  assert.equal(result.pipeline_status, 'SESSION_GRAPH_REJECTED');
  assert.equal(result.canonical_lifecycle, null);
  assert.deepEqual(result.pipeline_result, rejected);
  assert.equal('canonical_plan_hash' in result, false);
});

test('orchestrator requires an explicit callable pipeline runner', async () => {
  const { sources } = fixture();
  await assert.rejects(
    () => runUnifiedPreview({ sources, pipelineRunner: null }),
    /UNIFIED_PREVIEW_PIPELINE_RUNNER_REQUIRED/,
  );
});
