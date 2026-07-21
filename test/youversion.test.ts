import { describe, expect, it, vi } from 'vitest'
import { YouVersionClient, YouVersionError } from '../src/clients/youversion'

describe('YouVersion Verse of the Day', () => {
  it('fetches YouVersion\'s selected passage ID for a calendar day', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      expect(String(input)).toBe('https://api.youversion.com/v1/verse_of_the_days/203')
      return Response.json({ day: 203, passage_id: 'PSA.23.4' })
    })
    const client = new YouVersionClient('public-app-key', fetchImpl)

    await expect(client.getVerseOfTheDay(203)).resolves.toEqual({ day: 203, passageId: 'PSA.23.4' })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('fails closed on an incomplete or mismatched selection', async () => {
    const client = new YouVersionClient(
      'public-app-key',
      async () => Response.json({ day: 202, passage_id: 'PSA.23.4' }),
    )
    await expect(client.getVerseOfTheDay(203)).resolves.toBeNull()
  })

  it('rejects an impossible calendar day before making a request', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const client = new YouVersionClient('public-app-key', fetchImpl)
    await expect(client.getVerseOfTheDay(0)).rejects.toBeInstanceOf(YouVersionError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
