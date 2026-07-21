import type { Principle, SafetyFlag } from './contracts'

/**
 * The reviewed library.
 *
 * This is not a list of ways to be less rude. It is a taxonomy of the moments
 * in ordinary correspondence where what you say costs something: being turned
 * down, being blamed for what you did not do, being corrected, asking for
 * help, saying sorry, saying thank you, speaking to someone who is grieving,
 * speaking about someone who is not there.
 *
 * Conflict is one section of it, not the whole thing.
 *
 * Gloo may only rank inside this. It cannot introduce a reference, which keeps
 * the theological scope auditable and the demo unbreakable.
 *
 * `constraint` is original prose describing how a rewrite must behave under
 * this principle. It is never copied verse text, and it is what makes the
 * rewrite causally downstream of the passage rather than decorated by it.
 */
export interface PrincipleEntry {
  principle: Principle
  /** Reviewed USFM candidates, best fit first. All verified live against the platform. */
  candidates: string[]
  /** Behavioural constraint applied to any rewrite. Original prose. */
  constraint: string
  /**
   * Shown in the UI under the passage. Written to be the sentence someone
   * remembers.
   *
   * Must read true whether the box is empty or already holds a finished
   * reply. "You still have to write back" fails that: it is stale the moment
   * somebody has written back, and it made the card look canned when the same
   * moment came round twice.
   */
  explanation: string
  /** Optional reviewed gloss matched to the passage actually shown. */
  explanationsByReference?: Partial<Record<string, string>>
  /** Default reflection question when the model does not supply a better one. */
  question: string
  /** Optional reviewed question matched to the passage actually shown. */
  questionsByReference?: Partial<Record<string, string>>
  /** Plain-language moment, shown when a person is choosing a situation themselves. */
  moment: string
}

