import http from 'node:http';
import { createUnifiedPreviewServerRoute, UNIFIED_PREVIEW_SERVER_ROUTE_VERSION } from './lib/v0125/unified-preview-server-route.mjs';
import {
  createCanonicalReviewServerRoute,
  createCanonicalDocxServerRoute,
  CANONICAL_PLAN_SERVER_ROUTES_VERSION,
} from './lib/v0125/canonical-plan-server-routes.mjs';
import { CANONICAL_PLAN_SERVICES_VERSION } from './lib/v0125/canonical-plan-services.mjs';
import { CANONICAL_HISTORY_VERSION } from './lib/v0125/canonical-history.mjs';

const PORT = Number(process.env.PORT || 3000);

function json(res, status, body, extra = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra,
  });
  res.end(JSON.stringify(body));
}

function readBody(req, max = 2_500_000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > max) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value : '';
}

const unifiedPreviewRoute = createUnifiedPreviewServerRoute({ readBody, bearer, json });
const canonicalReviewRoute = createCanonicalReviewServerRoute({ readBody, bearer, json });
const canonicalDocxRoute = createCanonicalDocxServerRoute({ readBody, json });

http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/v0125_health') {
    return json(res, 200, {
      ok: true,
      version: '0.12.5-unified-preview-shadow',
      serverRouteVersion: UNIFIED_PREVIEW_SERVER_ROUTE_VERSION,
      canonicalPlanServicesVersion: CANONICAL_PLAN_SERVICES_VERSION,
      canonicalPlanServerRoutesVersion: CANONICAL_PLAN_SERVER_ROUTES_VERSION,
      canonicalHistoryVersion: CANONICAL_HISTORY_VERSION,
      unifiedPreviewEnabled: process.env.MULTIPLAN_V0125_UNIFIED_PREVIEW_ENABLED === '1',
      canonicalReviewEnabled: true,
      canonicalDocxEnabled: true,
      canonicalSnapshotPersistenceEnabled: true,
      legacyWrapperChainSpawned: false,
      productionModified: false,
    });
  }

  if (url.pathname === '/api/v0125/unified-plan') {
    return unifiedPreviewRoute(req, res);
  }
  if (url.pathname === '/api/v0125/pedagogical-review') {
    return canonicalReviewRoute(req, res);
  }
  if (url.pathname === '/api/v0125/export/docx') {
    return canonicalDocxRoute(req, res);
  }

  return json(res, 404, {
    code: 'NOT_FOUND',
    version: '0.12.5-unified-preview-shadow',
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Multiplan v0.12.5 unified preview shadow on ${PORT}; legacy wrapper chain not spawned`);
});
