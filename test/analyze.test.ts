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
    expect(outcome.body.experience).toBe('guard')
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

  it('fails closed when publisher attribution cannot be verified', async () => {
    const outcome = await runAnalyze(request, deps({ youversion: youVersionStub({ bibles: false }) }))
    expect(outcome.kind).toBe('unverifiable')
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

  it('routes explicit safety language even when the model is unavailable', async () => {
    const unavailable: ReflectionModel = {
      provider: 'fake',
      async analyze(): Promise<GlooAnalysis> { throw new Error('model must not be called') },
      async rewrite(): Promise<GlooRewrites> { throw new Error('model must not be called') },
    }
    const outcome = await runAnalyze(
      { draft: 'I am writing goodbye because I plan to hurt myself tonight.', surface: 'sandbox' },
      deps({ model: unavailable, youversion: youVersionStub({ resolves: ['PSA.34.18'] }) }),
    )
    if (outcome.kind !== 'safety') throw new Error('expected safety')
    expect(outcome.body.safety_flags).toEqual(['self_harm'])
    expect(outcome.body.comfort_reference_id).toBe('PSA.34.18')
  })

  it('rotates to a verified safety passage and carries its attribution', async () => {
    const flagging: ReflectionModel = {
      provider: 'fake',
      async analyze() {
        return GlooAnalysisSchema.parse({
          needs_reflection: true,
          goal: 'stay with the person',
          principle: 'seek_peace',
          candidate_reference_ids: ['ROM.12.18'],
          why: 'w',
          question: 'q',
          safety_flags: ['self_harm'],
        })
      },
      async rewrite(): Promise<GlooRewrites> { throw new Error('must not rewrite') },
    }
    const outcome = await runAnalyze(
      { ...request, recent_reference_ids: ['PSA.34.18'] },
      deps({ model: flagging, youversion: youVersionStub({ resolves: ['PSA.42.11'] }) }),
    )
    if (outcome.kind !== 'safety') throw new Error('expected safety')
    expect(outcome.body.comfort_reference_id).toBe('PSA.42.11')
    expect(outcome.body.verse_text).toBe(VERSE_TEXT)
    expect(outcome.body.attribution).toContain('Biblica')
    expect(outcome.body).not.toHaveProperty('analysis_token')
  })

  it('still provides care but no substitute Scripture when YouVersion cannot verify one', async () => {
    const flagging: ReflectionModel = {
      provider: 'fake',
      async analyze() {
        return GlooAnalysisSchema.parse({
          needs_reflection: true, goal: 'care', principle: 'seek_peace',
          candidate_reference_ids: ['ROM.12.18'], why: 'w', question: 'q', safety_flags: ['crisis'],
        })
      },
      async rewrite(): Promise<GlooRewrites> { throw new Error('must not rewrite') },
    }
    const outcome = await runAnalyze(request, deps({ model: flagging, youversion: youVersionStub({ resolves: [] }) }))
    if (outcome.kind !== 'safety') throw new Error('expected safety')
    expect(outcome.body.verse_text).toBeUndefined()
    expect(outcome.body.message).toContain('you are not alone')
  })

  it('marks freely offered support as Guide and refuses to rewrite it', async () => {
    const guiding: ReflectionModel = {
      provider: 'fake',
      async analyze() {
        return GlooAnalysisSchema.parse({
          needs_reflection: true,
          goal: 'offer support freely',
          principle: 'offer_support',
          candidate_reference_ids: ['GAL.5.13'],
          why: 'freely carrying something for another person',
          question: 'what makes this help an act of love',
          safety_flags: [],
        })
      },
      async rewrite(): Promise<GlooRewrites> { throw new Error('Guide must not rewrite') },
    }
    const guideRequest = { draft: 'Be with your family, Priya. I can carry Thursday for you.', surface: 'sandbox' as const }
    const analyzed = await runAnalyze(
      guideRequest,
      deps({ model: guiding, youversion: youVersionStub({ resolves: ['GAL.5.13'] }) }),
    )
    if (analyzed.kind !== 'ok') throw new Error('expected ok')
    expect(analyzed.body.experience).toBe('guide')

    const rewritten = await runRewrite(
      { draft: guideRequest.draft, analysis_token: analyzed.body.analysis_token, modes: ['clearer'] },
      { model: guiding, signingKey: SIGNING_KEY, defaultLocale: 'en' },
    )
    expect(rewritten).toEqual({ kind: 'rejected', reason: 'guide_does_not_rewrite' })
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
