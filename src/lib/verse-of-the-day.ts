import type { VerseOfTheDayResponse } from './contracts'

/**
 * A verse cut out of a longer quotation keeps the marks of the sentence it came
 * from. Jeremiah 31:25 arrives as `I will refresh the weary and satisfy the
 * faint.”` - a closer with no opener anywhere in the verse. Rendered on a card
 * that reads as a typo in Scripture rather than as a quotation continuing.
 *
 * Drop only a mark that has no partner, and only at the ends. No word, no
 * space and no punctuation inside the verse is touched.
 */
export function balanceQuotes(text: string): string {
  let out = text.trim()
  const occurrences = (mark: string): number => out.split(mark).length - 1
  while (out.endsWith('”') && occurrences('”') > occurrences('“')) {
    out = out.slice(0, -1).trimEnd()
  }
  while (out.startsWith('“') && occurrences('“') > occurrences('”')) {
    out = out.slice(1).trimStart()
  }
  return out
}

/** Runtime boundary for a configurable backend response, kept browser-small. */
export function isVerseOfTheDayResponse(value: unknown): value is VerseOfTheDayResponse {
  if (!value || typeof value !== 'object') return false
  const body = value as Record<string, unknown>
  return (
    Number.isInteger(body.day) &&
    typeof body.verified_reference_id === 'string' &&
    typeof body.display_reference === 'string' &&
    typeof body.verse_text === 'string' &&
    body.verse_text.length > 0 &&
    typeof body.bible_id === 'string' &&
    typeof body.translation === 'string' &&
    typeof body.attribution === 'string' &&
    body.attribution.length > 0 &&
    (body.attribution_url === null || typeof body.attribution_url === 'string') &&
    body.source === 'youversion_verse_of_the_day'
  )
}
