import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPlanHash } from '../lib/v0125/blueprint-canonical-adapter.mjs';
import {
  assertCanonicalPlanBinding,
  reviewCanonicalPlan,
  exportCanonicalPlanDocx,
} from '../lib/v0125/canonical-plan-services.mjs';

function plan() {
  return {
    run_id: '11111111-1111-4111-8111-111111111111',
    base_run_id: null,
    grades: [1, 3],
    context: 'Escuela multigrado rural.',
    problem: 'Mejorar acuerdos de convivencia.',
    selected_pdas: [
      { grade: 1, pda_id: 'p1', pda_official: 'PDA oficial 1' },
      { grade: 3, pda_id: 'p3', pda_official: 'PDA oficial 3' },
    ],
    methodology_engine: {
      methodology_primary: { id: 'proyectos_comunitarios' },
      integrated_project: {
        title: 'Proyecto común',
        display_title: 'Proyecto común',
        collective_product_or_service: 'Acuerdos comunitarios',
        unifying_mission: 'Construir acuerdos.',
        grade_contributions: [
          { grade: 1, contribution: 'Dibuja acuerdos.' },
          { grade: 3, contribution: 'Redacta acuerdos.' },
        ],
      },
    },
    project: {
      title: 'Proyecto común',
      final_product: 'Acuerdos comunitarios',
      mission: 'Construir acuerdos.',
      grade_contributions: [
        { grade: 1, contribution: 'Dibuja acuerdos.' },
        { grade: 3, contribution: 'Redacta acuerdos.' },
      ],
    },
    project_sequence: [
      { session_number: 1, phase: 'Planeación', purpose: 'Reconocer necesidades.', project_advance: 'Acuerdos iniciales', partial_product: 'Lista', prepares_next: 'Organizar propuestas' },
    ],
    sessions: [
      { session_number: 1, total_minutes: 90, purpose: 'Reconocer necesidades.', project_stage: 'Planeación' },
    ],
    teacher_presentation: {
      project_title: 'Proyecto común',
      project_final_product: 'Acuerdos comunitarios',
      sessions: [
        {
          session_number: 1,
          phase: 'Planeación',
          purpose: 'Reconocer necesidades.',
          project_advance: 'Acuerdos iniciales',
          partial_product: 'Lista',
          prepares_next: 'Organizar propuestas',
          teacher_narrative: 'Presento la situación al grupo.',
          closure_narrative: 'Cierro recuperando los acuerdos.',
          activity_blocks: [
            { label: 'Trabajo común', grades: [1, 3], narrative: 'Dialogan y registran acuerdos.' },
          ],
        },
      ],
    },
    resources: ['cuadernos'],
  };
}

function response({ status = 200, jsonBody = null, textBody = null, headers = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: name => headers[String(name).toLowerCase()] ?? null },
    json: async () => jsonBody,
    text: async () => textBody ?? JSON.stringify(jsonBody ?? {}),
  };
}

test('canonical binding accepts exact plan hash and rejects divergent plan', () => {
  const p = plan();
  const hash = canonicalPlanHash(p);
  assert.equal(assertCanonicalPlanBinding({ plan: p, canonical_plan_hash: hash }), hash);

  const changed = structuredClone(p);
  changed.project.title = 'Proyecto alterado';
  assert.throws(
    () => assertCanonicalPlanBinding({ plan: changed, canonical_plan_hash: hash }),
    /CANONICAL_PLAN_HASH_MISMATCH/,
  );
});

test('review rejects canonical divergence before any network request', async () => {
  const p = plan();
  const hash = canonicalPlanHash(p);
  const changed = structuredClone(p);
  changed.problem = 'Problema alterado';
  let calls = 0;

  const result = await reviewCanonicalPlan({
    authorization: 'Bearer user-token',
    payload: { plan: changed, canonical_plan_hash: hash },
    fetchImpl: async () => { calls++; throw Error('must not call'); },
  });

  assert.equal(result.http_status, 409);
  assert.equal(result.body.code, 'CANONICAL_PLAN_HASH_MISMATCH');
  assert.equal(calls, 0);
});

test('review cache hit stays bound to the canonical hash', async () => {
  const p = plan();
  const hash = canonicalPlanHash(p);
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return response({
      status: 200,
      jsonBody: {
        hit: true,
        result: { status: 'PASS', score: 94 },
        review_version: 'TEST-REVIEW-V1',
        snapshot_hash: hash,
      },
    });
  };

  const result = await reviewCanonicalPlan({
    authorization: 'Bearer user-token',
    payload: { plan: p, canonical_plan_hash: hash },
    fetchImpl,
  });

  assert.equal(result.http_status, 200);
  assert.deepEqual(result.body, { status: 'PASS', score: 94 });
  assert.equal(result.headers['x-multiplan-review-cache'], 'HIT');
  assert.equal(result.headers['x-multiplan-canonical-plan-hash'], hash);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /pedagogical-review-cache-v1/);
});

test('review miss executes review once and stores result against the same plan', async () => {
  const p = plan();
  const hash = canonicalPlanHash(p);
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (calls.length === 1) return response({ status: 200, jsonBody: { hit: false } });
    if (calls.length === 2) return response({
      status: 200,
      jsonBody: { status: 'PASS', score: 91 },
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-multiplan-pedagogical-review': 'V1' },
    });
    return response({
      status: 200,
      jsonBody: { ok: true, review_version: 'TEST-REVIEW-V1', snapshot_hash: hash },
    });
  };

  const result = await reviewCanonicalPlan({
    authorization: 'Bearer user-token',
    payload: { plan: p, canonical_plan_hash: hash },
    fetchImpl,
  });

  assert.equal(result.http_status, 200);
  assert.deepEqual(result.body, { status: 'PASS', score: 91 });
  assert.equal(result.headers['x-multiplan-review-cache'], 'MISS_STORED');
  assert.equal(result.headers['x-multiplan-canonical-plan-hash'], hash);
  assert.equal(calls.length, 3);
  assert.match(calls[1].url, /plan-review-pedagogical-context-v1/);
  const reviewBody = JSON.parse(calls[1].opts.body);
  assert.deepEqual(reviewBody.plan, p);
  const storeBody = JSON.parse(calls[2].opts.body);
  assert.deepEqual(storeBody.plan, p);
  assert.deepEqual(storeBody.result, { status: 'PASS', score: 91 });
});

test('docx export uses only a correctly hash-bound canonical plan', async () => {
  const p = plan();
  const hash = canonicalPlanHash(p);
  const ok = await exportCanonicalPlanDocx({ plan: p, canonical_plan_hash: hash });
  assert.equal(ok.http_status, 200);
  assert.equal(ok.canonical_plan_hash, hash);
  assert.ok(Buffer.isBuffer(ok.buffer));
  assert.ok(ok.buffer.length > 5000);
  assert.equal(ok.buffer.subarray(0, 2).toString('ascii'), 'PK');
  assert.match(ok.filename, /\.docx$/);

  const changed = structuredClone(p);
  changed.project.final_product = 'Producto alterado';
  const bad = await exportCanonicalPlanDocx({ plan: changed, canonical_plan_hash: hash });
  assert.equal(bad.http_status, 409);
  assert.equal(bad.body.code, 'CANONICAL_PLAN_HASH_MISMATCH');
});
