import { z } from 'zod'

/**
 * Wire contracts and the schema Gloo output must satisfy.
 *
 * Two rules encoded here, both from spec section 6:
 *  - the model returns reference IDs, never verse text
 *  - anything outside the reviewed allow-lists is rejected, not repaired
 */

export const PRINCIPLES = [
  // when the conversation has turned
  'listen_first',
  'gentle_answer',
  'speak_truth_in_love',
  'seek_peace',
  'forgive',
  'refuse_contempt',
  // when something has been done to you
  'bear_false_accusation',
  'receive_correction',
  'meet_disappointment',
  // when you are the one asking, owning, or thanking
  'ask_with_humility',
  'make_amends',
  'give_thanks',
  // when something good has happened
  'receive_good_news',
  'offer_support',
  // when you are speaking near someone else's pain or name
  'comfort_the_grieving',
  'guard_anothers_name',
  // when you are holding a line
  'set_boundary',
  'speak_with_courage',
] as const

export const PrincipleSchema = z.enum(PRINCIPLES)
export type Principle = z.infer<typeof PrincipleSchema>

export const REWRITE_MODES = ['clearer', 'curious', 'firm_and_gracious'] as const
export const RewriteModeSchema = z.enum(REWRITE_MODES)
export type RewriteMode = z.infer<typeof RewriteModeSchema>

/** Safety flags route away from a casual rewrite. See spec section 16. */
export const SAFETY_FLAGS = ['self_harm', 'abuse_disclosure', 'threat', 'crisis'] as const
export const SafetyFlagSchema = z.enum(SAFETY_FLAGS)
export type SafetyFlag = z.infer<typeof SafetyFlagSchema>

/**
 * The safety path is the one that must never fail on a formatting difference.
 *
 * Models write "self-harm", we store "self_harm". Under a strict schema that
 * one character failed the whole analysis, and a genuine crisis message came
 * back as a 503 rather than a caring response. Normalise the separators, and
 * drop a flag we cannot recognise rather than taking the entire reply down
 * with it: losing one label is far better than losing the whole answer to
 * someone in trouble.
 */
const SafetyFlagsSchema = z.preprocess((value) => {
  if (!Array.isArray(value)) return value
  const normalised = value
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase().replace(/[\s-]+/g, '_') : item))
    .filter((item): item is SafetyFlag => (SAFETY_FLAGS as readonly string[]).includes(item as string))
  return [...new Set(normalised)]
}, z.array(SafetyFlagSchema).default([]))

export const MAX_DRAFT_LENGTH = 2000
/** One line of self-declared context, in the person's own words. */
export const MAX_CONTEXT_LENGTH = 240
/**
 * The single message being replied to. Not the thread.
 *
 * Sized for one real email after quoted history and signatures are stripped.
 * Rejected rather than truncated past this: a half-read message is worse
 * evidence than none, because it reads as complete.
 */
export const MAX_RECEIVED_LENGTH = 1200

/**
 * USFM reference, e.g. PRO.15.1, or a range within one chapter, e.g. PRO.4.20-21.
 *
 * Ranges are supported by the platform (verified 2026-07-20) and matter: some
 * verses are sentence fragments alone. 2 Corinthians 1:4 begins "who comforts
 * us", which only parses as part of 1:3-4.
 */
export const ReferenceIdSchema = z
  .string()
  .regex(/^[1-9A-Z]{3}\.\d{1,3}\.\d{1,3}(-\d{1,3})?$/, 'must be a USFM reference like PRO.15.1 or PRO.4.20-21')

// ---------------------------------------------------------------------------
// What Gloo is allowed to return
// ---------------------------------------------------------------------------

/**
 * Note there is no verse_text field, deliberately. The model has no way to
 * hand us Scripture even if it tries: an unknown key fails validation.
 */
export const GlooAnalysisSchema = z
  .object({
    /**
     * False when the draft needs nothing at all.
     *
     * Without this the model must always name a principle, and a calm message
     * gets a passage about disappointment. Silence has to be an available
     * answer or the product is a slot machine with better manners.
     */
    needs_reflection: z.boolean(),
    goal: z.string().min(1).max(200),
    principle: PrincipleSchema,
    candidate_reference_ids: z.array(ReferenceIdSchema).min(1).max(5),
    why: z.string().min(1).max(300),
    question: z.string().min(1).max(160),
    safety_flags: SafetyFlagsSchema,
  })
  .strict()

