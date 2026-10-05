import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanonicalReviewServerRoute,
  createCanonicalDocxServerRoute,
  CANONICAL_PLAN_SERVER_ROUTES_VERSION,
} from '../lib/v0125/canonical-plan-server-routes.mjs';

function response() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; },
  };
}

function json(res, status, body, extra = {}) {
  res.status = status;
  res.headers = { 'content-type': 'application/json; charset=utf-8', ...extra };
  res.body = body;
}

const readBody = async req => req.raw || '';
const bearer = req => String(req.headers?.authorization || '').startsWith('Bearer ') ? req.headers.authorization : '';

test('canonical review route requires bearer before invoking review service', async () => {
  let calls = 0;
  const route = createCanonicalReviewServerRoute({
    readBody,
    bearer,
    json,
    reviewService: async () => { calls++; return { http_status: 200, body: { ok: true }, headers: {} }; },
  });
  const res = response();
  await route({ method: 'POST', headers: {}, raw: '{}' }, res);
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { code: 'AUTH_REQUIRED' });
  assert.equal(calls, 0);
});

test('canonical review route forwards validated request to service and preserves canonical headers', async () => {
  let seen = null;
  const route = createCanonicalReviewServerRoute({
    readBody,
    bearer,
    json,
    reviewService: async input => {
      seen = input;
      return {
        http_status: 200,
        body: { verdict: 'OK' },
        headers: {
          'x-multiplan-review-cache': 'HIT',
          'x-multiplan-canonical-plan-hash': 'a'.repeat(64),
        },
      };
    },
    fetchImpl: async () => { throw Error('not used'); },
  });
  const payload = { plan: { run_id: 'r1' }, canonical_plan_hash: 'a'.repeat(64) };
  const res = response();
  await route({ method: 'POST', headers: { authorization: 'Bearer user-token' }, raw: JSON.stringify(payload) }, res);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { verdict: 'OK' });
  assert.equal(res.headers['x-multiplan-review-cache'], 'HIT');
  assert.equal(res.headers['x-multiplan-canonical-plan-hash'], 'a'.repeat(64));
  assert.equal(seen.authorization, 'Bearer user-token');
  assert.deepEqual(seen.payload, payload);
});

test('canonical DOCX route emits file only for successful bound export', async () => {
  const buffer = Buffer.from('PK\u0003\u0004canonical-docx');
  const hash = 'b'.repeat(64);
  let seen = null;
  const route = createCanonicalDocxServerRoute({
    readBody,
    json,
    exportService: async input => {
      seen = input;
      return { http_status: 200, canonical_plan_hash: hash, filename: 'Planeación prueba.docx', buffer };
    },
  });
  const plan = { run_id: 'r2' };
  const res = response();
  await route({ method: 'POST', raw: JSON.stringify({ plan, canonical_plan_hash: hash }) }, res);
  assert.equal(res.status, 200);
  assert.ok(Buffer.isBuffer(res.body));
  assert.deepEqual(res.body, buffer);
  assert.equal(res.headers['x-multiplan-export'], 'V0125-CANONICAL-DOCX-V1');
  assert.equal(res.headers['x-multiplan-canonical-plan-hash'], hash);
  assert.match(res.headers['content-disposition'], /\.docx/);
  assert.deepEqual(seen, { plan, canonical_plan_hash: hash });
});

test('canonical DOCX route preserves binding rejection and emits no file', async () => {
  const route = createCanonicalDocxServerRoute({
    readBody,
    json,
    exportService: async () => ({ http_status: 409, body: { code: 'CANONICAL_PLAN_HASH_MISMATCH' } }),
  });
  const res = response();
  await route({ method: 'POST', raw: JSON.stringify({ plan: { changed: true }, canonical_plan_hash: 'c'.repeat(64) }) }, res);
  assert.equal(res.status, 409);
  assert.deepEqual(res.body, { code: 'CANONICAL_PLAN_HASH_MISMATCH' });
  assert.equal(Buffer.isBuffer(res.body), false);
});

test('canonical service routes reject unsupported methods', async () => {
  const review = createCanonicalReviewServerRoute({ readBody, bearer, json, reviewService: async () => ({}) });
  const docx = createCanonicalDocxServerRoute({ readBody, json, exportService: async () => ({}) });
  const reviewRes = response();
  const docxRes = response();
  await review({ method: 'GET', headers: {} }, reviewRes);
  await docx({ method: 'GET' }, docxRes);
  assert.equal(reviewRes.status, 405);
  assert.equal(docxRes.status, 405);
  assert.equal(CANONICAL_PLAN_SERVER_ROUTES_VERSION, 'CANONICAL_PLAN_SERVER_ROUTES_V1');
});
