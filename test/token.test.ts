import { describe, expect, it } from 'vitest'
import { digestDraft, signAnalysisToken, verifyAnalysisToken } from '../src/security/token'

const KEY = 'test-signing-key-not-a-real-secret'
const DRAFT = 'You clearly have no idea what you are talking about.'

const payload = {
  goal: 'Correct a claim without being dismissed',
  principle: 'gentle_answer' as const,
  referenceId: 'PRO.15.1',
  bibleId: '111',
}

async function tokenFor(draft: string, ttl?: number) {
  return signAnalysisToken({ ...payload, draftDigest: await digestDraft(draft, KEY) }, KEY, ttl)
}

describe('analysis token', () => {
  it('round-trips a valid token', async () => {
    const result = await verifyAnalysisToken(await tokenFor(DRAFT), DRAFT, KEY)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.principle).toBe('gentle_answer')
      expect(result.payload.referenceId).toBe('PRO.15.1')
    }
  })

  it('rejects a token signed with a different key', async () => {
    const forged = await signAnalysisToken(
      { ...payload, draftDigest: await digestDraft(DRAFT, 'other-key') },
      'other-key',
    )
    const result = await verifyAnalysisToken(forged, DRAFT, KEY)
    expect(result).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a rewrite of a draft that was never analysed', async () => {
    const token = await tokenFor(DRAFT)
    const result = await verifyAnalysisToken(token, 'A completely different message.', KEY)
    expect(result).toEqual({ ok: false, reason: 'draft_mismatch' })
  })

  it('rejects an expired token', async () => {
    const token = await tokenFor(DRAFT, -1)
    const result = await verifyAnalysisToken(token, DRAFT, KEY)
    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  it('rejects malformed input', async () => {
    expect(await verifyAnalysisToken('nonsense', DRAFT, KEY)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('ignores surrounding whitespace when binding the draft', async () => {
    const token = await tokenFor(DRAFT)
    const result = await verifyAnalysisToken(token, `  ${DRAFT}  `, KEY)
    expect(result.ok).toBe(true)
  })

  it('never carries the draft itself', async () => {
    const token = await tokenFor(DRAFT)
    const body = atob(token.split('.')[0]!.replace(/-/g, '+').replace(/_/g, '/'))
    expect(body).not.toContain('no idea what you are talking about')
  })
})
