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
})
