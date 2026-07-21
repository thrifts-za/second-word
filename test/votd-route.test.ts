import { afterEach, describe, expect, it, vi } from 'vitest'
import app, { type Env } from '../src/index'

const env: Env = {
  YOUVERSION_APP_KEY: 'public-app-key',
  DEFAULT_BIBLE_ID: '111',
  DEFAULT_LOCALE: 'en',
  ALLOWED_ORIGINS: 'https://second-word.pages.dev',
}

afterEach(() => vi.unstubAllGlobals())

describe('GET /v1/verse-of-the-day', () => {
  it('resolves YouVersion\'s daily selection through verified text and attribution', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.endsWith('/verse_of_the_days/203')) {
        return Response.json({ day: 203, passage_id: 'PSA.23.4' })
      }
      if (url.endsWith('/bibles/111/passages/PSA.23.4')) {
        return Response.json({ id: 'PSA.23.4', reference: 'Psalm 23:4', content: 'I will fear no evil.' })
      }
      if (url.endsWith('/bibles/111')) {
        return Response.json({
          id: 111,
          localized_abbreviation: 'NIV',
          localized_title: 'New International Version',
          copyright: 'Copyright Biblica.',
          youversion_deep_link: 'https://www.bible.com/versions/111',
        })
      }
      return new Response(null, { status: 404 })
    }))

    const response = await app.request('/v1/verse-of-the-day?day=203', {}, env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      day: 203,
      verified_reference_id: 'PSA.23.4',
      display_reference: 'Psalm 23:4',
      verse_text: 'I will fear no evil.',
      translation: 'NIV',
      attribution: 'Copyright Biblica.',
      source: 'youversion_verse_of_the_day',
    })
  })

  it('rejects an invalid day without calling YouVersion', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchImpl)
    const response = await app.request('/v1/verse-of-the-day?day=367', {}, env)
    expect(response.status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
