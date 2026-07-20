/**
 * Second Word Worker.
 *
 * Two endpoints. No body logging anywhere: drafts are not ours to keep.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createReflectionModel } from './clients/provider'
import { ModelError } from './clients/model'
import type { WorkersAiBinding } from './clients/workers-ai'
import { YouVersionClient, YouVersionError } from './clients/youversion'
import { AnalyzeRequestSchema, MAX_DRAFT_LENGTH, RewriteRequestSchema } from './lib/contracts'
import { EPIGRAPH_REFERENCE } from './lib/scripture-library'
import { runAnalyze } from './orchestration/analyze'
import { runRewrite } from './orchestration/rewrite'

export interface Env {
  YOUVERSION_APP_KEY: string
  DEFAULT_BIBLE_ID: string
  DEFAULT_LOCALE: string
  ALLOWED_ORIGINS: string
  TOKEN_SIGNING_KEY?: string
  LLM_PROVIDER?: string
  WORKERS_AI_MODEL?: string
  AI?: WorkersAiBinding
  GLOO_CLIENT_ID?: string
  GLOO_CLIENT_SECRET?: string
  GLOO_TOKEN_URL?: string
  GLOO_API_BASE?: string
  GLOO_MODEL?: string
}

const MAX_BODY_BYTES = 8 * 1024

const app = new Hono<{ Bindings: Env }>()

/**
 * CORS covers the health routes too, not just /v1/*. The sandbox reads
 * /health to state which model actually ran, and scoping the middleware to
 * /v1 blocked that with no error anywhere except the browser console.
 */
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type'],
    maxAge: 3600,
  })(c, next)
})

/** Reject oversized bodies before they are parsed. */
app.use('/v1/*', async (c, next) => {
  const declared = Number(c.req.header('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) {
    return c.json({ error: 'payload_too_large', max_bytes: MAX_BODY_BYTES }, 413)
  }
  await next()
})

app.get('/health', (c) =>
  c.json({
    ok: true,
    llm_provider: c.env.LLM_PROVIDER ?? 'gloo',
    gloo_configured: Boolean(c.env.GLOO_CLIENT_ID && c.env.GLOO_CLIENT_SECRET),
    workers_ai_available: Boolean(c.env.AI),
    signing_key_configured: Boolean(c.env.TOKEN_SIGNING_KEY),
    default_bible_id: c.env.DEFAULT_BIBLE_ID,
    max_draft_length: MAX_DRAFT_LENGTH,
  }),
)

/**
 * Live upstream probe. Required by the preflight checklist before filming:
 * a green /health only means the Worker booted, not that Scripture is reachable.
 */
app.get('/health/upstream', async (c) => {
  const started = Date.now()
  const client = new YouVersionClient(c.env.YOUVERSION_APP_KEY)
  try {
    const passage = await client.getPassage(c.env.DEFAULT_BIBLE_ID, 'PRO.15.1')
    return c.json({
      ok: Boolean(passage),
      reference: passage?.displayReference ?? null,
      chars: passage?.content.length ?? 0,
      latency_ms: Date.now() - started,
    })
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        latency_ms: Date.now() - started,
      },
      502,
    )
  }
})

/**
 * The product's own verse, Proverbs 4:20-21.
 *
 * Served from YouVersion like everything else. Hardcoding it would make the
 * provenance rule a slogan rather than a rule.
 */
app.get('/v1/epigraph', async (c) => {
  const client = new YouVersionClient(c.env.YOUVERSION_APP_KEY)
  try {
    const [passage, bible] = await Promise.all([
      client.getPassage(c.env.DEFAULT_BIBLE_ID, EPIGRAPH_REFERENCE),
      client.getBible(c.env.DEFAULT_BIBLE_ID).catch(() => null),
    ])
    if (!passage) return c.json({ error: 'passage_unverifiable' }, 502)

    return c.json({
      reference: passage.displayReference,
      verse_text: passage.content,
      translation: bible?.localizedAbbreviation ?? '',
      attribution: bible?.copyright ?? bible?.localizedTitle ?? '',
      attribution_url: bible?.deepLink ?? null,
    })
  } catch (error) {
    return errorResponse(c, error)
  }
})

app.post('/v1/analyze', async (c) => {
  const parsed = AnalyzeRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', detail: parsed.error.flatten() }, 400)
  }

  const signingKey = c.env.TOKEN_SIGNING_KEY
  if (!signingKey) return c.json({ error: 'server_misconfigured' }, 500)

  try {
    const outcome = await runAnalyze(parsed.data, {
      model: createReflectionModel(c.env),
      youversion: new YouVersionClient(c.env.YOUVERSION_APP_KEY),
      signingKey,
      defaultBibleId: c.env.DEFAULT_BIBLE_ID,
      defaultLocale: c.env.DEFAULT_LOCALE,
    })

    if (outcome.kind === 'safety') return c.json(outcome.body, 200)
    if (outcome.kind === 'no_moment') return c.json(outcome.body, 200)
    if (outcome.kind === 'unverifiable') {
      // Fail closed: no passage was verifiable, so none is shown.
      return c.json(
        {
          error: 'passage_unverifiable',
          message: 'The passage could not be verified, so Second Word did not display it.',
          attempted: outcome.attemptedCount,
        },
        502,
      )
    }
    return c.json(outcome.body, 200)
  } catch (error) {
    return errorResponse(c, error)
  }
})

app.post('/v1/rewrite', async (c) => {
  const parsed = RewriteRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) {
    return c.json({ error: 'invalid_request', detail: parsed.error.flatten() }, 400)
  }

  const signingKey = c.env.TOKEN_SIGNING_KEY
  if (!signingKey) return c.json({ error: 'server_misconfigured' }, 500)

  try {
    const outcome = await runRewrite(parsed.data, {
      model: createReflectionModel(c.env),
      signingKey,
      defaultLocale: c.env.DEFAULT_LOCALE,
    })

    if (outcome.kind === 'rejected') {
      return c.json({ error: 'analysis_token_rejected', reason: outcome.reason }, 401)
    }
    return c.json(outcome.body, 200)
  } catch (error) {
    return errorResponse(c, error)
  }
})

/** Error text is user-facing and must never leak a draft or a credential. */
function errorResponse(c: { json: (body: unknown, status: 502 | 503) => Response }, error: unknown): Response {
  // Name and message only. Never the draft, never a stack containing one.
  const name = error instanceof Error ? error.name : 'UnknownError'
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[second-word] ${name}: ${message}`)

  if (error instanceof YouVersionError) {
    return c.json(
      { error: 'scripture_unavailable', message: 'The passage could not be verified, so Second Word did not display it.' },
      502,
    )
  }
  if (error instanceof ModelError) {
    return c.json(
      { error: 'reflection_unavailable', message: 'Reflection is unavailable right now. Your draft has not changed.' },
      503,
    )
  }
  return c.json(
    { error: 'reflection_unavailable', message: 'Reflection is unavailable right now. Your draft has not changed.' },
    503,
  )
}

export default app
