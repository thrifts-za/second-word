/**
 * Verify the deployed vertical slice before filming or submitting.
 *
 * Uses a non-sensitive fixture to prove: YouVersion reachability, verified
 * Scripture, a signed analysis-to-rewrite flow, and tamper rejection.
 *
 *   npm run preflight
 *   API_BASE=https://example.workers.dev REQUIRE_GLOO=1 npm run preflight
 */

const base = (process.env.API_BASE ?? 'https://second-word.nkosithrifts.workers.dev').replace(/\/$/, '')
const requireGloo = process.env.REQUIRE_GLOO === '1'
const fixture = {
  draft: 'I want to correct this without returning the blow, but I feel angry.',
  surface: 'sandbox',
  received_message: 'You failed again and everyone knows it.',
}
const impactFixtures = [
  fixture,
  {
    draft: 'I am grateful we won this contract. Thank you for carrying so much of the work with patience and excellence.',
    surface: 'sandbox',
  },
  {
    draft: 'I am devastated by the decision, but I want to respond with honesty and grace.',
    surface: 'sandbox',
  },
]
const guideFixture = {
  draft: 'Be with your family, Priya. I can carry Thursday for you, and I will send you a short update when it is done.',
  surface: 'sandbox',
  received_message: 'My son is unwell and I need to take him to the clinic. Could you carry the Thursday handover?',
}
const silenceFixture = {
  draft: 'Received. Thursday at 10 works. I will join from the usual link.',
  surface: 'sandbox',
  received_message: 'The Thursday project meeting is confirmed for 10:00. Use the usual video link.',
}

function fail(message) {
  console.error(`FAIL ${message}`)
  process.exitCode = 1
}

async function get(path) {
  const response = await fetch(`${base}${path}`)
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  return response.json()
}

async function post(path, body) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://second-word.pages.dev' },
    body: JSON.stringify(body),
  })
}

try {
  console.log(`Second Word preflight: ${base}`)
  const health = await get('/health')
  if (!health.ok || !health.signing_key_configured) fail('Worker health or signing key is not ready')
  if (requireGloo && health.llm_provider !== 'gloo') fail(`Gloo required, but live provider is ${health.llm_provider}`)
  console.log(`ok   Worker healthy (${health.llm_provider})`)

  const upstream = await get('/health/upstream')
  if (!upstream.ok || !upstream.reference || !upstream.chars) fail('YouVersion upstream is not returning a verified passage')
  console.log(`ok   YouVersion upstream (${upstream.reference}, ${upstream.latency_ms}ms)`)

  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const yearStart = Date.UTC(now.getFullYear(), 0, 0)
  const day = Math.floor((today - yearStart) / 86_400_000)
  const daily = await get(`/v1/verse-of-the-day?day=${day}`)
  if (!daily.verse_text || !daily.attribution || daily.source !== 'youversion_verse_of_the_day') {
    fail('Verse of the Day lacks verified text, attribution, or YouVersion provenance')
  }
  console.log(`ok   YouVersion Verse of the Day (${daily.display_reference})`)

  const analyzed = await post('/v1/analyze', fixture)
  if (!analyzed.ok) throw new Error(`/v1/analyze returned HTTP ${analyzed.status}`)
  const analysis = await analyzed.json()
  if (!analysis.analysis_token || !analysis.verse_text || !analysis.verified_reference_id) fail('Analysis did not return a signed, verified Scripture result')
  if (analysis.experience !== 'guard') fail(`Angry fixture should be Guard, received ${analysis.experience}`)
  else console.log(`ok   Analyze -> verified ${analysis.display_reference} (${analysis.latency_ms}ms)`)

  for (const impactFixture of impactFixtures.slice(1)) {
    const response = await post('/v1/analyze', impactFixture)
    if (!response.ok) throw new Error(`/v1/analyze impact fixture returned HTTP ${response.status}`)
    const result = await response.json()
    if (!result.verse_text || !result.verified_reference_id) fail('Impact fixture did not return verified Scripture')
  }
  console.log('ok   Impact breadth -> gratitude and disappointment both receive verified Scripture')

  const guidedResponse = await post('/v1/analyze', guideFixture)
  if (!guidedResponse.ok) throw new Error(`/v1/analyze Guide fixture returned HTTP ${guidedResponse.status}`)
  const guided = await guidedResponse.json()
  if (guided.experience !== 'guide' || !guided.verse_text || !guided.verified_reference_id) {
    fail('Meaningful support did not return verified Guide Scripture')
  } else console.log(`ok   Guide -> ${guided.display_reference}, no corrective UI path`)
  if (guided.analysis_token) fail('Guide must not receive a rewrite token')
  else console.log('ok   Guide receives no rewrite credential')
  if (guided.question) fail('Guide must not interrogate a good moment')
  else console.log('ok   Guide affirms without a reflective question')

  const silentResponse = await post('/v1/analyze', silenceFixture)
  if (!silentResponse.ok) throw new Error(`/v1/analyze Silence fixture returned HTTP ${silentResponse.status}`)
  const silent = await silentResponse.json()
  if (silent.needs_reflection !== false) fail('Neutral scheduling fixture should remain silent')
  else console.log('ok   Silence -> neutral scheduling receives no passage')

  const rewritten = await post('/v1/rewrite', {
    draft: fixture.draft,
    received_message: fixture.received_message,
    analysis_token: analysis.analysis_token,
    modes: ['clearer', 'firm_and_gracious'],
  })
  if (!rewritten.ok) throw new Error(`/v1/rewrite returned HTTP ${rewritten.status}`)
  const rewrite = await rewritten.json()
  if (!rewrite.rewrites?.clearer || !rewrite.rewrites?.firm_and_gracious) fail('Rewrite did not return both requested alternatives')
  else console.log(`ok   Rewrite -> signed flow (${rewrite.latency_ms}ms)`)

  const tampered = await post('/v1/rewrite', {
    draft: 'This is not the analyzed draft.',
    received_message: fixture.received_message,
    analysis_token: analysis.analysis_token,
    modes: ['clearer'],
  })
  if (tampered.status !== 401) fail(`Tampered rewrite should be 401, received ${tampered.status}`)
  else console.log('ok   Tampered rewrite rejected')
} catch (error) {
  fail(error instanceof Error ? error.message : String(error))
}

if (!process.exitCode) console.log('PASS deployed vertical slice is ready to film.')
