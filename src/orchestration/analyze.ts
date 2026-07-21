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
import { PRINCIPLE_LIBRARY, experienceForPrinciple, isAllowedReference, orderedCandidates, orderedSafetyCandidates } from '../lib/scripture-library'
import { detectExplicitSafety } from '../lib/safety'
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

/**
 * Shown when a draft signals self-harm, abuse, a threat or crisis.
 *
 * Deliberately not a passage and not a rewrite. It is gentle, it changes
 * nothing, and it points outward to a person rather than to a verse.
 *
 * REVIEW BEFORE SUBMISSION: for a self-harm disclosure a real product should
 * name a verified crisis line for the reader's region (in South Africa, SADAG,
 * 0800 567 567). That is a content and locale decision for the builder to make
 * and verify; a wrong number is worse than none, so none is hard-coded here.
 */
const SAFETY_MESSAGE =
  'Before we do anything with these words: you are not alone, and your life is more precious than this conversation. ' +
  'Second Word will not turn this into a rewrite. Please step toward someone you trust or local emergency or crisis support, and let them be with you now. ' +
  'Second Word is a reflection aid, not professional or emergency help.'

export async function runAnalyze(
  request: AnalyzeRequest,
  deps: AnalyzeDeps,
): Promise<AnalyzeOutcome> {
  const now = deps.now ?? Date.now
  const startedAt = now()
  const requestId = (deps.requestId ?? defaultRequestId)()
  const bibleId = request.translation_id ?? deps.defaultBibleId
  const locale = request.locale ?? deps.defaultLocale

  const explicitSafetyFlags = detectExplicitSafety(`${request.draft}\n${request.received_message ?? ''}`)
  if (explicitSafetyFlags.length > 0) {
    return safetyOutcome(explicitSafetyFlags, request, deps, bibleId, requestId, startedAt, now)
  }

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
    return safetyOutcome(analysis.safety_flags, request, deps, bibleId, requestId, startedAt, now)
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
  // Publisher attribution is part of the provenance contract. An unavailable
  // metadata record is not an excuse to render unlabeled Scripture.
  if (!bible) return { kind: 'unverifiable', attemptedCount }
  const entry = PRINCIPLE_LIBRARY[analysis.principle]
  const experience = experienceForPrinciple(analysis.principle)

  // Guide is a blessing, not an edit. Do not mint a rewrite credential the
  // server will refuse and the UI will never offer.
  let analysisToken: string | undefined
  if (experience === 'guard') {
    const draftDigest = await digestDraft(request.draft, deps.signingKey)
    analysisToken = await signAnalysisToken(
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
  }

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
      translation: bible.localizedAbbreviation,
      attribution: buildAttribution(bible),
      attribution_url: bible.deepLink,
      // Provider prose is analysis, not product copy. The person sees only
      // reviewed language written for this principle; model commentary such
      // as "the user is..." can never leak into the card.
      why: entry.explanation,
      ...(experience === 'guard' ? { question: entry.question } : {}),
      ...(analysisToken ? { analysis_token: analysisToken } : {}),
      experience,
      safety_flags: [],
      source: attemptedCount === 1 ? 'model_ranked_reviewed_library' : 'fallback_secondary_candidate',
      provider: deps.model.provider,
      latency_ms: now() - startedAt,
    },
  }
}

async function safetyOutcome(
  flags: SafetyResponse['safety_flags'],
  request: AnalyzeRequest,
  deps: AnalyzeDeps,
  bibleId: string,
  requestId: string,
  startedAt: number,
  now: () => number,
): Promise<AnalyzeOutcome> {
  const candidates = orderedSafetyCandidates(flags, request.recent_reference_ids)
  const comfort = await deps.youversion.resolveFirst(bibleId, candidates).catch(() => null)
  const bible = comfort ? await deps.youversion.getBible(bibleId).catch(() => null) : null
  return {
    kind: 'safety',
    body: {
      request_id: requestId,
      safety_flags: flags,
      message: SAFETY_MESSAGE,
      ...(comfort && bible ? {
        verse_text: comfort.passage.content,
        display_reference: comfort.passage.displayReference,
        translation: bible.localizedAbbreviation,
        comfort_reference_id: comfort.passage.referenceId,
        bible_id: bibleId,
        attribution: buildAttribution(bible),
        attribution_url: bible.deepLink,
      } : {}),
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