export const PRINCIPLE_LIBRARY: Record<Principle, PrincipleEntry> = {
  // --- when the conversation has turned -------------------------------------

  listen_first: {
    principle: 'listen_first',
    candidates: ['JAS.1.19', 'PRO.18.13'],
    constraint: 'Ask or acknowledge before asserting. Do not answer a point that has not been understood.',
    explanation: 'You are answering faster than you are hearing.',
    question: 'What might they be saying that you have not heard yet?',
    moment: 'I am replying before I have really understood them',
  },
  gentle_answer: {
    principle: 'gentle_answer',
    candidates: ['PRO.15.1', 'PRO.25.15', 'COL.4.6'],
    constraint: 'Lower the verbal force without deleting the claim. The disagreement survives intact.',
    explanation: 'The point can survive without the heat carrying it.',
    question: 'What do you want to be true after you send this?',
    moment: 'This is getting heated',
  },
  speak_truth_in_love: {
    principle: 'speak_truth_in_love',
    candidates: ['EPH.4.15', 'PRO.27.6', 'GAL.6.1'],
    constraint: 'Preserve the truth being told. Remove language that demeans the person being told it.',
    explanation: 'The truth here is worth keeping. The way it lands is still yours to choose.',
    question: 'Is this said so it can be heard, or so it can be felt?',
    moment: 'I have something hard and true to say',
  },
  seek_peace: {
    principle: 'seek_peace',
    candidates: ['ROM.12.18', 'MAT.5.9', 'HEB.12.14'],
    constraint: 'Offer a constructive next step where one exists. Do not close a door that could stay open.',
    explanation: 'This can end the conversation or open it.',
    question: 'Do you want to be finished with this, or done with them?',
    moment: 'I want this to stop escalating',
  },
  forgive: {
    principle: 'forgive',
    candidates: ['COL.3.13', 'EPH.4.32', 'MAT.6.14'],
    constraint: 'Avoid retaliation and score-settling. Do not reintroduce an old grievance as ammunition.',
    explanation: 'You are answering something older than this message.',
    question: 'Is this about what they just said, or about what they said before?',
    moment: 'I am still carrying the last time',
  },
  refuse_contempt: {
    principle: 'refuse_contempt',
    candidates: ['EPH.4.29', 'PRO.12.18', 'JAS.3.9'],
    constraint: 'Remove language whose only function is to wound. Keep every part that carries meaning.',
    explanation: 'Part of this is aimed at the argument. Part of it is aimed at them.',
    question: 'Which part of this is for the point, and which part is for the sting?',
    moment: 'I want them to feel it',
  },

  // --- when something has been done to you ----------------------------------

  bear_false_accusation: {
    principle: 'bear_false_accusation',
    candidates: ['1PE.2.23', 'PSA.37.6', 'PRO.13.10'],
    constraint:
      'State the facts plainly and completely. Do not counter-accuse, do not perform innocence, and do not concede fault that is not yours.',
    explanation: 'You are being blamed for something you did not do, and you have to answer anyway.',
    question: 'Can you tell the truth here without needing them to admit they were wrong?',
    moment: 'I am being blamed for something I did not do',
  },
  receive_correction: {
    principle: 'receive_correction',
    candidates: ['PRO.15.31', 'PRO.12.1', 'PRO.17.27'],
    constraint:
      'Acknowledge the part that is fair before answering the part that is not. Do not defend everything at once.',
    explanation: 'Some of this is fair and some of it is not, and the reply has to hold both.',
    question: 'What is true in what they said?',
    moment: 'I have been criticised and some of it lands',
  },
  meet_disappointment: {
    principle: 'meet_disappointment',
    candidates: ['PRO.16.9', 'PSA.27.14', 'LAM.3.26'],
    constraint:
      'Keep the reply short and steady. No bitterness, no false brightness, and no pleading for a decision that has been made.',
    explanation: 'The answer was no, and the reply is yours either way.',
    explanationsByReference: {
      'PRO.16.9': 'The plan was yours. The decision was not.',
      'PSA.27.14': 'Nothing here has to be settled in the next five minutes.',
      'LAM.3.26': 'This one is allowed to just be disappointing.',
    },
    question: 'Who do you want to be to these people a year from now?',
    questionsByReference: {
      'PRO.16.9': 'What response would let you leave this decision without giving it the final word?',
      'PSA.27.14': 'What would patience look like in the reply you send now?',
      'LAM.3.26': 'What can remain unsaid while you let this disappointment settle?',
    },
    moment: 'I have been turned down or rejected',
  },

  // --- when you are the one asking, owning, or thanking ---------------------

  ask_with_humility: {
    principle: 'ask_with_humility',
    candidates: ['PHP.4.6', 'PRO.16.3'],
    constraint:
      'Ask plainly for what is actually needed. No manufactured urgency, no guilt, and no apologising for asking.',
    explanation: 'You are asking for something, and the asking is the hard part.',
    question: 'What are you actually asking for?',
    moment: 'I am asking for something I need',
  },
  trust_in_provision: {
    principle: 'trust_in_provision',
    candidates: ['MAT.6.25-26', 'PHP.4.19', 'PHP.4.6'],
    constraint:
      'Name the real need and make the practical request plainly. Do not add shame, panic, false certainty, or promises the person cannot keep.',
    explanation: 'You are carrying a real need, and it is not outside God\'s care.',
    explanationsByReference: {
      'MAT.6.25-26': 'You are carrying a real need, and Jesus speaks directly to the fear that there will not be enough.',
      'PHP.4.19': 'What you need is real, and it is not outside God\'s care.',
      'PHP.4.6': 'This need does not have to remain a private weight. You can bring the request to God too.',
    },
    question: 'Can you name what you need without carrying all of tomorrow at once?',
    questionsByReference: {
      'MAT.6.25-26': 'Can you ask plainly for the time you need without carrying all of tomorrow at once?',
      'PHP.4.19': 'What is the practical help you need to ask for today?',
      'PHP.4.6': 'What would you ask God for as plainly as you are asking for time here?',
    },
    moment: 'I am under financial pressure or facing a real material need',
  },
  make_amends: {
    principle: 'make_amends',
    candidates: ['MAT.5.23-24', 'PRO.28.13', 'JAS.5.16'],
    constraint:
      'Name what was done without hedging it. No conditional apology, no reversal halfway through, no explanation that quietly becomes a defence.',
    explanation: 'An apology with a reason attached stops being an apology.',
    question: 'Are you saying sorry, or explaining why you should not have to?',
    moment: 'I need to apologise',
  },
  give_thanks: {
    principle: 'give_thanks',
    candidates: ['1TH.5.18', 'COL.3.17'],
    constraint: 'Be specific about what was done and what it cost them. Do not inflate it into flattery.',
    explanation: 'Thanks that names the actual thing is worth more than thanks that praises the person.',
    question: 'What did it cost them to do that for you?',
    moment: 'I am thanking someone',
  },

  /**
   * The moment this product exists for as much as any hard one.
   *
   * Good news arrives, you type "thank you", and that is the end of it. There
   * was no principle for this at all: `give_thanks` is aimed at thanking a
   * person, and had nowhere to put "bless the LORD, O my soul". A library with
   * fifteen ways to handle trouble and no way to handle joy is a temper check
   * wearing a wider name.
   */
  receive_good_news: {
    principle: 'receive_good_news',
    candidates: ['PSA.103.1-2', 'PSA.126.3', 'JAS.1.17', '1TH.5.18'],
    constraint:
      'Let the gladness stand. Do not dampen it, do not turn it into a lesson, and do not attach a warning about what might go wrong next.',
    explanation: 'Something good has happened, and it is worth saying so before the day moves on.',
    question: 'Who is this good news actually from?',
    moment: 'Something good has happened',
  },
  offer_support: {
    principle: 'offer_support',
    candidates: ['GAL.5.13', '1PE.4.10', 'PHP.2.4'],
    constraint:
      'Preserve the freely offered help. Do not inflate it into self-sacrifice, obligation, or a promise broader than the person made.',
    explanation: 'You are choosing to carry something for someone, freely and with care.',
    question: 'What makes this help an act of love rather than obligation?',
    moment: 'I am freely choosing to help or carry something for someone',
  },

  // --- when you are speaking near someone else's pain or name ---------------

  comfort_the_grieving: {
    principle: 'comfort_the_grieving',
    candidates: ['ROM.12.15', '2CO.1.3-4'],
    constraint:
      'Stay with what happened. Do not explain it, do not find a silver lining, and do not redirect to your own experience.',
    explanation: 'They do not need this made sense of. They need you to stay in it with them.',
    question: 'Can you sit in this with them without trying to fix it?',
    moment: 'Someone is grieving and I am writing to them',
  },
  guard_anothers_name: {
    principle: 'guard_anothers_name',
    candidates: ['PRO.11.13', 'PRO.17.27'],
    constraint:
      'Say only what is needed and only what you would say with them present. Remove speculation about motive.',
    explanation: 'You are describing someone who cannot answer for themselves here.',
    question: 'Would you write this the same way if they were copied in?',
    moment: 'I am talking about someone who is not here',
  },

  // --- when you are holding a line -----------------------------------------

  set_boundary: {
    principle: 'set_boundary',
    candidates: ['MAT.5.37', 'PRO.4.23', 'GAL.6.5'],
    constraint: 'State the limit plainly. No threat, no ultimatum, no manipulation, and do not soften it into ambiguity.',
    explanation: 'A limit stated once is clearer than a limit argued for.',
    question: 'What is the limit you are actually setting?',
    moment: 'I need to say no, or set a limit',
  },
  speak_with_courage: {
    principle: 'speak_with_courage',
    candidates: ['ACT.4.29', 'EPH.6.19', 'PRO.31.8-9'],
    constraint: 'Preserve the necessary candour. Remove aggression, not conviction.',
    explanation: 'This needed saying. It does not need armour.',
    question: 'Can you say the hard thing without the edge?',
    moment: 'I have to say something difficult to someone with power',
  },
}

