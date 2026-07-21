// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SecondWordPresence } from '../extension/src/presence'
import type { VerseOfTheDayResponse } from '../src/lib/contracts'

const verse: VerseOfTheDayResponse = {
  day: 203,
  verified_reference_id: 'PSA.23.4',
  display_reference: 'Psalm 23:4',
  verse_text: 'Even though I walk through the darkest valley, I will fear no evil.',
  bible_id: '111',
  translation: 'NIV',
  attribution: 'The Holy Bible, New International Version. Copyright Biblica.',
  attribution_url: 'https://www.bible.com/versions/111',
  source: 'youversion_verse_of_the_day',
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.replaceChildren()
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
})

afterEach(() => vi.useRealTimers())

describe('Verse of the Day Presence', () => {
  it('renders outside the editor with visible provenance', () => {
    const field = document.createElement('textarea')
    field.getBoundingClientRect = () =>
      ({ left: 100, top: 100, right: 600, bottom: 220, width: 500, height: 120 }) as DOMRect
    document.body.append(field)

    const presence = new SecondWordPresence(field, verse)
    expect(field.contains(presence.host)).toBe(false)
    expect(presence.host.shadowRoot?.textContent).toContain('Verse of the Day')
    expect(presence.host.shadowRoot?.textContent).toContain('Psalm 23:4')
    expect(presence.host.shadowRoot?.textContent).toContain('Copyright Biblica')
    presence.destroy()
  })

  it('does not cover a composer too small to hold the passage', () => {
    const field = document.createElement('textarea')
    field.getBoundingClientRect = () =>
      ({ left: 100, top: 100, right: 340, bottom: 150, width: 240, height: 50 }) as DOMRect
    document.body.append(field)

    const presence = new SecondWordPresence(field, verse)
    expect(presence.element.style.display).toBe('none')
    presence.destroy()
  })
})
