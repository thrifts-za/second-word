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

  const epigraph = await get('/v1/epigraph')
  if (!epigraph.verse_text || !epigraph.attribution) fail('Epigraph lacks verified text or attribution')
  console.log(`ok   Scripture provenance (${epigraph.reference})`)

  const analyzed = await post('/v1/analyze', fixture)
  if (!analyzed.ok) throw new Error(`/v1/analyze returned HTTP ${analyzed.status}`)
  const analysis = await analyzed.json()
  if (!analysis.analysis_token || !analysis.verse_text || !analysis.verified_reference_id) fail('Analysis did not return a signed, verified Scripture result')
  else console.log(`ok   Analyze -> verified ${analysis.display_reference} (${analysis.latency_ms}ms)`)

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