/**
 * The product's own verse.
 *
 * "All a person's ways seem pure to them, but motives are weighed by the Lord."
 *
 * It replaced Proverbs 4:20-21 when the product stopped waiting to be pressed
 * and started reading the message being answered, because it is the argument
 * for doing that rather than a general call to keep the word close. You cannot
 * weigh yourself: whatever is visible in a draft is already clean in the eyes
 * of the person who wrote it, and the weight sits in what provoked it.
 *
 * Displayed as the epigraph, never selected as a principle.
 */
export const EPIGRAPH_REFERENCE = 'PRO.16.2'

/**
 * Safety passages are never chosen by the model. These candidates are audited
 * by `verify:refs`; the model cannot add to or alter this set.
 */
export interface SafetyCandidateEntry {
  /** Curated candidate references; never verse text. */
  candidates: string[]
  /** Review note explaining intended use and the boundary of the passage. */
  intendedContext: string
  caution: string
}

/**
 * Competition-demo candidates, not an emergency service. The model supplies
 * only a validated flag; selection stays here.
 */
export const SAFETY_CANDIDATE_LIBRARY: Record<SafetyFlag, SafetyCandidateEntry> = {
  self_harm: {
    candidates: ['PSA.34.18', 'PSA.42.11', 'ISA.41.10'],
    intendedContext: 'Despair, hopelessness, or language indicating self-harm.',
    caution: 'God’s nearness is not presented as a substitute for immediate human or professional support.',
  },
  abuse_disclosure: {
    candidates: ['PSA.9.9', 'PSA.46.1', 'PSA.34.18'],
    intendedContext: 'A disclosure of abuse, coercion, or danger from another person.',
    caution: 'Refuge language must never imply that the person should remain in danger.',
  },
  threat: {
    candidates: ['PSA.56.3-4', 'PSA.46.1', 'ISA.41.10'],
    intendedContext: 'Fear or immediate concern caused by a threat.',
    caution: 'Comfort must not minimise a credible threat or replace practical safety action.',
  },
  crisis: {
    candidates: ['PSA.46.1', 'PSA.121.1-2', 'PSA.34.18'],
    intendedContext: 'An acute crisis that does not fit a narrower safety flag.',
    caution: 'This is spiritual accompaniment, not diagnosis or crisis intervention.',
  },
}

