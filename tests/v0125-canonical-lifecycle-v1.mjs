import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { teacherProjectionHash } from '../shadow/pipeline-v1/projection.mjs';
import { SNAPSHOT_VERSION, applyFinalSnapshot } from '../lib/v0124/history-fidelity.mjs';
import { reviewWithCache, REVIEW_VERSION } from '../lib/v0124/review-cache.mjs';
import { createMultiplanDocx } from '../lib/v0124/docx-export.mjs';
import { canonicalPlanHash } from '../lib/v0125/blueprint-canonical-adapter.mjs';
import { canonicalLifecycleFromPipeline, assertCanonicalLifecycle } from '../lib/v0125/canonical-lifecycle.mjs';

function fixture() {
  const sources = {
    constraints: {
      grades: [1, 3],
      selected_pda_ids: ['p1', 'p3'],
      requested_sessions: 1,
      minutes_per_session: 90,
      original_problem: 'El grupo necesita comprender sus acuerdos escolares.',
      original_context: 'Escuela multigrado sin internet.',
      available_resources: ['papel', 'lápices'],
      supports: ['modelado docente'],
      constraints_hash: 'a'.repeat(64),
    },
    curriculum: {
      pdas: [
        { pda_id: 'p1', grade: 1, field: 'De lo Humano y lo Comunitario', pda_official: 'Explica situaciones y propone acuerdos.' },
        { pda_id: 'p3', grade: 3, field: 'De lo Humano y lo Comunitario', pda_official: 'Indaga prácticas y acuerdos de su comunidad.' },
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
        { grade: 3, contribution: 'Registro de indagación', evidence: 'Fichas' },
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
      pda_focus: ['p1', 'p3'],
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
  const pipelineResult = {
    pipeline_version: 'MULTIPLAN_SHADOW_PIPELINE_V1',
    status: 'READY_FOR_TEACHER',
    blueprint_approval: { status: 'APPROVED', approved_blueprint_hash: projectionBody.source.approved_blueprint_hash },
    session_approval: { status: 'APPROVED', approved_graph_hash: projectionBody.source.approved_graph_hash },
    teacher_plan: teacherPlan,
  };
  return { sources, pipelineResult };
}

function request(body, auth = 'Bearer test') {
  const req = Readable.from([JSON.stringify(body)]);
  req.headers = { authorization: auth };
  return req;
}

function responseCapture() {
  let status = 0, headers = {}, body = '';
  return {
    res: {
      writeHead: (s, h) => { status = s; headers = h; },
      end: value => { body = String(value || ''); },
    },
    get: () => ({ status, headers, body }),
  };
}

function helpers() {
  return {
    bearer: req => req.headers.authorization || '',
    readBody: req => new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', chunk => raw += chunk);
      req.on('end', () => resolve(raw));
      req.on('error', reject);
    }),
    json: (res, status, body, extra = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...extra });
      res.end(JSON.stringify(body));
    },
    copyHeaders: (response, names = []) => {
      const out = { 'content-type': response.headers.get('content-type') || 'application/json' };
      for (const name of names) {
        const value = response.headers.get(name);
        if (value) out[name] = value;
      }
      return out;
    },
  };
}

test('canonical lifecycle binds snapshot review and DOCX to one canonical hash', async () => {
  const { sources, pipelineResult } = fixture();
  const lifecycle = canonicalLifecycleFromPipeline({
    sources,
    pipelineResult,
    run_id: '11111111-1111-4111-8111-111111111111',
  });

  assert.equal(assertCanonicalLifecycle(lifecycle), true);
  assert.equal(lifecycle.snapshot.schema_version, SNAPSHOT_VERSION);
  assert.strictEqual(lifecycle.snapshot.plan, lifecycle.plan);
  assert.strictEqual(lifecycle.review.payload.plan, lifecycle.plan);
  assert.strictEqual(lifecycle.export.plan, lifecycle.plan);
  assert.equal(canonicalPlanHash(lifecycle.snapshot.plan), lifecycle.canonical_plan_hash);
  assert.equal(canonicalPlanHash(lifecycle.review.payload.plan), lifecycle.canonical_plan_hash);
  assert.equal(canonicalPlanHash(lifecycle.export.plan), lifecycle.canonical_plan_hash);

  const row = {
    run_id: lifecycle.plan.run_id,
    model_output_json: { stale: true },
    validator_json: {
      final_output_snapshot: structuredClone(lifecycle.snapshot.plan),
      final_output_snapshot_meta: {
        schema_version: SNAPSHOT_VERSION,
        hash_sha256: lifecycle.canonical_plan_hash,
      },
    },
  };
  const reopened = applyFinalSnapshot(row);
  assert.equal(reopened.snapshot_source, 'FINAL_OUTPUT_SNAPSHOT');
  assert.equal(canonicalPlanHash(reopened.model_output_json), lifecycle.canonical_plan_hash);

  const reviewResult = { status: 'PASS', score: 100, findings: [] };
  let cachedResult = null;
  let reviewExecutions = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('pedagogical-review-cache-v1')) {
      const payload = JSON.parse(options.body || '{}');
      assert.equal(canonicalPlanHash(payload.plan), lifecycle.canonical_plan_hash);
      if (payload.action === 'get') {
        return new Response(JSON.stringify(cachedResult
          ? { hit: true, result: cachedResult, review_version: REVIEW_VERSION, snapshot_hash: lifecycle.canonical_plan_hash }
          : { hit: false }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      cachedResult = payload.result;
      return new Response(JSON.stringify({ ok: true, review_version: REVIEW_VERSION, snapshot_hash: lifecycle.canonical_plan_hash }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (target.includes('plan-review-pedagogical-context-v1')) {
      reviewExecutions += 1;
      const payload = JSON.parse(options.body || '{}');
      assert.equal(canonicalPlanHash(payload.plan), lifecycle.canonical_plan_hash);
      return new Response(JSON.stringify(reviewResult), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected URL ${target}`);
  };

  let capture = responseCapture();
  await reviewWithCache(request(lifecycle.review.payload), capture.res, helpers());
  assert.equal(capture.get().status, 200);
  assert.equal(capture.get().headers['x-multiplan-review-cache'], 'MISS_STORED');

  capture = responseCapture();
  await reviewWithCache(request({ plan: reopened.model_output_json }), capture.res, helpers());
  assert.equal(capture.get().status, 200);
  assert.equal(capture.get().headers['x-multiplan-review-cache'], 'HIT');
  assert.equal(reviewExecutions, 1);

  const docx = await createMultiplanDocx(lifecycle.export.plan);
  assert.ok(Buffer.isBuffer(docx));
  assert.ok(docx.length > 5000);
  assert.equal(docx.subarray(0, 2).toString('ascii'), 'PK');
});

test('canonical lifecycle detects divergence before a consumer receives a mutated plan', () => {
  const { sources, pipelineResult } = fixture();
  const lifecycle = canonicalLifecycleFromPipeline({ sources, pipelineResult });
  const altered = structuredClone(lifecycle);
  altered.review.payload = { plan: structuredClone(altered.review.payload.plan) };
  altered.review.payload.plan.project.title = 'Título alterado';
  assert.throws(() => assertCanonicalLifecycle(altered), /CANONICAL_LIFECYCLE_REVIEW_HASH_MISMATCH/);
});
