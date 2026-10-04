import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherProjectionHash } from '../shadow/pipeline-v1/projection.mjs';
import { canonicalPlanHash } from '../lib/v0125/blueprint-canonical-adapter.mjs';
import { canonicalPlanFromPipelineResult, PIPELINE_CANONICAL_BRIDGE_VERSION } from '../lib/v0125/pipeline-canonical-bridge.mjs';

function fixture() {
  const blueprintHash = 'c'.repeat(64);
  const graphHash = 'd'.repeat(64);
  const sources = {
    constraints: {
      grades: [1, 3],
      selected_pda_ids: ['p1'],
      original_problem: 'El grupo necesita comprender sus acuerdos escolares.',
      original_context: 'Escuela multigrado sin internet.',
      available_resources: ['papel', 'lápices'],
      supports: ['modelado docente'],
      constraints_hash: 'a'.repeat(64),
    },
    curriculum: {
      pdas: [
        { pda_id: 'p1', grade: 1, pda_official: 'Explica situaciones y propone acuerdos.' },
        { pda_id: 'p3', grade: 3, pda_official: 'Indaga prácticas y acuerdos de su comunidad.' },
      ],
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
      approved_blueprint_hash: blueprintHash,
      graph_id: 'sg1',
      graph_revision: 1,
      approved_graph_hash: graphHash,
    },
    project: {
      problem_frame: { original_problem: sources.constraints.original_problem },
      guiding_question: { question: '¿Cómo podemos explicar nuestros acuerdos?' },
      methodology: { selected_id: 'proyectos_comunitarios' },
      final_outcome: { name: 'Museo de acuerdos escolares', purpose: 'Explicar y poner en práctica acuerdos.' },
      pda_analysis: [],
      grade_contributions: [
        { grade: 1, contribution: 'Explicaciones ilustradas', evidence: 'Tarjetas' },
        { grade: 3, contribution: 'Registro de indagación', evidence: 'Fichas' },
      ],
      project_stages: [],
      ltg_strategy: { mode: 'NONE', selections: [] },
    },
    sessions: [
      {
        session_number: 1,
        methodology_operations: ['IDENTIFICACION'],
        session_project_goal: 'Reconocer el problema.',
        project_state_after: 'Problema reconocido.',
        expected_partial_product: 'Mapa inicial.',
        next_session_dependency: '',
        pda_focus: ['p1'],
        total_minutes: 90,
        activities: [{
          title: 'Reconocemos acuerdos',
          contribution_mode: 'DIRECT',
          common_student_action: 'Explican acuerdos escolares.',
          grade_participation: [{ grade: 1 }, { grade: 3 }],
          teacher_role: 'Organiza el intercambio.',
          minutes: 90,
          output: 'Mapa inicial',
          evidence: 'Registro del mapa',
        }],
      },
    ],
    traceability: {},
  };
  const teacherPlan = { ...projectionBody, projection_hash: teacherProjectionHash(projectionBody) };
  const pipelineResult = {
    pipeline_version: 'MULTIPLAN_SHADOW_PIPELINE_V1',
    status: 'READY_FOR_TEACHER',
    blueprint_approval: { status: 'APPROVED', approved_blueprint_hash: blueprintHash },
    session_approval: { status: 'APPROVED', approved_graph_hash: graphHash },
    teacher_plan: teacherPlan,
  };

  return { sources, pipelineResult };
}

test('bridges READY_FOR_TEACHER to canonical plan with explicit approval bindings', () => {
  const { sources, pipelineResult } = fixture();
  const result = canonicalPlanFromPipelineResult({
    sources,
    pipelineResult,
    run_id: '11111111-1111-4111-8111-111111111111',
  });

  assert.equal(result.bridge_version, PIPELINE_CANONICAL_BRIDGE_VERSION);
  assert.equal(result.status, 'CANONICAL_PLAN_READY');
  assert.equal(result.approved_blueprint_hash, pipelineResult.blueprint_approval.approved_blueprint_hash);
  assert.equal(result.approved_graph_hash, pipelineResult.session_approval.approved_graph_hash);
  assert.equal(result.teacher_projection_hash, pipelineResult.teacher_plan.projection_hash);
  assert.equal(result.canonical_plan_hash, canonicalPlanHash(result.plan));
  assert.deepEqual(result.plan.selected_pdas.map(x => x.pda_id), ['p1']);
  assert.equal(result.plan.sessions.length, 1);
});

test('rejects pipeline results that are not READY_FOR_TEACHER', () => {
  const { sources, pipelineResult } = fixture();
  pipelineResult.status = 'SESSION_GRAPH_REJECTED';
  assert.throws(
    () => canonicalPlanFromPipelineResult({ sources, pipelineResult }),
    /PIPELINE_CANONICAL_REQUIRES_READY_FOR_TEACHER/,
  );
});

test('rejects cross-artifact approval binding mismatches', () => {
  const first = fixture();
  first.pipelineResult.blueprint_approval.approved_blueprint_hash = 'e'.repeat(64);
  assert.throws(
    () => canonicalPlanFromPipelineResult({ sources: first.sources, pipelineResult: first.pipelineResult }),
    /PIPELINE_CANONICAL_BLUEPRINT_BINDING_MISMATCH/,
  );

  const second = fixture();
  second.pipelineResult.session_approval.approved_graph_hash = 'f'.repeat(64);
  assert.throws(
    () => canonicalPlanFromPipelineResult({ sources: second.sources, pipelineResult: second.pipelineResult }),
    /PIPELINE_CANONICAL_SESSION_BINDING_MISMATCH/,
  );
});
