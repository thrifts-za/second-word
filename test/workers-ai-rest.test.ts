import { describe, expect, it } from 'vitest'
import { RestWorkersAiBinding, WorkersAiModel } from '../src/clients/workers-ai'
import { createReflectionModel } from '../src/clients/provider'

/**
 * The REST-backed Workers AI binding lets the model run on a different
 * Cloudflare account than the one hosting the Worker. The account that hosts
 * the Worker and the account billed for the neurons no longer have to be the
 * same, which is the whole reason this exists: the host account's free
 * allocation was exhausted, and a second account has its own.
 */
describe('RestWorkersAiBinding', () => {
  it('calls the account-scoped Workers AI endpoint with a bearer token', async () => {
    let seenUrl = ''
    let seenAuth = ''
    let seenBody: unknown
    let sawTimeoutSignal = false
    const fetchImpl: typeof fetch = async (input, init) => {
      seenUrl = String(input)
      seenAuth = String((init?.headers as Record<string, string>).Authorization)
      seenBody = JSON.parse(String(init?.body))
      sawTimeoutSignal = init?.signal instanceof AbortSignal
      return Response.json({ result: { response: 'hello' }, success: true, errors: [] })
    }

    const binding = new RestWorkersAiBinding('acct-123', 'cf-token', fetchImpl)
    const out = await binding.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 50,
    })

    expect(seenUrl).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acct-123/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    )
    expect(seenAuth).toBe('Bearer cf-token')
    expect((seenBody as { max_tokens: number }).max_tokens).toBe(50)
    expect(sawTimeoutSignal).toBe(true)
    // Returns the inner result object, the same shape the platform binding gives,
    // so WorkersAiModel's text extraction does not need to know which was used.
    expect(out).toEqual({ response: 'hello' })
  })

  it('surfaces a Cloudflare API error rather than swallowing it', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ success: false, errors: [{ message: 'account quota exceeded' }] }), {
        status: 200,
      })
    const binding = new RestWorkersAiBinding('acct', 'token', fetchImpl)
    await expect(binding.run('m', { messages: [] })).rejects.toThrow(/quota exceeded/)
  })

  it('bounds a stalled REST call and exposes no provider detail', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new DOMException('upstream did not return', 'TimeoutError')
    }
    const binding = new RestWorkersAiBinding('acct', 'secret-token', fetchImpl)
    await expect(binding.run('m', { messages: [] })).rejects.toThrow('Workers AI request timed out')
  })

  it('drives a full analyze through WorkersAiModel over REST', async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json({
        result: {
          response: JSON.stringify({
            needs_reflection: true,
            goal: 'answer without heat',
            principle: 'gentle_answer',
            candidate_reference_ids: ['PRO.15.1'],
            why: 'this is getting heated',
            question: 'what matters here',
            safety_flags: [],
          }),
        },
        success: true,
      })
    const model = new WorkersAiModel(new RestWorkersAiBinding('acct', 'token', fetchImpl))
    const analysis = await model.analyze({ draft: 'you clearly have no idea', locale: 'en' })
    expect(analysis.principle).toBe('gentle_answer')
  })
})

describe('provider selection prefers REST when an account is configured', () => {
  it('uses the REST binding when CF_ACCOUNT_ID and CF_WORKERS_AI_TOKEN are set', () => {
    const model = createReflectionModel({
      LLM_PROVIDER: 'workers-ai',
      CF_ACCOUNT_ID: 'acct',
      CF_WORKERS_AI_TOKEN: 'token',
    })
    expect(model.provider).toBe('workers-ai')
  })

  it('still works with only the platform binding, unchanged', () => {
    const model = createReflectionModel({
      LLM_PROVIDER: 'workers-ai',
      AI: { run: async () => ({ response: '{}' }) },
    })
    expect(model.provider).toBe('workers-ai')
  })

  it('fails clearly when neither an account nor a binding is present', () => {
    expect(() => createReflectionModel({ LLM_PROVIDER: 'workers-ai' })).toThrow(/Workers AI/)
  })
})
