import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adaptCertifiedProviderTransport,
  CERTIFIED_PROVIDER_TRANSPORT_VERSION,
} from '../lib/v0125/certified-provider-transport.mjs';

test('adapts exact Supabase Edge Function path without changing the certified runtime lock', async () => {
  const actual = 'https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-project-blueprint-v1-shadow';
  const seen = [];
  const fetchImpl = async (input, init) => {
    seen.push({ input: String(input), init });
    return { ok: true };
  };
  const transport = adaptCertifiedProviderTransport({ endpoint: actual, fetchImpl });
  assert.equal(CERTIFIED_PROVIDER_TRANSPORT_VERSION, 'CERTIFIED_PROVIDER_TRANSPORT_V1');
  assert.equal(transport.adapted, true);
  assert.equal(transport.endpoint, 'https://dvcrwzxznuqongutnifn.supabase.co/plan-project-blueprint-v1-shadow');
  await transport.fetchImpl(transport.endpoint, { method: 'POST' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].input, actual);
});

test('leaves an already certified-form endpoint untouched', async () => {
  const endpoint = 'https://example.invalid/plan-project-blueprint-v1-shadow';
  const fetchImpl = async input => input;
  const transport = adaptCertifiedProviderTransport({ endpoint, fetchImpl });
  assert.equal(transport.adapted, false);
  assert.equal(transport.endpoint, endpoint);
  assert.strictEqual(transport.fetchImpl, fetchImpl);
});

test('does not normalize lookalike, query-bearing, insecure or credential-bearing endpoints', () => {
  const fetchImpl = async () => ({});
  for (const endpoint of [
    'https://example.invalid/functions/v1/other-shadow',
    'https://example.invalid/functions/v1/plan-project-blueprint-v1-shadow?x=1',
    'http://example.invalid/functions/v1/plan-project-blueprint-v1-shadow',
    'https://user:pass@example.invalid/functions/v1/plan-project-blueprint-v1-shadow',
  ]) {
    const transport = adaptCertifiedProviderTransport({ endpoint, fetchImpl });
    assert.equal(transport.adapted, false, endpoint);
    assert.equal(transport.endpoint, endpoint);
    assert.strictEqual(transport.fetchImpl, fetchImpl);
  }
});
