import { describe, expect, it } from 'vitest'
import { AnalyzeRequestSchema, GlooAnalysisSchema, MAX_DRAFT_LENGTH } from '../src/lib/contracts'
import { ALLOWED_REFERENCE_IDS, PRINCIPLE_LIBRARY, SAFETY_CANDIDATE_LIBRARY, experienceForPrinciple, orderedCandidates, orderedSafetyCandidates } from '../src/lib/scripture-library'

const valid = {
  needs_reflection: true,
  draft_needs_care: true,
  goal: 'Correct a claim without being dismissed',
  principle: 'gentle_answer',
  candidate_reference_ids: ['PRO.15.1'],
  why: 'The point can survive without the heat carrying it.',
  question: 'What do you want to be true after you send this?',
  safety_flags: [],
}

describe('Gloo output contract', () => {
  it('accepts a well-formed analysis', () => {
    expect(GlooAnalysisSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts an older provider response that omits the optional care judgement', () => {
    const { draft_needs_care: _omitted, ...withoutCare } = valid
    const parsed = GlooAnalysisSchema.safeParse(withoutCare)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.draft_needs_care).toBeUndefined()
  })

  it('gives the model no way to hand us Scripture', () => {
    // The schema is strict, so an added verse_text field is a hard failure
    // rather than something we would have to strip later.
    const withVerse = { ...valid, verse_text: 'A gentle answer turns away wrath' }
    expect(GlooAnalysisSchema.safeParse(withVerse).success).toBe(false)
  })

  it('rejects a principle outside the reviewed enum', () => {
    expect(GlooAnalysisSchema.safeParse({ ...valid, principle: 'be_nicer' }).success).toBe(false)
  })

  it('accepts safety flags the model wrote with a hyphen, and normalises them', () => {
    // The single most important path in the product, and it was failing. The
    // model returns "self-harm" (natural English); the enum is "self_harm".
    // Under .strict() that one character failed the whole parse and a genuine
    // crisis message got a 503 instead of a caring response.
    const parsed = GlooAnalysisSchema.safeParse({ ...valid, safety_flags: ['self-harm', 'crisis'] })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.safety_flags).toEqual(['self_harm', 'crisis'])
  })

  it('drops a safety flag it does not recognise rather than failing the whole analysis', () => {
    // A model inventing "suicidal" must not take the rest of the response down
    // with it. Better to lose one label than to lose the whole reply.
    const parsed = GlooAnalysisSchema.safeParse({ ...valid, safety_flags: ['suicidal', 'crisis'] })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.safety_flags).toEqual(['crisis'])
  })

  it('still accepts the canonical underscore flags unchanged', () => {
    const parsed = GlooAnalysisSchema.safeParse({ ...valid, safety_flags: ['self_harm', 'threat'] })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.safety_flags).toEqual(['self_harm', 'threat'])
  })

  it('rejects a malformed reference', () => {
    expect(
      GlooAnalysisSchema.safeParse({ ...valid, candidate_reference_ids: ['Proverbs 15:1'] }).success,
    ).toBe(false)
  })

  it('caps the draft length', () => {
    const tooLong = { draft: 'x'.repeat(MAX_DRAFT_LENGTH + 1), surface: 'sandbox' }
    expect(AnalyzeRequestSchema.safeParse(tooLong).success).toBe(false)
  })

  it('rejects unknown request fields, including anything thread-shaped', () => {
    const smuggled = { draft: 'hello there friend', surface: 'sandbox', thread_context: 'parent comment' }
    expect(AnalyzeRequestSchema.safeParse(smuggled).success).toBe(false)
  })
})

describe('scripture library', () => {
  it('every principle has at least two reviewed candidates', () => {
    for (const entry of Object.values(PRINCIPLE_LIBRARY)) {
      expect(entry.candidates.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('every candidate is a USFM reference, single verse or range', () => {
    for (const id of ALLOWED_REFERENCE_IDS) {
      expect(id).toMatch(/^[1-9A-Z]{3}\.\d{1,3}\.\d{1,3}(-\d{1,3})?$/)
    }
  })

  it('accepts a verse range, which the platform supports', () => {
    expect(GlooAnalysisSchema.safeParse({ ...valid, candidate_reference_ids: ['PRO.4.20-21'] }).success).toBe(true)
  })

  it('covers moments beyond conflict', () => {
    // The reframe: this is correspondence, not a temper guard.
    for (const principle of ['meet_disappointment', 'bear_false_accusation', 'make_amends', 'comfort_the_grieving'] as const) {
      expect(PRINCIPLE_LIBRARY[principle].candidates.length).toBeGreaterThanOrEqual(2)
      expect(PRINCIPLE_LIBRARY[principle].moment.length).toBeGreaterThan(10)
    }
  })

  it('derives Guide from affirming principles and Guard from consequential ones', () => {
    for (const principle of ['give_thanks', 'receive_good_news', 'offer_support'] as const) {
      expect(experienceForPrinciple(principle)).toBe('guide')
    }
    expect(experienceForPrinciple('gentle_answer')).toBe('guard')
    expect(experienceForPrinciple('comfort_the_grieving')).toBe('guard')
  })

  it('behavioural constraints are original prose, not verse text', () => {
    for (const entry of Object.values(PRINCIPLE_LIBRARY)) {
      expect(entry.constraint.length).toBeGreaterThan(30)
      expect(entry.constraint).not.toMatch(/["“”]/)
    }
  })

  it('keeps provider-analysis voice out of every reviewed user-facing line', () => {
    for (const entry of Object.values(PRINCIPLE_LIBRARY)) {
      expect(entry.explanation).not.toMatch(/\bthe (?:user|writer)\b/i)
      expect(entry.question).not.toMatch(/\bthe (?:user|writer)\b/i)
    }
  })

  it('ranks the model preference first, then falls back to the reviewed order', () => {
    expect(orderedCandidates('gentle_answer', ['COL.4.6'])).toEqual(['COL.4.6', 'PRO.15.1', 'PRO.25.15'])
  })

  it('drops references the model proposed from another principle', () => {
    expect(orderedCandidates('gentle_answer', ['JAS.1.19'])).toEqual(['PRO.15.1', 'PRO.25.15', 'COL.4.6'])
  })

  it('rotates ordinary passages away from recently shown references and resets only when exhausted', () => {
    const candidates = PRINCIPLE_LIBRARY.meet_disappointment.candidates
    expect(orderedCandidates('meet_disappointment', candidates, [candidates[0]!])).toEqual(candidates.slice(1))
    expect(orderedCandidates('meet_disappointment', candidates, candidates)).toEqual(candidates)
  })

  it('keeps safety selection inside the curated context', () => {
    expect(orderedSafetyCandidates(['abuse_disclosure'])).toEqual(SAFETY_CANDIDATE_LIBRARY.abuse_disclosure.candidates)
  })

  it('avoids recently shown safety passages and resets after the set is exhausted', () => {
    const candidates = SAFETY_CANDIDATE_LIBRARY.self_harm.candidates
    expect(orderedSafetyCandidates(['self_harm'], [candidates[0]!])).toEqual(candidates.slice(1))
    expect(orderedSafetyCandidates(['self_harm'], candidates)).toEqual(candidates)
  })

  it('gives every safety flag multiple curated candidates', () => {
    for (const entry of Object.values(SAFETY_CANDIDATE_LIBRARY)) {
      expect(entry.candidates.length).toBeGreaterThanOrEqual(3)
      expect(entry.intendedContext.length).toBeGreaterThan(20)
      expect(entry.caution.length).toBeGreaterThan(20)
    }
  })
})
