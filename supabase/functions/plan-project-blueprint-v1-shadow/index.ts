import { persistProviderResponse } from './durable-response.mjs'
import { evidenceStore } from './evidence-store.mjs'
import { outputBudget } from './output-budget.mjs'
import { parseCandidate, redactSecrets } from './provider-output.mjs'
import { classifyShadowOperation } from './operation-contract.mjs'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405)

  let secretKeys: Record<string, string> = {}
  try {
    secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
  } catch {}

  const configuredSecrets = Object.values(secretKeys).filter(
    (value) => typeof value === 'string' && value.startsWith('sb_secret_'),
  )
  const authorization = req.headers.get('authorization') || ''
  const bearerSecret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  const apiKey = req.headers.get('apikey') || bearerSecret
  if (!apiKey || !configuredSecrets.includes(apiKey)) {
    return json({ code: 'SHADOW_SECRET_KEY_REQUIRED' }, 403)
  }

  try {
    const raw = await req.text()
    if (raw.length > 500000) return json({ code: 'PAYLOAD_TOO_LARGE' }, 413)
    const b = JSON.parse(raw)
    const providerKey = Deno.env.get('Multiplan') || ''
    const store = evidenceStore({
      url: Deno.env.get('SUPABASE_URL'),
      serviceKey: apiKey,
      secrets: [apiKey, ...configuredSecrets, providerKey],
    })

    if (b.task === 'EVIDENCE_SETUP') {
      await store.setup()
      return json({ status: 'PRIVATE_STORAGE_READY' })
    }
    if (b.task === 'EVIDENCE_READ') {
      const saved = await store.get(b.request_id, b.part || 'result')
      return saved ? json(saved) : json({ status: 'PENDING' }, 202)
    }
    const operation = classifyShadowOperation(b)

    if (!operation.valid) {
      return json({ code: 'INVALID_SHADOW_OPERATION' }, 400)
    }

    if (
      operation.blueprintTask &&
      (
        !b.input ||
        !b.input.constraints ||
        !b.input.curriculum ||
        !b.input.methodology ||
        (b.task === 'GENERATE' && b.input.blueprint)
      )
    ) {
      return json({ code: 'INVALID_INPUT' }, 400)
    }
    if (typeof b.system !== 'string' || typeof b.prompt !== 'object') {
      return json({ code: 'INVALID_PROMPT' }, 400)
    }
    if (!providerKey) return json({ code: 'PROVIDER_KEY_UNAVAILABLE' }, 503)

    const maxOutputTokens = outputBudget(b.task, b.model, b.output_diagnostic === true)
    const durable = typeof b.request_id === 'string'
    if (durable) {
      await store.setup()
      await store.put(b.request_id, 'request', {
        timestamp: new Date().toISOString(),
        task: b.task,
        model: b.model,
        max_output_tokens: maxOutputTokens,
        input_hash: b.input_hash || null,
        status: 'STARTED',
      })
    }

    const execute = async () => {
      const start = Date.now()
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${b.model}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': providerKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: b.system }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(b.prompt) }] }],
            generationConfig: {
              maxOutputTokens,
              responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: b.response_schema } },
            },
          }),
          signal: AbortSignal.timeout(180000),
        },
      )
      const providerRaw = await response.text()
      if (durable) {
        return persistProviderResponse(providerRaw, {
          task: b.task,
          model: b.model,
          http_status: response.status,
          latency_ms: Date.now() - start,
          max_output_tokens: maxOutputTokens,
          diagnostic: b.output_diagnostic === true,
          secrets: [providerKey, apiKey, ...configuredSecrets],
          persist: (part: string, data: unknown) => store.put(b.request_id, part, data),
        })
      }
      let result: any = null
      try { result = JSON.parse(providerRaw) } catch {}
      if (!response.ok) {
        const pe = result?.error || {}
        return {
          http_status: 502,
          body: {
            code: 'PROVIDER_ERROR',
            provider_status: response.status,
            provider_error_code: pe.code ?? null,
            provider_error_status: pe.status ?? null,
            provider_message: redactSecrets(pe.message || providerRaw || '', [providerKey, apiKey, ...configuredSecrets]),
            latency_ms: Date.now() - start,
          },
        }
      }
      if (!result) return { http_status: 502, body: { code: 'PROVIDER_INVALID_JSON', provider_status: response.status } }
      return parseCandidate(result, {
        model: b.model,
        latency_ms: Date.now() - start,
        max_output_tokens: maxOutputTokens,
        diagnostic: b.output_diagnostic === true,
        secrets: [providerKey, apiKey, ...configuredSecrets],
      })
    }

    if (durable) {
      const job = (async () => {
        try {
          const result = await execute()
          await store.put(b.request_id, 'result', result)
        } catch (e) {
          await store.put(b.request_id, 'result', {
            http_status: 502,
            body: {
              code: 'SHADOW_EXECUTION_FAILED',
              message: redactSecrets(String(e), [providerKey, apiKey, ...configuredSecrets]),
            },
          })
        }
      })()
      EdgeRuntime.waitUntil(job)
      return json({ status: 'ACCEPTED', request_id: b.request_id }, 202)
    }

    const parsed = await execute()
    return json(parsed.body, parsed.http_status)
  } catch (e) {
    return json({ code: 'SHADOW_PROVIDER_ERROR', message: String(e).slice(0, 160) }, 502)
  }
})
