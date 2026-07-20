/**
 * /v1/analyze orchestration.
 *
 * draft -> Gloo (goal, principle, ranked candidates) -> allow-list validation
 *       -> YouVersion verification and fetch -> signed token -> passage + question
 *
 * Fail closed. If no reviewed candidate resolves, nothing renders.
 */

import type { ReflectionModel } from '../clients/model'
import type { YouVersionClient } from '../clients/youversion'
import type { AnalyzeRequest, AnalyzeResponse, NoMomentResponse, SafetyResponse } from '../lib/contracts'
import { PRINCIPLE_LIBRARY, isAllowedReference, orderedCandidates } from '../lib/scripture-library'
import { digestDraft, signAnalysisToken } from '../security/token'

export type AnalyzeOutcome =
  | { kind: 'ok'; body: AnalyzeResponse }
  | { kind: 'safety'; body: SafetyResponse }
  | { kind: 'no_moment'; body: NoMomentResponse }
  | { kind: 'unverifiable'; attemptedCount: number }

export interface AnalyzeDeps {
  model: ReflectionModel
  youversion: YouVersionClient
  signingKey: string
  defaultBibleId: string
  defaultLocale: string
  now?: () => number
  requestId?: () => string
}

const SAFETY_MESSAGE =
  'This looks like a heavier moment than a rewrite can help with. Your draft has not been changed.'

export async function runAnalyze(
  request: AnalyzeRequest,
  deps: AnalyzeDeps,
): Promise<AnalyzeOutcome> {
  const now = deps.now ?? Date.now
  const startedAt = now()
  const requestId = (deps.requestId ?? defaultRequestId)()
  const bibleId = request.translation_id ?? deps.defaultBibleId
  const locale = request.locale ?? deps.defaultLocale

  const analysis = await deps.model.analyze({
    draft: request.draft,
    locale,
    context: request.context,
    receivedMessage: request.received_message,
    principleHint: request.principle_hint,
  })

  // Nothing at stake here. Say so and stop, rather than reaching for a
  // passage to justify having been opened. No YouVersion call is made.
  if (!analysis.needs_reflection) {
    return {
      kind: 'no_moment',
      body: {
        request_id: requestId,
        needs_reflection: false,
        message: 'Nothing here needs a second thought. Your draft has not been changed.',
        provider: deps.model.provider,
        latency_ms: now() - startedAt,
      },
    }
  }

  // A heavy moment gets care, not a tone rewrite. Spec section 16.3.
  if (analysis.safety_flags.length > 0) {
    return {
      kind: 'safety',
      body: {
        request_id: requestId,
        safety_flags: analysis.safety_flags,
        message: SAFETY_MESSAGE,
        provider: deps.model.provider,
        latency_ms: now() - startedAt,
      },
    }
  }

  // The model ranks. It never introduces. Anything outside the reviewed
  // library for this principle is dropped here, before it can reach a fetch.
  const ranked = analysis.candidate_reference_ids.filter(isAllowedReference)
  const candidates = orderedCandidates(analysis.principle, ranked)

  const resolved = await deps.youversion.resolveFirst(bibleId, candidates)
  if (!resolved) {
    return { kind: 'unverifiable', attemptedCount: candidates.length }
  }

  const { passage, attemptedCount } = resolved
  const bible = await deps.youversion.getBible(bibleId).catch(() => null)
  const entry = PRINCIPLE_LIBRARY[analysis.principle]

  const draftDigest = await digestDraft(request.draft, deps.signingKey)
  const analysisToken = await signAnalysisToken(
    {
      goal: analysis.goal,
      principle: analysis.principle,
      referenceId: passage.referenceId,
      bibleId,
      draftDigest,
      // Only bound when there was one, so the rewrite route stays reachable
      // for drafts analysed on their own.
      ...(request.received_message !== undefined
        ? { contextDigest: await digestDraft(request.received_message, deps.signingKey) }
        : {}),
    },
    deps.signingKey,
  )

  return {
    kind: 'ok',
    body: {
      request_id: requestId,
      goal: analysis.goal,
      principle: analysis.principle,
      verified_reference_id: passage.referenceId,
      display_reference: passage.displayReference,
      // The only source of verse text in the system.
      verse_text: passage.content,
      bible_id: bibleId,
      translation: bible?.localizedAbbreviation ?? '',
      attribution: buildAttribution(bible),
      attribution_url: bible?.deepLink ?? null,
      why: analysis.why || entry.explanation,
      question: analysis.question || entry.question,
      analysis_token: analysisToken,
      safety_flags: [],
      source: attemptedCount === 1 ? 'model_ranked_reviewed_library' : 'fallback_secondary_candidate',
      provider: deps.model.provider,
      latency_ms: now() - startedAt,
    },
  }
}

/**
 * The publisher copyright, which the licence requires us to display.
 *
 * It comes from GET /bibles/{id}. The list endpoint returns copyright: null,
 * which is what made this look unavailable at first. See docs/api-notes.md.
 * Falling back to the translation name is a last resort, not the norm.
 */
function buildAttribution(bible: { localizedTitle: string; copyright: string | null } | null): string {
  if (!bible) return ''
  return bible.copyright ?? bible.localizedTitle
}

function defaultRequestId(): string {
  return `req_${crypto.randomUUID().slice(0, 12)}`
}
