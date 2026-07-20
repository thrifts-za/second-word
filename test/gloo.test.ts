import { describe, expect, it } from 'vitest'
import { GlooModel } from '../src/clients/gloo'

const analysis = {
  needs_reflection: true,
  goal: 'answer without returning the blow',
  principle: 'gentle_answer',
  candidate_reference_ids: ['PRO.15.1'],
  why: 'The draft names a real grievance with heat.',
  question: 'What truth do you want to preserve?',
  safety_flags: [],
}

describe('Gloo provider protocol', () => {
  it('uses documented OAuth and v2 OpenAI-compatible completions, caching the bearer token', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const model = new GlooModel(
      { clientId: 'id', clientSecret: 'secret' },
      async (input, init) => {
        calls.push({ url: String(input), init })
        if (String(input).endsWith('/oauth2/token')) {
          return Response.json({ access_token: 'short-lived-token', expires_in: 3600 })
        }
        return Response.json({ choices: [{ message: { content: JSON.stringify(analysis) } }] })
      },
    )

    await model.analyze({ draft: 'You always dismiss what I say.', locale: 'en' })
    await model.analyze({ draft: 'I need to make this right.', locale: 'en' })

    expect(calls).toHaveLength(3)
    const token = calls[0]!
    expect(token.url).toBe('https://platform.ai.gloo.com/oauth2/token')
    expect(token.init?.headers).toMatchObject({
      authorization: 'Basic aWQ6c2VjcmV0',
      'content-type': 'application/x-www-form-urlencoded',
    })
    expect(token.init?.body).toBe('grant_type=client_credentials&scope=api/access')

    for (const completion of calls.slice(1)) {
      expect(completion.url).toBe('https://platform.ai.gloo.com/ai/v2/chat/completions')
      expect(completion.init?.headers).toMatchObject({ authorization: 'Bearer short-lived-token' })
      expect(JSON.parse(String(completion.init?.body))).toMatchObject({
        model: 'gloo-openai-gpt-5-mini',
        response_format: { type: 'json_object' },
      })
    }
  })
})
