/**
 * Local friction detector.
 *
 * Runs in the browser. No network, no keystroke timing, no page or thread
 * content, no identity. It exists to keep the product quiet, and it is not a
 * psychological classifier. Do not present it as one.
 *
 * Crossing the threshold only reveals a chip. It never transmits anything.
 */

export interface DetectorSignal {
  category: SignalCategory
  weight: number
  evidence: string
}

export type SignalCategory =
  | 'directed_insult'
  | 'second_person_accusation'
  | 'absolute_language'
  | 'repeated_punctuation'
  | 'shouting'
  | 'dismissive_imperative'
  | 'quoted_or_self_directed'

export interface DetectorResult {
  score: number
  signals: DetectorSignal[]
  categories: SignalCategory[]
  shouldOfferChip: boolean
}

export const MIN_DRAFT_LENGTH = 20
export const MIN_DISTINCT_CATEGORIES = 2
export const DEFAULT_THRESHOLD = 3

const CONTEMPT_TERMS = [
  'idiot', 'idiotic', 'moron', 'moronic', 'stupid', 'dumb', 'clueless',
  'pathetic', 'worthless', 'incompetent', 'garbage', 'trash', 'joke',
  'shut up', 'grow up', 'get a life', 'nobody asked', 'read the room',
  'embarrassing', 'delusional', 'insufferable',
]

const DISMISSIVE_IMPERATIVES = [
  'shut up', 'grow up', 'get over it', 'get a life', 'give it a rest',
  'do better', 'try again', 'stop talking', 'move on',
]

const PROFANITY = ['fuck', 'shit', 'bastard', 'asshole', 'bitch', 'damn']

/** "you always", "you never", "you clearly", "you people", "did you even" */
const ACCUSATION_PATTERNS: RegExp[] = [
  /\byou (always|never|clearly|obviously|literally|actually)\b/i,
  /\byou people\b/i,
  /\bdid you even\b/i,
  /\byou'?re (just|so|such)\b/i,
  /\bwhat is wrong with you\b/i,
  /\byou don'?t (even|know|understand|care)\b/i,
]

const ABSOLUTES = [/\balways\b/i, /\bnever\b/i, /\bevery time\b/i, /\bnot once\b/i, /\bno one ever\b/i]

function containsAny(haystack: string, needles: string[]): string | null {
  for (const needle of needles) {
    if (haystack.includes(needle)) return needle
  }
  return null
}

function uppercaseRatio(text: string): number {
  const letters = text.replace(/[^A-Za-z]/g, '')
  if (letters.length < 12) return 0
  const upper = letters.replace(/[^A-Z]/g, '').length
  return upper / letters.length
}

/**
 * Quotation is the main false-positive source: people quote the hostile thing
 * they received. Lines inside quotes or starting with ">" are discounted.
 */
