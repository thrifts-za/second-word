// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VerseOfTheDayResponse } from '../src/lib/contracts'
import { SecondWordPanel } from '../src/ui/panel'

const verse: VerseOfTheDayResponse = {
  day: 203,
  verified_reference_id: 'PSA.23.4',
  display_reference: 'Psalm 23:4',
  verse_text: 'Even though I walk through the darkest valley, I will fear no evil.”',
  bible_id: '111',
  translation: 'NIV',
  attribution: 'The Holy Bible, New International Version. Copyright Biblica.',
  attribution_url: 'https://www.bible.com/versions/111',
  source: 'youversion_verse_of_the_day',
}

function panel(onClose = vi.fn()): SecondWordPanel {
  return new SecondWordPanel({
    onAnalyze: async () => { throw new Error('not used') },
    onRewrite: async () => { throw new Error('not used') },
    onReplace: () => '',
    onClose,
  })
}

beforeEach(() => document.body.replaceChildren())

describe('Verse of the Day Presence', () => {
  it('renders only after the quiet composer mark is opened', () => {
    const subject = panel()
    subject.presentVerseOfTheDay(verse)
    expect(subject.host.shadowRoot?.textContent).toContain('Verse of the Day')
    expect(subject.host.shadowRoot?.textContent).toContain('Psalm 23:4')
    expect(subject.host.shadowRoot?.textContent).toContain('I will fear no evil.')
    expect(subject.host.shadowRoot?.textContent).not.toContain('evil.”')
  })

  it('collapses the full publisher notice under References by default', () => {
    const subject = panel()
    subject.presentVerseOfTheDay(verse)
    const disclosure = subject.host.shadowRoot?.querySelector('details')
    expect(disclosure?.open).toBe(false)
    expect(disclosure?.querySelector('summary')?.textContent).toBe('References')
    expect(disclosure?.textContent).toContain('Copyright Biblica')
    expect(disclosure?.querySelector('a')?.href).toBe('https://www.bible.com/versions/111')
  })

  it('returns to the message without editing it', () => {
    const onClose = vi.fn()
    const subject = panel(onClose)
    subject.presentVerseOfTheDay(verse)
    subject.host.shadowRoot?.querySelector<HTMLButtonElement>('.action')?.click()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
