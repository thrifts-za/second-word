import { GlooModel } from '../src/clients/gloo'

const clientId = process.env.GLOO_CLIENT_ID
const clientSecret = process.env.GLOO_CLIENT_SECRET
if (!clientId || !clientSecret) throw new Error('Gloo credentials are required')

const model = new GlooModel({
  clientId,
  clientSecret,
  model: process.env.GLOO_MODEL ?? 'gloo-google-gemini-2.5-flash-lite',
})

const draft = 'Thank you for carrying this while I was overwhelmed. I really appreciate you.'
const analysis = await model.analyze({
  draft,
  locale: 'en-ZA',
  context: 'email',
  principleHint: 'give_thanks',
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
  rewrite_contract: Boolean(rewrites.clearer && rewrites.goal_preserved && rewrites.register_preserved),
}))
