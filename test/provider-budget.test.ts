import { describe, expect, it } from 'vitest'
import { modelForOperation, type Env } from '../src/index'

function namespace(decision: unknown): DurableObjectNamespace {
  return {
    idFromName: () => ({}) as DurableObjectId,
    get: () => ({ fetch: async () => Response.json(decision) }) as unknown as DurableObjectStub,
  } as unknown as DurableObjectNamespace
}

const base: Env = {
  YOUVERSION_APP_KEY: 'public-test-key',
  DEFAULT_BIBLE_ID: '111',
  DEFAULT_LOCALE: 'en',
  ALLOWED_ORIGINS: '',
  TOKEN_SIGNING_KEY: 'signing-key',
  LLM_PROVIDER: 'gloo',
  GLOO_CLIENT_ID: 'client-id',
  GLOO_CLIENT_SECRET: 'client-secret',
  AI: { run: async () => ({ response: '{}' }) },
}

describe('budgeted provider selection', () => {
  it('uses Gloo only after the guard grants an allowance', async () => {
    const model = await modelForOperation({
      ...base,
      GLOO_BUDGET: namespace({ allowed: true, remainingDaily: 9, remainingTotal: 99 }),
    }, 'analyze')

    expect(model.provider).toBe('gloo')
  })

  it('keeps the product available through Workers AI when the allowance is denied', async () => {
    const model = await modelForOperation({
      ...base,
      GLOO_BUDGET: namespace({ allowed: false, reason: 'daily_limit', remainingDaily: 0, remainingTotal: 90 }),
    }, 'analyze')

    expect(model.provider).toBe('workers-ai')
  })

  it('fails safely to Workers AI when the budget guard is unavailable', async () => {
    const model = await modelForOperation(base, 'rewrite')
    expect(model.provider).toBe('workers-ai')
  })
})
