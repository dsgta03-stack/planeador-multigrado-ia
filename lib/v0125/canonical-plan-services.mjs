import { REVIEW_VERSION } from '../v0124/review-cache.mjs';
import { createMultiplanDocx, docxFilename } from '../v0124/docx-export.mjs';
import { canonicalPlanHash } from './blueprint-canonical-adapter.mjs';

export const CANONICAL_PLAN_SERVICES_VERSION = 'CANONICAL_PLAN_SERVICES_V1';

const SUPABASE_URL = 'https://dvcrwzxznuqongutnifn.supabase.co';
const REVIEW_URL = `${SUPABASE_URL}/functions/v1/plan-review-pedagogical-context-v1`;
const CACHE_URL = `${SUPABASE_URL}/functions/v1/pedagogical-review-cache-v1`;

const planObject = value => value && typeof value === 'object' && !Array.isArray(value);
const validHash = value => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);

export function assertCanonicalPlanBinding({ plan, canonical_plan_hash } = {}) {
  if (!planObject(plan)) throw Error('CANONICAL_PLAN_REQUIRED');
  if (!validHash(canonical_plan_hash)) throw Error('CANONICAL_PLAN_HASH_REQUIRED');
  const actual = canonicalPlanHash(plan);
  if (actual !== canonical_plan_hash) throw Error('CANONICAL_PLAN_HASH_MISMATCH');
  return actual;
}

async function cacheRequest({ action, authorization, plan, result, fetchImpl }) {
  if (!authorization || !planObject(plan)) return { status: 0, body: { hit: false } };
  try {
    const response = await fetchImpl(CACHE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({
        action,
        run_id: plan?.run_id,
        plan,
        ...(action === 'put' ? { result } : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } catch {
    return { status: 0, body: { hit: false } };
  }
}

function bindingFailure(error) {
  const code = String(error?.message || error);
  if (code === 'CANONICAL_PLAN_HASH_MISMATCH') {
    return { http_status: 409, body: { code, message: 'El plan no coincide con su hash canónico.' }, headers: {} };
  }
  return { http_status: 400, body: { code }, headers: {} };
}

export async function reviewCanonicalPlan({ authorization, payload, fetchImpl = fetch } = {}) {
  if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) {
    return { http_status: 401, body: { code: 'AUTH_REQUIRED' }, headers: {} };
  }
  if (typeof fetchImpl !== 'function') throw Error('CANONICAL_REVIEW_FETCH_REQUIRED');

  const plan = payload?.plan;
  const expectedHash = payload?.canonical_plan_hash;
  try {
    assertCanonicalPlanBinding({ plan, canonical_plan_hash: expectedHash });
  } catch (error) {
    return bindingFailure(error);
  }

  if (plan?.run_id) {
    const cached = await cacheRequest({ action: 'get', authorization, plan, fetchImpl });
    if (cached.status === 200 && cached.body?.hit && cached.body?.result) {
      return {
        http_status: 200,
        body: cached.body.result,
        headers: {
          'x-multiplan-review-cache': 'HIT',
          'x-multiplan-review-cache-version': cached.body.review_version || REVIEW_VERSION,
          'x-multiplan-review-snapshot-hash': cached.body.snapshot_hash || '',
          'x-multiplan-canonical-plan-hash': expectedHash,
        },
      };
    }
    if (cached.status === 409 && cached.body?.code === 'SNAPSHOT_HASH_MISMATCH') {
      return {
        http_status: 409,
        body: {
          code: 'HISTORY_SNAPSHOT_MISMATCH',
          message: 'La planeación actual no coincide con el snapshot final guardado.',
          plan_hash: cached.body.plan_hash,
          snapshot_hash: cached.body.snapshot_hash,
        },
        headers: { 'x-multiplan-review-cache': 'HASH_MISMATCH' },
      };
    }
  }

  try {
    const response = await fetchImpl(REVIEW_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({ plan }),
      signal: AbortSignal.timeout(140_000),
    });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}

    let cacheStatus = 'MISS_NOT_STORED';
    let cacheVersion = '';
    let snapshotHash = '';
    if (response.ok && plan?.run_id && data && typeof data === 'object') {
      const stored = await cacheRequest({ action: 'put', authorization, plan, result: data, fetchImpl });
      if (stored.status === 200 && stored.body?.ok) {
        cacheStatus = 'MISS_STORED';
        cacheVersion = stored.body.review_version || REVIEW_VERSION;
        snapshotHash = stored.body.snapshot_hash || '';
      } else if (stored.status === 409 && stored.body?.code === 'SNAPSHOT_HASH_MISMATCH') {
        return {
          http_status: 409,
          body: {
            code: 'HISTORY_SNAPSHOT_MISMATCH',
            message: 'La planeación revisada no coincide con el snapshot final.',
            plan_hash: stored.body.plan_hash,
            snapshot_hash: stored.body.snapshot_hash,
          },
          headers: { 'x-multiplan-review-cache': 'HASH_MISMATCH' },
        };
      } else {
        cacheStatus = 'MISS_CACHE_FAILED';
      }
    }

    const headers = {
      'content-type': response.headers?.get?.('content-type') || 'application/json; charset=utf-8',
      'x-multiplan-review-cache': cacheStatus,
      'x-multiplan-review-cache-version': cacheVersion,
      'x-multiplan-review-snapshot-hash': snapshotHash,
      'x-multiplan-canonical-plan-hash': expectedHash,
    };
    for (const name of ['x-multiplan-pedagogical-review', 'x-multiplan-review-mode', 'x-multiplan-review-context', 'x-multiplan-review-postcheck']) {
      const value = response.headers?.get?.(name);
      if (value) headers[name] = value;
    }

    return {
      http_status: response.status,
      body: data ?? text,
      raw_text: text,
      headers,
    };
  } catch (error) {
    return {
      http_status: 502,
      body: { code: 'PEDAGOGICAL_REVIEW_PROXY_ERROR', message: String(error).slice(0, 300) },
      headers: {},
    };
  }
}

export async function exportCanonicalPlanDocx({ plan, canonical_plan_hash } = {}) {
  try {
    const hash = assertCanonicalPlanBinding({ plan, canonical_plan_hash });
    const buffer = await createMultiplanDocx(plan);
    return {
      http_status: 200,
      canonical_plan_hash: hash,
      filename: docxFilename(plan),
      buffer,
    };
  } catch (error) {
    const code = String(error?.message || error);
    return {
      http_status: code === 'CANONICAL_PLAN_HASH_MISMATCH' ? 409 : 400,
      body: { code },
    };
  }
}
