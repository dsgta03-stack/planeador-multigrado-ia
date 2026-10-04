import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnifiedPreviewRoute, UNIFIED_PREVIEW_ROUTE_VERSION } from '../lib/v0125/unified-preview-route.mjs';

function body() {
  return {
    grados: [1, 3],
    pdas: [
      { pda_id: 'p1', grade: 1, field: 'legacy', content: 'legacy', pda: 'legacy' },
      { pda_id: 'p3', grade: 3, field: 'legacy', content: 'legacy', pda: 'legacy' },
    ],
    contexto: 'Escuela multigrado rural.',
    situacion_problema: 'Mejorar acuerdos de convivencia.',
    sesiones: 2,
    minutos: 90,
    methodology_selection: 'proyectos_comunitarios',
    methodology_recommendation: { recommended_id: 'proyectos_comunitarios' },
  };
}

function teacherConstraints() {
  return {
    students_by_grade: { 1: 8, 3: 6 },
    reading_profile: 'Lectura diferenciada.',
    writing_profile: 'Escritura diferenciada.',
    autonomy_profile: 'Autonomía diferenciada.',
    connectivity: 'Sin internet estable.',
    available_resources: ['cuadernos'],
    supports: ['modelado docente'],
    teacher_explicit_constraints: ['No usar dispositivos.'],
  };
}

function authoritative() {
  return {
    provenance: 'db:test',
    pdas: [
      { pda_id: 'p1', grade: 1, field: 'DHC', content_official: 'C1', pda_official: 'P1', verification_status: 'Verificado' },
      { pda_id: 'p3', grade: 3, field: 'DHC', content_official: 'C3', pda_official: 'P3', verification_status: 'Verificado' },
    ],
    ltg: [],
  };
}

test('incomplete teacher input fails closed before curriculum or pipeline work', async () => {
  let curriculumCalls = 0, pipelineCalls = 0, orchestratorCalls = 0;
  const route = createUnifiedPreviewRoute({
    curriculumLookup: async () => { curriculumCalls += 1; return authoritative(); },
    pipelineRunner: async () => { pipelineCalls += 1; return { status: 'READY_FOR_TEACHER' }; },
    orchestrator: async () => { orchestratorCalls += 1; throw Error('should not run'); },
  });
  const result = await route({ body: body(), authorization: 'Bearer user' });
  assert.equal(result.http_status, 422);
  assert.equal(result.body.status, 'NEEDS_TEACHER_INPUT');
  assert.equal(result.body.renderable, false);
  assert.equal(result.body.plan, null);
  assert.equal(curriculumCalls, 0);
  assert.equal(pipelineCalls, 0);
  assert.equal(orchestratorCalls, 0);
});

test('READY_FOR_TEACHER exposes only the canonical plan returned by the unified lifecycle', async () => {
  const requestBody = body();
  requestBody.teacher_constraints = teacherConstraints();
  let pipelineCalls = 0;
  const canonicalPlan = Object.freeze({
    grades: [1, 3],
    project: { title: 'Museo de acuerdos' },
    selected_pdas: [{ pda_id: 'p1', grade: 1 }, { pda_id: 'p3', grade: 3 }],
  });
  const route = createUnifiedPreviewRoute({
    curriculumLookup: async () => authoritative(),
    pipelineRunner: async (sources, { authorization }) => {
      pipelineCalls += 1;
      assert.deepEqual(Object.keys(sources).sort(), ['constraints', 'curriculum', 'methodology']);
      assert.ok(Object.isFrozen(sources));
      assert.equal(authorization, 'Bearer user');
      return { status: 'READY_FOR_TEACHER' };
    },
    orchestrator: async ({ sources, pipelineRunner, run_id }) => {
      const pipeline = await pipelineRunner({ sources });
      assert.equal(pipeline.status, 'READY_FOR_TEACHER');
      assert.equal(run_id, 'run-1');
      return {
        status: 'CANONICAL_LIFECYCLE_READY',
        pipeline_status: 'READY_FOR_TEACHER',
        canonical_lifecycle: {
          status: 'CANONICAL_LIFECYCLE_READY',
          canonical_plan_hash: 'a'.repeat(64),
          approved_blueprint_hash: 'b'.repeat(64),
          approved_graph_hash: 'c'.repeat(64),
          teacher_projection_hash: 'd'.repeat(64),
          plan: canonicalPlan,
        },
      };
    },
  });
  const result = await route({ body: requestBody, authorization: 'Bearer user', run_id: 'run-1' });
  assert.equal(result.http_status, 200);
  assert.equal(result.body.route_version, UNIFIED_PREVIEW_ROUTE_VERSION);
  assert.equal(result.body.status, 'READY_FOR_TEACHER');
  assert.equal(result.body.renderable, true);
  assert.equal(result.body.canonical_plan_hash, 'a'.repeat(64));
  assert.strictEqual(result.body.plan, canonicalPlan);
  assert.equal(pipelineCalls, 1);
});

test('pipeline rejection is preserved and never exposes a canonical plan', async () => {
  const requestBody = body();
  requestBody.teacher_constraints = teacherConstraints();
  const route = createUnifiedPreviewRoute({
    curriculumLookup: async () => authoritative(),
    pipelineRunner: async () => ({ status: 'SESSION_GRAPH_REJECTED' }),
    orchestrator: async ({ sources, pipelineRunner }) => {
      const pipeline = await pipelineRunner({ sources });
      return {
        status: 'PIPELINE_NOT_READY',
        pipeline_status: pipeline.status,
        canonical_lifecycle: null,
        pipeline_result: pipeline,
      };
    },
  });
  const result = await route({ body: requestBody, authorization: 'Bearer user' });
  assert.equal(result.http_status, 422);
  assert.equal(result.body.status, 'SESSION_GRAPH_REJECTED');
  assert.equal(result.body.renderable, false);
  assert.equal(result.body.canonical_plan_hash, null);
  assert.equal(result.body.plan, null);
});

test('invalid canonical lifecycle fails closed', async () => {
  const requestBody = body();
  requestBody.teacher_constraints = teacherConstraints();
  const route = createUnifiedPreviewRoute({
    curriculumLookup: async () => authoritative(),
    pipelineRunner: async () => ({ status: 'READY_FOR_TEACHER' }),
    orchestrator: async () => ({
      status: 'CANONICAL_LIFECYCLE_READY',
      pipeline_status: 'READY_FOR_TEACHER',
      canonical_lifecycle: { status: 'CANONICAL_LIFECYCLE_READY', plan: null },
    }),
  });
  const result = await route({ body: requestBody, authorization: 'Bearer user' });
  assert.equal(result.http_status, 503);
  assert.equal(result.body.status, 'SHADOW_ERROR');
  assert.equal(result.body.renderable, false);
  assert.equal(result.body.plan, null);
});
