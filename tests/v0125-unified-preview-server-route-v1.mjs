import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { canonicalPlanHash } from '../lib/v0125/blueprint-canonical-adapter.mjs';
import { createUnifiedPreviewServerRoute, UNIFIED_PREVIEW_SERVER_ROUTE_VERSION } from '../lib/v0125/unified-preview-server-route.mjs';

function request(body = {}, { method = 'POST', auth = 'Bearer user-token', raw = null } = {}) {
  const req = Readable.from([raw === null ? JSON.stringify(body) : raw]);
  req.method = method;
  req.headers = { authorization: auth };
  return req;
}

function capture() {
  let status = 0, headers = {}, body = '';
  return {
    res: {
      writeHead: (value, nextHeaders) => { status = value; headers = nextHeaders || {}; },
      end: value => { body = String(value || ''); },
    },
    get: () => ({ status, headers, body: body ? JSON.parse(body) : null }),
  };
}

function helpers() {
  return {
    readBody: req => new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', chunk => raw += chunk);
      req.on('end', () => resolve(raw));
      req.on('error', reject);
    }),
    bearer: req => String(req.headers.authorization || ''),
    json: (res, status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    },
  };
}

test('disabled v0125 route fails closed before constructing external dependencies', async () => {
  let runtimeCalls = 0, curriculumCalls = 0, routeCalls = 0, snapshotCalls = 0;
  const h = helpers();
  const handler = createUnifiedPreviewServerRoute({
    env: { MULTIPLAN_V0125_UNIFIED_PREVIEW_ENABLED: '0' },
    ...h,
    runtimeFactory: () => { runtimeCalls++; return async () => ({}); },
    curriculumLookupFactory: () => { curriculumCalls++; return async () => ({}); },
    routeFactory: () => { routeCalls++; return async () => ({}); },
    snapshotPersister: async () => { snapshotCalls++; return { status: 'PERSISTED' }; },
  });
  const out = capture();
  await handler(request(), out.res);
  const response = out.get();
  assert.equal(response.status, 404);
  assert.equal(response.body.code, 'UNIFIED_PREVIEW_ROUTE_DISABLED');
  assert.equal(response.body.server_route_version, UNIFIED_PREVIEW_SERVER_ROUTE_VERSION);
  assert.equal(runtimeCalls, 0);
  assert.equal(curriculumCalls, 0);
  assert.equal(routeCalls, 0);
  assert.equal(snapshotCalls, 0);
});

test('missing bearer authorization fails before constructing runtime or curriculum lookup', async () => {
  let runtimeCalls = 0, curriculumCalls = 0, snapshotCalls = 0;
  const h = helpers();
  const handler = createUnifiedPreviewServerRoute({
    env: { MULTIPLAN_V0125_UNIFIED_PREVIEW_ENABLED: '1' },
    ...h,
    runtimeFactory: () => { runtimeCalls++; return async () => ({}); },
    curriculumLookupFactory: () => { curriculumCalls++; return async () => ({}); },
    snapshotPersister: async () => { snapshotCalls++; return { status: 'PERSISTED' }; },
  });
  const out = capture();
  await handler(request({}, { auth: '' }), out.res);
  assert.equal(out.get().status, 401);
  assert.equal(out.get().body.code, 'USER_AUTHORIZATION_REQUIRED');
  assert.equal(runtimeCalls, 0);
  assert.equal(curriculumCalls, 0);
  assert.equal(snapshotCalls, 0);
});

test('authenticated enabled route exposes canonical plan only after canonical snapshot binding', async () => {
  let seenAuthorization = null, seenRunId = null, seenBaseRunId = null, snapshotCalls = 0;
  let seenSnapshotPlan = null, seenSnapshotHash = null;
  const h = helpers();
  const plan = { run_id: 'r1', project: { title: 'Proyecto' } };
  const planHash = canonicalPlanHash(plan);
  const handler = createUnifiedPreviewServerRoute({
    env: {
      MULTIPLAN_V0125_UNIFIED_PREVIEW_ENABLED: '1',
      MULTIPLAN_CERTIFIED_R2_ENDPOINT: 'https://example.com/plan-project-blueprint-v1-shadow',
      MULTIPLAN_CERTIFIED_R2_TOKEN: 'x'.repeat(40),
      MULTIPLAN_CERTIFIED_R2_IDENTITY: 'test',
      SUPABASE_PUBLISHABLE_KEY: 'pk',
    },
    ...h,
    runtimeFactory: () => async () => ({ status: 'READY_FOR_TEACHER' }),
    curriculumLookupFactory: ({ authorization }) => {
      seenAuthorization = authorization;
      return async () => ({});
    },
    routeFactory: () => async ({ authorization, run_id, base_run_id }) => {
      seenAuthorization = authorization;
      seenRunId = run_id;
      seenBaseRunId = base_run_id;
      return {
        http_status: 200,
        body: {
          route_version: 'UNIFIED_PREVIEW_ROUTE_V1',
          status: 'READY_FOR_TEACHER',
          renderable: true,
          canonical_plan_hash: planHash,
          approved_blueprint_hash: 'b'.repeat(64),
          approved_graph_hash: 'c'.repeat(64),
          teacher_projection_hash: 'd'.repeat(64),
          plan,
        },
      };
    },
    snapshotPersister: async ({ authorization, plan: snapshotPlan, canonical_plan_hash }) => {
      snapshotCalls++;
      assert.equal(authorization, 'Bearer user-token');
      seenSnapshotPlan = snapshotPlan;
      seenSnapshotHash = canonical_plan_hash;
      return { status: 'PERSISTED', hash: 'remote-hash', canonical_plan_hash, snapshot_version: 'FINAL-PLAN-SNAPSHOT-V1' };
    },
  });
  const out = capture();
  await handler(request({ run_id: 'r1', base_run_id: 'b1' }), out.res);
  const response = out.get();
  assert.equal(response.status, 200);
  assert.equal(response.body.server_route_version, UNIFIED_PREVIEW_SERVER_ROUTE_VERSION);
  assert.equal(response.body.status, 'READY_FOR_TEACHER');
  assert.equal(response.body.renderable, true);
  assert.equal(response.body.canonical_plan_hash, planHash);
  assert.deepEqual(response.body.plan, plan);
  assert.equal(response.body.snapshot_persistence.status, 'PERSISTED');
  assert.equal(response.body.snapshot_persistence.canonical_plan_hash, planHash);
  assert.equal(seenAuthorization, 'Bearer user-token');
  assert.equal(seenRunId, 'r1');
  assert.equal(seenBaseRunId, 'b1');
  assert.equal(snapshotCalls, 1);
  assert.equal(seenSnapshotPlan, plan);
  assert.equal(seenSnapshotHash, planHash);
});

