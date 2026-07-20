/**
 * /v1/rewrite orchestration.
 *
 * Only reachable with a valid analysis token, which means: this draft was
 * analysed, this principle was selected for it, and the draft has not changed
 * since. That is what makes the rewrite provably downstream of the passage.
 */

import type { ReflectionModel } from '../clients/model'
import type { RewriteRequest, RewriteResponse, RewriteMode } from '../lib/contracts'
import { isAllowedReference } from '../lib/scripture-library'
import { verifyAnalysisToken, type TokenFailure } from '../security/token'

export type RewriteOutcome =
  | { kind: 'ok'; body: RewriteResponse }
  | { kind: 'rejected'; reason: TokenFailure | 'reference_not_allowed' }

export interface RewriteDeps {
  model: ReflectionModel
  signingKey: string
  defaultLocale: string
  now?: () => number
}

export async function runRewrite(
  request: RewriteRequest,
  deps: RewriteDeps,
): Promise<RewriteOutcome> {
  const now = deps.now ?? Date.now
  const startedAt = now()

  const verified = await verifyAnalysisToken(
    request.analysis_token,
    request.draft,
    deps.signingKey,
    request.received_message,
  )
  if (!verified.ok) return { kind: 'rejected', reason: verified.reason }

  const { goal, principle, referenceId } = verified.payload

  // Defence in depth: a token is only issued for a reviewed reference, but the
  // library can change between deploys and a stale token must not slip through.
  if (!isAllowedReference(referenceId)) {
    return { kind: 'rejected', reason: 'reference_not_allowed' }
  }

  const rewrites = await deps.model.rewrite({
    draft: request.draft,
    goal,
    principle,
    modes: request.modes,
    locale: deps.defaultLocale,
  })

  // Return only what the client asked for.
  const selected: Partial<Record<RewriteMode, string>> = {}
  for (const mode of request.modes) selected[mode] = rewrites[mode]

  return {
    kind: 'ok',
    body: {
      rewrites: selected,
      goal_preserved: rewrites.goal_preserved,
      register_preserved: rewrites.register_preserved,
      principle,
      provider: deps.model.provider,
      latency_ms: now() - startedAt,
    },
  }
}