function looksQuotedOrSelfDirected(text: string): boolean {
  const quotedLines = text.split('\n').filter((line) => /^\s*>/.test(line)).length
  const hasQuotedSpan = /["“][^"”]{15,}["”]/.test(text)
  const selfDirected = /\bi (am|was|feel|felt|know i|should have)\b/i.test(text)
  return quotedLines > 0 || hasQuotedSpan || selfDirected
}

export function detect(draft: string, threshold: number = DEFAULT_THRESHOLD): DetectorResult {
  const signals: DetectorSignal[] = []
  const lower = draft.toLowerCase()

  const contempt = containsAny(lower, CONTEMPT_TERMS)
  const profanity = containsAny(lower, PROFANITY)
  if (contempt || profanity) {
    signals.push({
      category: 'directed_insult',
      weight: 2,
      evidence: contempt ?? profanity ?? '',
    })
  }

  const accusation = ACCUSATION_PATTERNS.find((pattern) => pattern.test(draft))
  if (accusation) {
    signals.push({
      category: 'second_person_accusation',
      weight: 2,
      evidence: draft.match(accusation)?.[0] ?? '',
    })
  }

  const absolute = ABSOLUTES.find((pattern) => pattern.test(draft))
  if (absolute) {
    signals.push({
      category: 'absolute_language',
      weight: 1,
      evidence: draft.match(absolute)?.[0] ?? '',
    })
  }

  if (/[!?]{2,}/.test(draft)) {
    signals.push({ category: 'repeated_punctuation', weight: 1, evidence: '!! or ??' })
  }

  if (uppercaseRatio(draft) > 0.4) {
    signals.push({ category: 'shouting', weight: 1, evidence: 'sustained uppercase' })
  }

  const imperative = containsAny(lower, DISMISSIVE_IMPERATIVES)
  if (imperative) {
    signals.push({ category: 'dismissive_imperative', weight: 1, evidence: imperative })
  }

  if (looksQuotedOrSelfDirected(draft)) {
    signals.push({ category: 'quoted_or_self_directed', weight: -1, evidence: 'quoted or self-directed' })
  }

  const score = signals.reduce((total, signal) => total + signal.weight, 0)
  const positiveCategories = signals.filter((s) => s.weight > 0).map((s) => s.category)
  const distinctCategories = new Set(positiveCategories)

  const shouldOfferChip =
    draft.trim().length >= MIN_DRAFT_LENGTH &&
    distinctCategories.size >= MIN_DISTINCT_CATEGORIES &&
    score >= threshold

  return {
    score,
    signals,
    categories: [...distinctCategories],
    shouldOfferChip,
  }
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * The gate decides one thing: is this draft worth a single server call.
 *
 * It is not the classifier, and it is deliberately looser than `detect` above.
 * The model behind it is the strict one. A gate tuned to catch wrongdoing is
 * the mistake `detect` encodes: every signal it computes is hostility, so it is
 * blind to thanks, to grief, to good news, and to a reply that is calm on its
 * face. Whether there is a person on the other end is the whole question here.
 *
 * Silence still has to be cheap, so pure logistics never reaches the network.
 */

export type GateReason = 'too_short' | 'logistics' | 'correspondence'

export interface GateResult {
  pass: boolean
  reason: GateReason
  /** What the local pass noticed, so the badge can point at why it appeared. */
  evidence: string[]
}

export const GATE_MIN_LENGTH = 20

/** Task talk. Times, files, confirmations, bare acknowledgement. */
const LOGISTICS_MARKERS: RegExp[] = [
  /\b(invoice|staging|environment|calendar|invite|attached|figures|variance|folder|agenda|spreadsheet|ticket)\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(confirm|check) (whether|if)\b/i,
  // Anchored. An acknowledgement opens a message; mid-sentence these are
  // ordinary English. "We got it" after a hard year is the news itself.
  /^(sounds good|will do|noted|got it|on it)\b/i,
]

/**
 * "Thanks for letting me know." Acknowledgement, not gratitude.
 *
 * Anchored to a single clause on purpose: "Thank you for covering for me last
 * week. I know it cost you your own deadlines" is real thanks and must not
 * match.
 */
const SHORT_ACKNOWLEDGEMENT = /^(thanks|thank you|ok|okay|great|noted|understood|sounds good)\b[^.!?]*[.!?]?$/i

export function gate(draft: string, received?: string): GateResult {
  const text = draft.trim()
  const evidence = detect(text)
    .signals.filter((signal) => signal.weight > 0)
    .map((signal) => signal.evidence)
    .filter((item) => item.length > 0)

  /*
   * The length floor comes first, and an incoming message does not excuse it.
   *
   * It used to sit below an early return that passed anything with context
   * attached, on the reasoning that the weight can live entirely in what
   * arrived. The reasoning is right and the placement was not: on a real
   * thread there is always something above the box, so "Ok." and "Will do."
   * reached the model, and the two keys the product claims to need became one.
   *
   * Proverbs 16:2 says you cannot weigh yourself. It does not say the draft
   * knows nothing. Context changes what a draft means; it cannot make three
   * words into a moment.
   */
  if (text.length < GATE_MIN_LENGTH) {
    return { pass: false, reason: 'too_short', evidence }
  }

  /*
   * Past the length floor, what arrived can carry the decision. A reply to a
   * decline letter is calm on its face and the weight sits in the letter, so
   * "Thanks for letting me know" is a moment when a rejection sits above it
   * and nothing at all when it does not.
   *
   * The task-talk markers stay below this line on purpose. They are a blunt
   * pre-network filter, and blunt is safe for a draft standing alone but not
   * for one inside a thread: "Be with your family, Priya. I can carry
   * Thursday for you" is vetoed by the weekday in it. A wasted call on task
   * talk costs a few neurons. A missed moment costs the thing the product is
   * for, and the model is silent on task talk anyway.
   */
  if (received && received.trim().length > 0) {
    return { pass: true, reason: 'correspondence', evidence }
  }

  if (SHORT_ACKNOWLEDGEMENT.test(text) || LOGISTICS_MARKERS.some((pattern) => pattern.test(text))) {
    return { pass: false, reason: 'logistics', evidence }
  }

  return { pass: true, reason: 'correspondence', evidence }
}

/**
 * Does the draft carry anything of its own?
 *
 * Distinct from `gate`, which asks whether a call is worth making. This asks
 * whether the words in the box show any signal at all, and it is the
 * difference between a moment that needs guarding and a moment that has
 * already been met. Offering to rewrite a gracious reply tells someone who
 * behaved well that they did not.
 */
export function carriesOwnSignal(draft: string): boolean {
  return detect(draft).signals.some((signal) => signal.weight > 0)
}

/**
 * A draft is "materially changed" once enough of it differs that re-offering
 * the chip is not nagging. Prevents the chip reappearing on every keystroke.
 */
export function isMateriallyChanged(previous: string, next: string): boolean {
  if (previous === next) return false
  const shorter = Math.min(previous.length, next.length)
  const longer = Math.max(previous.length, next.length)
  if (longer === 0) return false
  return (longer - shorter) / longer > 0.25 || !next.startsWith(previous.slice(0, shorter))
}
