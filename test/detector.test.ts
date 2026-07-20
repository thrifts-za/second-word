import { describe, expect, it } from 'vitest'
import { detect, isMateriallyChanged } from '../src/lib/detector'

describe('local friction detector', () => {
  it('offers the chip on a directed, accusatory draft', () => {
    const result = detect('You clearly have no idea what you are talking about, this is idiotic')
    expect(result.shouldOfferChip).toBe(true)
    expect(result.categories).toContain('second_person_accusation')
    expect(result.categories).toContain('directed_insult')
  })

  it('stays silent on ordinary disagreement', () => {
    const result = detect('I read the source differently, it says the deadline moved to March.')
    expect(result.shouldOfferChip).toBe(false)
  })

  it('stays silent on a short draft even when hostile', () => {
    // Below MIN_DRAFT_LENGTH. Not enough to act on.
    expect(detect('you idiot').shouldOfferChip).toBe(false)
  })

  it('requires two distinct signal categories, not one loud one', () => {
    const result = detect('THIS IS COMPLETELY AND UTTERLY WRONG IN EVERY WAY POSSIBLE')
    expect(result.categories.length).toBeLessThan(2)
    expect(result.shouldOfferChip).toBe(false)
  })

  it('discounts hostility the user is quoting rather than writing', () => {
    const quoting = detect('> you always do this and you are clueless\n\nThat is what he sent me.')
    const writing = detect('you always do this and you are clueless, honestly')
    expect(quoting.score).toBeLessThan(writing.score)
  })

  it('discounts self-directed reflection', () => {
    const result = detect('I know I always do this and I feel stupid about it afterwards.')
    expect(result.shouldOfferChip).toBe(false)
  })

  it('never inspects anything but the draft it was given', () => {
    // Guard against future signals that reach outside the composer.
    const result = detect('You never listen and it is pathetic!!')
    for (const signal of result.signals) {
      expect(signal.evidence.length).toBeLessThan(60)
    }
  })
})

describe('material change', () => {
  it('treats continued typing as the same draft', () => {
    expect(isMateriallyChanged('you always do this', 'you always do this and')).toBe(false)
  })

  it('treats a rewritten opening as a new draft', () => {
    expect(isMateriallyChanged('you always do this', 'I think there is a misunderstanding')).toBe(true)
  })

  it('ignores an unchanged draft', () => {
    expect(isMateriallyChanged('same text', 'same text')).toBe(false)
  })
})
