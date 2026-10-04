import { reviewCanonicalPlan, exportCanonicalPlanDocx } from './canonical-plan-services.mjs';

export const CANONICAL_PLAN_SERVER_ROUTES_VERSION = 'CANONICAL_PLAN_SERVER_ROUTES_V1';

const jsonError = (json, res, status, code) => json(res, status, { code });

function validHttpStatus(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599;
}

function asciiFilename(filename) {
  return String(filename || 'Planeacion_Multiplan.docx').replace(/[^\x20-\x7E]/g, '_');
}

export function createCanonicalReviewServerRoute({
  readBody,
  bearer,
  json,
  reviewService = reviewCanonicalPlan,
  fetchImpl = fetch,
} = {}) {
  if (typeof readBody !== 'function' || typeof bearer !== 'function' || typeof json !== 'function') {
    throw Error('CANONICAL_REVIEW_HTTP_HELPERS_REQUIRED');
  }
  if (typeof reviewService !== 'function') throw Error('CANONICAL_REVIEW_SERVICE_REQUIRED');

  return async function handleCanonicalReview(req, res) {
    if (req.method !== 'POST') return jsonError(json, res, 405, 'METHOD_NOT_ALLOWED');

    const authorization = bearer(req);
    if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) {
      return jsonError(json, res, 401, 'AUTH_REQUIRED');
    }

    let payload;
    try {
      payload = JSON.parse((await readBody(req)) || '{}');
    } catch (error) {
      const tooLarge = String(error?.message || error).includes('PAYLOAD_TOO_LARGE');
      return jsonError(json, res, tooLarge ? 413 : 400, tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON');
    }

    const result = await reviewService({ authorization, payload, fetchImpl });
    if (!validHttpStatus(result?.http_status)) return jsonError(json, res, 503, 'CANONICAL_REVIEW_RESPONSE_INVALID');

    const headers = { 'cache-control': 'no-store', ...(result.headers || {}) };
    if (result.body && typeof result.body === 'object') return json(res, result.http_status, result.body, headers);

    const text = typeof result.raw_text === 'string' ? result.raw_text : String(result.body ?? '');
    res.writeHead(result.http_status, {
      'content-type': headers['content-type'] || 'text/plain; charset=utf-8',
      ...headers,
    });
    res.end(text);
  };
}

export function createCanonicalDocxServerRoute({
  readBody,
  json,
  exportService = exportCanonicalPlanDocx,
} = {}) {
  if (typeof readBody !== 'function' || typeof json !== 'function') throw Error('CANONICAL_DOCX_HTTP_HELPERS_REQUIRED');
  if (typeof exportService !== 'function') throw Error('CANONICAL_DOCX_SERVICE_REQUIRED');

  return async function handleCanonicalDocx(req, res) {
    if (req.method !== 'POST') return jsonError(json, res, 405, 'METHOD_NOT_ALLOWED');

    let payload;
    try {
      payload = JSON.parse((await readBody(req)) || '{}');
    } catch (error) {
      const tooLarge = String(error?.message || error).includes('PAYLOAD_TOO_LARGE');
      return jsonError(json, res, tooLarge ? 413 : 400, tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON');
    }

    const result = await exportService({
      plan: payload?.plan,
      canonical_plan_hash: payload?.canonical_plan_hash,
    });
    if (!validHttpStatus(result?.http_status)) return jsonError(json, res, 503, 'CANONICAL_DOCX_RESPONSE_INVALID');
    if (result.http_status !== 200) return json(res, result.http_status, result.body || { code: 'CANONICAL_DOCX_EXPORT_FAILED' });
    if (!Buffer.isBuffer(result.buffer) || !result.buffer.length) return jsonError(json, res, 503, 'CANONICAL_DOCX_BUFFER_INVALID');

    const filename = result.filename || 'Planeacion_Multiplan.docx';
    const ascii = asciiFilename(filename);
    res.writeHead(200, {
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'content-length': String(result.buffer.length),
      'cache-control': 'no-store',
      'x-multiplan-export': 'V0125-CANONICAL-DOCX-V1',
      'x-multiplan-canonical-plan-hash': result.canonical_plan_hash,
    });
    res.end(result.buffer);
  };
}
