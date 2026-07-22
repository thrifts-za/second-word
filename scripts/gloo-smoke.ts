import { GlooModel } from '../src/clients/gloo'

const clientId = process.env.GLOO_CLIENT_ID
const clientSecret = process.env.GLOO_CLIENT_SECRET
if (!clientId || !clientSecret) throw new Error('Gloo credentials are required')

const observedFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)
  if (process.env.GLOO_SMOKE_DEBUG === '1' && String(input).includes('/chat/completions')) {
    const body = await response.clone().json().catch(() => null) as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>
    } | null
    const args = body?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
    if (args) console.error(`tool arguments: ${args}`)
  }
  return response
}

const model = new GlooModel({
  clientId,
  clientSecret,
  model: process.env.GLOO_MODEL ?? 'gloo-google-gemini-2.5-flash-lite',
}, observedFetch)

const draft = 'Thank you for carrying this while I was overwhelmed. I really appreciate you.'
const analysis = await model.analyze({
  draft,
  locale: 'en-ZA',
  context: 'email',
  principleHint: 'give_thanks',
})

const silence = await model.analyze({
  draft: 'Received. Thursday at 10 works. I will join from the usual link.',
  receivedMessage: 'The Thursday project meeting is confirmed for 10:00. Use the usual video link.',
  locale: 'en-ZA',
  context: 'email',
})

const rewrites = await model.rewrite({
  draft: 'I do not care what you say. Leave me alone.',
  locale: 'en-ZA',
  goal: 'Set a boundary without contempt.',
  principle: 'speak_truth_in_love',
  modes: ['clearer'],
})

console.log(JSON.stringify({
  provider: model.provider,
  analysis_contract: Boolean(analysis.goal && analysis.principle && analysis.candidate_reference_ids.length),
  analysis_principle: analysis.principle,
  silence_contract: silence.needs_reflection === false,
  rewrite_contract: Boolean(rewrites.clearer && rewrites.goal_preserved && rewrites.register_preserved),
}))