export type GlooAnalysis = z.infer<typeof GlooAnalysisSchema>

export const GlooRewritesSchema = z
  .object({
    clearer: z.string().min(1).max(2000),
    curious: z.string().min(1).max(2000),
    firm_and_gracious: z.string().min(1).max(2000),
    goal_preserved: z.boolean(),
    register_preserved: z.boolean(),
  })
  .strict()

export type GlooRewrites = z.infer<typeof GlooRewritesSchema>

// ---------------------------------------------------------------------------
// Client requests
// ---------------------------------------------------------------------------

export const AnalyzeRequestSchema = z
  .object({
    draft: z.string().min(1).max(MAX_DRAFT_LENGTH),
    surface: z.enum(['reddit', 'sandbox', 'gmail', 'social', 'email']),
    /** What is happening, in the person's own words. Always typed by them. */
    context: z.string().max(MAX_CONTEXT_LENGTH).optional(),
    /**
     * The message being replied to.
     *
     * Kept apart from `context` because the two have different authors and so
     * different trust. This one is written by someone else, who may have
     * written it to steer us. It is evidence about the situation and never an
     * instruction. See the guard in prompts.ts.
     *
     * Proverbs 16:2: a draft cannot be weighed against itself. What provoked
     * it is where the weight lives.
     */
    received_message: z.string().max(MAX_RECEIVED_LENGTH).optional(),
    /** A moment the person picked themselves, when they invited Second Word. */
    principle_hint: PrincipleSchema.optional(),
    locale: z.string().min(2).max(12).optional(),
    translation_id: z.string().regex(/^\d{1,6}$/).optional(),
    /** Local-only history supplied by the client to avoid canned repetition. */
    recent_reference_ids: z.array(ReferenceIdSchema).max(5).optional(),
  })
  .strict()

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>

export const RewriteRequestSchema = z
  .object({
    draft: z.string().min(1).max(MAX_DRAFT_LENGTH),
    analysis_token: z.string().min(16).max(4096),
    modes: z.array(RewriteModeSchema).min(1).max(3),
    /** Must match what the analysis saw, or the token will not verify. */
    received_message: z.string().max(MAX_RECEIVED_LENGTH).optional(),
  })
  .strict()

export type RewriteRequest = z.infer<typeof RewriteRequestSchema>

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface AnalyzeResponse {
  request_id: string
  goal: string
  principle: Principle
  verified_reference_id: string
  display_reference: string
  verse_text: string
  bible_id: string
  translation: string
  attribution: string
  /** Version page on bible.com. The licence requires visible attribution. */
  attribution_url: string | null
  why: string
  question: string
  analysis_token: string
  /** Guide affirms an existing good moment; Guard supports a consequential one. */
  experience: 'guide' | 'guard'
  safety_flags: SafetyFlag[]
  source: 'model_ranked_reviewed_library' | 'fallback_secondary_candidate'
  /** Which model actually read the draft. Always stated, never inferred. */
  provider: 'gloo' | 'workers-ai' | 'fake'
  latency_ms: number
}

export interface RewriteResponse {
  rewrites: Partial<Record<RewriteMode, string>>
  goal_preserved: boolean
  register_preserved: boolean
  principle: Principle
  provider: 'gloo' | 'workers-ai' | 'fake'
  latency_ms: number
}

/** The draft did not need anything. Silence, stated plainly. */
export interface NoMomentResponse {
  request_id: string
  needs_reflection: false
  message: string
  /** Named on every response, including the silent ones. */
  provider: 'gloo' | 'workers-ai' | 'fake'
  latency_ms: number
}

/** A draft that should receive care rather than a tone rewrite. */
export interface SafetyResponse {
  request_id: string
  safety_flags: SafetyFlag[]
  message: string
  /** Deterministic comfort passage, fetched from YouVersion; absent if unverifiable. */
  verse_text?: string
  display_reference?: string
  translation?: string
  comfort_reference_id?: string
  bible_id?: string
  attribution?: string
  attribution_url?: string | null
  provider: 'gloo' | 'workers-ai' | 'fake'
  latency_ms: number
}
