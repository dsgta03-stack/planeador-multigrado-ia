import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPlanHash } from '../lib/v0125/blueprint-canonical-adapter.mjs';
import {
  CANONICAL_HISTORY_VERSION,
  persistCanonicalSnapshot,
  canonicalizeHistoryDetail,
  enrichCanonicalHistoryList,
} from '../lib/v0125/canonical-history.mjs';

const runId = '11111111-1111-4111-8111-111111111111';
const plan = {
  run_id: runId,
  base_run_id: '22222222-2222-4222-8222-222222222222',
  teacher_presentation: { project_title: 'Proyecto canónico' },
  sessions: [{ session_number: 1 }],
  products: [{ grade: 3 }],
};
const hash = canonicalPlanHash(plan);

test('canonical snapshot persistence validates plan hash before persisting exact plan', async () => {
  let calls = 0;
  let seenAuthorization = null;
  let seenPlan = null;
  const result = await persistCanonicalSnapshot({
    authorization: 'Bearer user-token',
    plan,
    canonical_plan_hash: hash,
    persistImpl: async (authorization, value) => {
      calls++;
      seenAuthorization = authorization;
      seenPlan = value;
      return { status: 'PERSISTED', hash: 'remote-hash', version: 'FINAL-PLAN-SNAPSHOT-V1' };
    },
  });

  assert.equal(calls, 1);
  assert.equal(seenAuthorization, 'Bearer user-token');
  assert.equal(seenPlan, plan);
  assert.equal(result.status, 'PERSISTED');
  assert.equal(result.hash, 'remote-hash');
  assert.equal(result.canonical_plan_hash, hash);
  assert.equal(CANONICAL_HISTORY_VERSION, 'CANONICAL_HISTORY_V1');
});

test('canonical snapshot persistence rejects a divergent plan before persistence', async () => {
  let calls = 0;
  const result = await persistCanonicalSnapshot({
    authorization: 'Bearer user-token',
    plan: { ...plan, teacher_presentation: { project_title: 'Alterado' } },
    canonical_plan_hash: hash,
    persistImpl: async () => { calls++; return { status: 'PERSISTED' }; },
  });

  assert.equal(calls, 0);
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.reason, 'CANONICAL_PLAN_HASH_MISMATCH');
  assert.equal(result.canonical_plan_hash, null);
});

test('canonical snapshot persistence requires bearer before any persistence', async () => {
  let calls = 0;
  const result = await persistCanonicalSnapshot({
    authorization: '',
    plan,
    canonical_plan_hash: hash,
    persistImpl: async () => { calls++; return { status: 'PERSISTED' }; },
  });
  assert.equal(calls, 0);
  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.reason, 'AUTH_REQUIRED');
});

test('history detail promotes final snapshot and recomputes its canonical hash', () => {
  const row = {
    run_id: runId,
    model_output_json: { internal: true },
    validator_json: {
      final_output_snapshot: plan,
      final_output_snapshot_meta: { schema_version: 'FINAL-PLAN-SNAPSHOT-V1' },
    },
  };
  const detail = canonicalizeHistoryDetail(row);
  assert.equal(detail.snapshot_source, 'FINAL_OUTPUT_SNAPSHOT');
  assert.equal(detail.canonical_history_status, 'CANONICAL_SNAPSHOT');
  assert.equal(detail.canonical_plan_hash, hash);
  assert.deepEqual(detail.model_output_json, plan);
  assert.deepEqual(row.model_output_json, { internal: true });
});

test('history detail fails closed when explicit canonical metadata disagrees', () => {
  const row = {
    run_id: runId,
    validator_json: {
      final_output_snapshot: plan,
      final_output_snapshot_meta: {
        schema_version: 'FINAL-PLAN-SNAPSHOT-V1',
        canonical_plan_hash: '0'.repeat(64),
      },
    },
  };
  assert.throws(() => canonicalizeHistoryDetail(row), /HISTORY_SNAPSHOT_MISMATCH/);
});

test('history list marks snapshot-backed and legacy rows without inventing a hash', async () => {
  const items = await enrichCanonicalHistoryList(
    [{ run_id: runId }, { run_id: 'legacy' }],
    'Bearer user-token',
    {
      enrichImpl: async rows => [
        { ...rows[0], snapshot_source: 'FINAL_OUTPUT_SNAPSHOT' },
        { ...rows[1], snapshot_source: 'MODEL_OUTPUT_JSON' },
      ],
    },
  );
  assert.equal(items[0].canonical_history_status, 'SNAPSHOT_AVAILABLE');
  assert.equal(items[1].canonical_history_status, 'LEGACY_UNBOUND');
  assert.equal(items[0].canonical_plan_hash, undefined);
});
