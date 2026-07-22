import { describe, expect, it } from 'vitest'
import app, { type Env } from '../src/index'

const env: Env = {
  YOUVERSION_APP_KEY: 'test-app-key',
  DEFAULT_BIBLE_ID: '111',
  DEFAULT_LOCALE: 'en',
  ALLOWED_ORIGINS: 'https://second-word.pages.dev',
  TOKEN_SIGNING_KEY: 'test-signing-key',
}

describe('Worker request boundary', () => {
  it('marks private-draft API responses as non-cacheable and browser-safe', async () => {
    const response = await app.fetch(new Request('https://worker.invalid/health'), env)

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })

  it('rejects an oversized chunked-style JSON body even with no content-length header', async () => {
    const request = new Request('https://worker.invalid/v1/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draft: 'x'.repeat(9_000), surface: 'sandbox' }),
    })
    // Node's Request intentionally does not synthesize this forbidden header,
    // which exercises the second, real byte boundary in readBoundedJson.
    expect(request.headers.has('content-length')).toBe(false)

    const response = await app.fetch(request, env)

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({ error: 'payload_too_large', max_bytes: 8192 })
  })

  it('rejects malformed JSON without handing it to a model', async () => {
    const response = await app.fetch(
      new Request('https://worker.invalid/v1/rewrite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not valid json',
      }),
      env,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_request' })
  })

  it('rejects an invalid rewrite token before it can consume Gloo allowance', async () => {
    let budgetCalled = false
    const guardedEnv: Env = {
      ...env,
      LLM_PROVIDER: 'gloo',
      GLOO_BUDGET: {
        idFromName: () => ({}) as DurableObjectId,
        get: () => ({
          fetch: async () => {
            budgetCalled = true
            return Response.json({ allowed: true, remainingDaily: 1, remainingTotal: 1 })
          },
        }) as unknown as DurableObjectStub,
      } as unknown as DurableObjectNamespace,
    }
    const response = await app.fetch(
      new Request('https://worker.invalid/v1/rewrite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          draft: 'This request was never analysed.',
          analysis_token: 'not-a-valid-token',
          modes: ['clearer'],
        }),
      }),
      guardedEnv,
    )

    expect(response.status).toBe(401)
    expect(budgetCalled).toBe(false)
  })
})
