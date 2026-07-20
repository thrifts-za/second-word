import { describe, expect, it } from 'vitest'
import { FakeModel } from '../src/clients/fake'
import type { ReflectionModel } from '../src/clients/model'
import { YouVersionClient } from '../src/clients/youversion'
import { GlooAnalysisSchema, type GlooAnalysis, type GlooRewrites } from '../src/lib/contracts'
import { runAnalyze } from '../src/orchestration/analyze'
import { runRewrite } from '../src/orchestration/rewrite'

const SIGNING_KEY = 'test-signing-key'
const DRAFT = 'You clearly have no idea what you are talking about, this is idiotic.'

const VERSE_TEXT = 'A gentle answer turns away wrath, but a harsh word stirs up anger.'

/** Stands in for the platform. Only this can produce verse text. */
function youVersionStub(options: { resolves?: string[]; bibles?: boolean } = {}) {
  const resolves = new Set(options.resolves ?? ['PRO.15.1'])
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input)

    // GET /bibles/{id} carries the copyright. The list endpoint does not.
    if (/\/bibles\/\d+$/.test(url)) {
      if (options.bibles === false) return new Response(null, { status: 404 })
      return Response.json({
        id: 111,
        abbreviation: 'NIV11',
        localized_abbreviation: 'NIV',
        title: 'New International Version 2011',
        localized_title: 'New International Version',
        copyright: 'The Holy Bible, New International Version NIV\nCopyright 1973, 1978, 1984, 2011 by Biblica, Inc.',
        youversion_deep_link: 'https://www.bible.com/versions/111',
      })
    }

    const reference = url.split('/passages/')[1] ?? ''
    if (!resolves.has(decodeURIComponent(reference))) {
      return new Response(null, { status: 404 })
    }
    return Response.json({ id: reference, content: VERSE_TEXT, reference: 'Proverbs 15:1' })
  }
  return new YouVersionClient('public-app-key', fetchImpl)
}

function deps(overrides: Partial<Parameters<typeof runAnalyze>[1]> = {}) {
  return {
    model: new FakeModel(),
    youversion: youVersionStub(),
    signingKey: SIGNING_KEY,
    defaultBibleId: '111',
    defaultLocale: 'en',
    ...overrides,
  }
}

const request = { draft: DRAFT, surface: 'sandbox' as const }

describe('analyze', () => {
  it('returns a verified passage, a why line, and a question', async () => {
    const outcome = await runAnalyze(request, deps())
    expect(outcome.kind).toBe('ok')
    if (outcome.kind !== 'ok') return

    expect(outcome.body.verse_text).toBe(VERSE_TEXT)
    expect(outcome.body.verified_reference_id).toBe('PRO.15.1')
    expect(outcome.body.display_reference).toBe('Proverbs 15:1')
    expect(outcome.body.why.length).toBeGreaterThan(0)
    expect(outcome.body.question.length).toBeGreaterThan(0)
    expect(outcome.body.analysis_token).toContain('.')
  })

  it('carries translation and attribution, which the passage endpoint omits', async () => {
    const outcome = await runAnalyze(request, deps())
    if (outcome.kind !== 'ok') throw new Error('expected ok')
    expect(outcome.body.translation).toBe('NIV')
    // The real publisher copyright, which the licence requires us to display.
    expect(outcome.body.attribution).toContain('Biblica')
    expect(outcome.body.attribution_url).toBe('https://www.bible.com/versions/111')
  })

  it('never renders a reference the model invented', async () => {
    const rogue: ReflectionModel = {
      provider: 'fake',
      async analyze(): Promise<GlooAnalysis> {
        return GlooAnalysisSchema.parse({
          needs_reflection: true,
          goal: 'g',
          principle: 'gentle_answer',
          // Not in the reviewed library for any principle.
          candidate_reference_ids: ['REV.13.18'],
          why: 'w',
          question: 'q',
          safety_flags: [],
        })
      },
      async rewrite(): Promise<GlooRewrites> {
        throw new Error('not used')
      },
    }

    const outcome = await runAnalyze(request, deps({ model: rogue }))
    // The rogue reference is dropped, and the reviewed candidates are used.
    if (outcome.kind !== 'ok') throw new Error('expected ok')
    expect(outcome.body.verified_reference_id).toBe('PRO.15.1')
  })

  it('fails closed when no reviewed candidate resolves', async () => {
    const outcome = await runAnalyze(request, deps({ youversion: youVersionStub({ resolves: [] }) }))
    expect(outcome.kind).toBe('unverifiable')
  })

  it('still renders when attribution lookup fails', async () => {
    const outcome = await runAnalyze(request, deps({ youversion: youVersionStub({ bibles: false }) }))
    expect(outcome.kind).toBe('ok')
  })

  it('routes a safety-flagged draft away from a tone rewrite', async () => {
    const flagging: ReflectionModel = {
      provider: 'fake',
      async analyze(): Promise<GlooAnalysis> {
        return GlooAnalysisSchema.parse({
          needs_reflection: true,
          goal: 'g',
          principle: 'seek_peace',
          candidate_reference_ids: ['ROM.12.18'],
          why: 'w',
          question: 'q',
          safety_flags: ['self_harm'],
        })
      },
      async rewrite(): Promise<GlooRewrites> {
        throw new Error('rewrites must not be offered for a flagged draft')
      },
    }

    const outcome = await runAnalyze(request, deps({ model: flagging }))
    expect(outcome.kind).toBe('safety')
  })
})

describe('rewrite', () => {
  it('accepts a token issued for this draft', async () => {
    const analyzed = await runAnalyze(request, deps())
    if (analyzed.kind !== 'ok') throw new Error('expected ok')

    const outcome = await runRewrite(
      { draft: DRAFT, analysis_token: analyzed.body.analysis_token, modes: ['clearer', 'curious'] },
      { model: new FakeModel(), signingKey: SIGNING_KEY, defaultLocale: 'en' },
    )

    expect(outcome.kind).toBe('ok')
    if (outcome.kind !== 'ok') return
    expect(Object.keys(outcome.body.rewrites)).toEqual(['clearer', 'curious'])
    expect(outcome.body.principle).toBe(analyzed.body.principle)
  })

  it('refuses to rewrite a draft that was never analysed', async () => {
    const analyzed = await runAnalyze(request, deps())
    if (analyzed.kind !== 'ok') throw new Error('expected ok')

    const outcome = await runRewrite(
      { draft: 'A different message entirely.', analysis_token: analyzed.body.analysis_token, modes: ['clearer'] },
      { model: new FakeModel(), signingKey: SIGNING_KEY, defaultLocale: 'en' },
    )

    expect(outcome).toEqual({ kind: 'rejected', reason: 'draft_mismatch' })
  })
})
