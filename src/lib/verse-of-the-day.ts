import type { VerseOfTheDayResponse } from './contracts'

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
