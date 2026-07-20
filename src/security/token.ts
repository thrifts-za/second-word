/**
 * Short-lived signed analysis token.
 *
 * Binds /v1/rewrite to a prior /v1/analyze. Without it, anyone could ask for a
 * rewrite under a principle that was never selected for their draft, which
 * would break the claim that the rewrite is downstream of the passage.
 *
 * The token carries validated classifications only. It never carries the draft.
 * The draft is bound by a keyed digest, so a modified draft fails.
 */

import type { Principle } from '../lib/contracts'

export interface AnalysisTokenPayload {
  goal: string
  principle: Principle
  referenceId: string
  bibleId: string
  /** Keyed digest of the draft this analysis was performed on. */
  draftDigest: string
  /**
   * Keyed digest of the message being replied to, when there was one.
   *
   * Without this a rewrite could be requested under a principle chosen for a
   * completely different incoming message, which would untether it from the
   * situation the passage was selected for.
   */
  contextDigest?: string
  /** Unix seconds. */
  exp: number
}

export const TOKEN_TTL_SECONDS = 600

const encoder = new TextEncoder()

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Keyed digest of a draft. Not reversible, and useless without the key. */
export async function digestDraft(draft: string, secret: string): Promise<string> {
  const key = await importKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(draft.trim()))
  return base64UrlEncode(new Uint8Array(signature))
}

export async function signAnalysisToken(
  payload: Omit<AnalysisTokenPayload, 'exp'>,
  secret: string,
  ttlSeconds: number = TOKEN_TTL_SECONDS,
): Promise<string> {
  const full: AnalysisTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = base64UrlEncode(encoder.encode(JSON.stringify(full)))
  const key = await importKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`
}

export type TokenFailure =
  | 'malformed'
  | 'bad_signature'
  | 'expired'
  | 'draft_mismatch'
  | 'context_mismatch'

export type VerifyResult =
  | { ok: true; payload: AnalysisTokenPayload }
  | { ok: false; reason: TokenFailure }

export async function verifyAnalysisToken(
  token: string,
  draft: string,
  secret: string,
  received?: string,
): Promise<VerifyResult> {
  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false, reason: 'malformed' }
  const [body, signature] = parts as [string, string]

  let valid: boolean
  try {
    const key = await importKey(secret)
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(body),
    )
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!valid) return { ok: false, reason: 'bad_signature' }

  let payload: AnalysisTokenPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as AnalysisTokenPayload
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  if (payload.exp * 1000 < Date.now()) return { ok: false, reason: 'expired' }

  const expected = await digestDraft(draft, secret)
  if (expected !== payload.draftDigest) return { ok: false, reason: 'draft_mismatch' }

  // Only enforced when the analysis actually saw an incoming message, so
  // tokens issued before this existed keep verifying.
  if (payload.contextDigest !== undefined) {
    const expectedContext = await digestDraft(received ?? '', secret)
    if (expectedContext !== payload.contextDigest) {
      return { ok: false, reason: 'context_mismatch' }
    }
  }

  return { ok: true, payload }
}
