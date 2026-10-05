export const CERTIFIED_PROVIDER_TRANSPORT_VERSION = 'CERTIFIED_PROVIDER_TRANSPORT_V1';

const RUNTIME_PATH = '/plan-project-blueprint-v1-shadow';
const SUPABASE_EDGE_PATH = `/functions/v1${RUNTIME_PATH}`;

function hrefOf(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input.url === 'string') return input.url;
  return '';
}

/**
 * Preserve the v0.12.4 certified runtime's exact endpoint-path lock while
 * allowing the real Supabase Edge Function URL used by certification.
 *
 * Only the exact HTTPS /functions/v1/plan-project-blueprint-v1-shadow path is
 * adapted. Query strings, fragments and embedded credentials are never
 * normalized through this boundary.
 */
export function adaptCertifiedProviderTransport({ endpoint, fetchImpl = fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw Error('CERTIFIED_PROVIDER_FETCH_REQUIRED');

  let actual;
  try {
    actual = new URL(endpoint);
  } catch {
    return { endpoint, fetchImpl, adapted: false };
  }

  if (
    actual.protocol !== 'https:' ||
    actual.pathname !== SUPABASE_EDGE_PATH ||
    actual.search || actual.hash || actual.username || actual.password
  ) {
    return { endpoint, fetchImpl, adapted: false };
  }

  const runtime = new URL(actual.href);
  runtime.pathname = RUNTIME_PATH;
  const actualHref = actual.href;
  const runtimeHref = runtime.href;

  const certifiedFetch = (input, init) => {
    if (hrefOf(input) === runtimeHref) return fetchImpl(actualHref, init);
    return fetchImpl(input, init);
  };

  return {
    endpoint: runtimeHref,
    fetchImpl: certifiedFetch,
    adapted: true,
    actual_path: SUPABASE_EDGE_PATH,
    runtime_path: RUNTIME_PATH,
  };
}