test('snapshot network failure does not mutate or hide a valid canonical plan', async () => {
  const h = helpers();
  const plan = { run_id: 'r2', project: { title: 'Proyecto estable' } };
  const planHash = canonicalPlanHash(plan);
  const handler = createUnifiedPreviewServerRoute({
    env: { MULTIPLAN_V0125_UNIFIED_PREVIEW_ENABLED: '1' },
    ...h,
    runtimeFactory: () => async () => ({}),
    curriculumLookupFactory: () => async () => ({}),
    routeFactory: () => async () => ({
      http_status: 200,
      body: {
        status: 'READY_FOR_TEACHER',
        renderable: true,
        canonical_plan_hash: planHash,
        plan,
      },
    }),
    snapshotPersister: async () => ({ status: 'FAILED', reason: 'SNAPSHOT_PERSIST_EXCEPTION', canonical_plan_hash: planHash }),
  });
  const out = capture();
  await handler(request({ run_id: 'r2' }), out.res);
  const response = out.get();
  assert.equal(response.status, 200);
  assert.equal(response.body.canonical_plan_hash, planHash);
  assert.deepEqual(response.body.plan, plan);
  assert.equal(response.body.snapshot_persistence.status, 'FAILED');
});

test('canonical snapshot rejection fails closed and exposes no plan', async () => {
  const h = helpers();
  const plan = { run_id: 'r3', project: { title: 'No debe escapar' } };
  const handler = createUnifiedPreviewServerRoute({
    env: { MULTIPLAN_V0125_UNIFIED_PREVIEW_ENABLED: '1' },
    ...h,
    runtimeFactory: () => async () => ({}),
    curriculumLookupFactory: () => async () => ({}),
    routeFactory: () => async () => ({
      http_status: 200,
      body: {
        status: 'READY_FOR_TEACHER',
        renderable: true,
        canonical_plan_hash: '0'.repeat(64),
        plan,
      },
    }),
    snapshotPersister: async () => ({ status: 'REJECTED', reason: 'CANONICAL_PLAN_HASH_MISMATCH' }),
  });
  const out = capture();
  await handler(request({ run_id: 'r3' }), out.res);
  const response = out.get();
  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'UNIFIED_PREVIEW_CANONICAL_SNAPSHOT_REJECTED');
  assert.equal(response.body.plan, null);
  assert.equal(response.body.canonical_plan_hash, null);
});

test('HTTP boundary fails closed if a non-200 route tries to expose a plan', async () => {
  const h = helpers();
  const handler = createUnifiedPreviewServerRoute({
    env: {
      MULTIPLAN_V0125_UNIFIED_PREVIEW_ENABLED: '1',
      MULTIPLAN_CERTIFIED_R2_ENDPOINT: 'https://example.com/plan-project-blueprint-v1-shadow',
      MULTIPLAN_CERTIFIED_R2_TOKEN: 'x'.repeat(40),
      MULTIPLAN_CERTIFIED_R2_IDENTITY: 'test',
      SUPABASE_PUBLISHABLE_KEY: 'pk',
    },
    ...h,
    runtimeFactory: () => async () => ({}),
    curriculumLookupFactory: () => async () => ({}),
    routeFactory: () => async () => ({
      http_status: 422,
      body: {
        status: 'SESSION_GRAPH_REJECTED',
        renderable: false,
        canonical_plan_hash: 'a'.repeat(64),
        plan: { should_not_escape: true },
      },
    }),
  });
  const out = capture();
  await handler(request({}), out.res);
  const response = out.get();
  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'UNIFIED_PREVIEW_ROUTE_UNAVAILABLE');
  assert.equal(response.body.plan, null);
  assert.equal(response.body.canonical_plan_hash, null);
});