const SAFETY_FLAG_PRIORITY: SafetyFlag[] = ['self_harm', 'abuse_disclosure', 'threat', 'crisis']

export function orderedSafetyCandidates(flags: SafetyFlag[], recent: string[] = []): string[] {
  const flag = SAFETY_FLAG_PRIORITY.find((candidate) => flags.includes(candidate)) ?? 'crisis'
  const candidates = SAFETY_CANDIDATE_LIBRARY[flag].candidates
  if (candidates.length <= 1) return [...candidates]
  const unseen = candidates.filter((referenceId) => !recent.includes(referenceId))
  return unseen.length > 0 ? unseen : [...candidates]
}

/**
 * Every reference the system is permitted to display: the principle
 * candidates, the epigraph, and the safety candidates. `verify:refs` fetches
 * each one so none can silently stop resolving.
 */
export const ALLOWED_REFERENCE_IDS: ReadonlySet<string> = new Set([
  ...Object.values(PRINCIPLE_LIBRARY).flatMap((entry) => entry.candidates),
  EPIGRAPH_REFERENCE,
  ...Object.values(SAFETY_CANDIDATE_LIBRARY).flatMap((entry) => entry.candidates),
])

export function isAllowedReference(referenceId: string): boolean {
  return ALLOWED_REFERENCE_IDS.has(referenceId)
}

/**
 * Candidates to try, in order: the model's ranking filtered to this
 * principle's reviewed set, then the remaining reviewed candidates as backup.
 */
export function orderedCandidates(principle: Principle, modelRanked: string[], recent: string[] = []): string[] {
  const reviewed = PRINCIPLE_LIBRARY[principle].candidates
  const unseen = reviewed.filter((id) => !recent.includes(id))
  const available = unseen.length > 0 ? unseen : reviewed
  const ranked = modelRanked.filter((id) => available.includes(id))
  const rest = available.filter((id) => !ranked.includes(id))
  return [...ranked, ...rest]
}

export function questionForReference(principle: Principle, referenceId: string): string {
  const entry = PRINCIPLE_LIBRARY[principle]
  return entry.questionsByReference?.[referenceId] ?? entry.question
}

/**
 * The gloss for the passage actually shown.
 *
 * One sentence per principle made the card look hardcoded, because it was:
 * the same moment twice produced the same words under a different verse. The
 * gloss belongs to the passage, the way a study Bible's margin note does.
 */
export function explanationForReference(principle: Principle, referenceId: string): string {
  const entry = PRINCIPLE_LIBRARY[principle]
  return entry.explanationsByReference?.[referenceId] ?? entry.explanation
}

export const GUIDE_PRINCIPLES: ReadonlySet<Principle> = new Set([
  'give_thanks',
  'receive_good_news',
  'offer_support',
])

export function experienceForPrinciple(principle: Principle): 'guide' | 'guard' {
  return GUIDE_PRINCIPLES.has(principle) ? 'guide' : 'guard'
}

/**
 * The moments a person can choose from when they invite Second Word rather
 * than waiting to be offered it. Ordered by how often correspondence actually
 * produces them, not by how dramatic they are.
 */
export const SELECTABLE_MOMENTS: Principle[] = [
  'meet_disappointment',
  'bear_false_accusation',
  'receive_correction',
  'make_amends',
  'set_boundary',
  'ask_with_humility',
  'trust_in_provision',
  'comfort_the_grieving',
  'speak_with_courage',
  'give_thanks',
  'receive_good_news',
  'offer_support',
  'guard_anothers_name',
]
