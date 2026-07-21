/**
 * Content script.
 *
 * Second Word used to wait to be pressed. That failed on its own terms: the
 * moment it exists for, a reply to a rejection, an answer to a false
 * accusation, a message written in anger, is exactly the moment nobody reaches
 * for the thing that will talk them down. Reaching for it is already the change
 * of heart. And nobody presses a button to be reminded to give thanks.
 *
 * So it looks on its own now, and it reads the message being answered.
 * Proverbs 16:2: a draft cannot be weighed against itself.
 *
 * What has not changed: it never posts, never blocks Send, never edits without
 * a click, and never writes into the field it is watching.
 *
 * Decision references are to docs/RESEARCH-PRIOR-ART.md.
 */

import { detect, gate, isMateriallyChanged } from '../../src/lib/detector'
import { localDayOfYear } from '../../src/lib/calendar'
import type {
  AnalyzeResponse,
  NoMomentResponse,
  RewriteMode,
  RewriteResponse,
  SafetyResponse,
  VerseOfTheDayResponse,
} from '../../src/lib/contracts'
import { isVerseOfTheDayResponse } from '../../src/lib/verse-of-the-day'
import { SecondWordPanel, type AnalyzeOptions } from '../../src/ui/panel'
import { chooseAdapter } from './adapters/choose'
import { findEditable, isEligibleField } from './adapters/generic'
import { isMounted, markMounted, type ComposerAdapter } from './adapters/types'
import { SecondWordBadge } from './badge'
import { SecondWordOverlay } from './overlay'
import { markMoments, type MomentMarker } from './moment-marker'
import { createScheduler } from './scheduler'
import { apiBase, isAmbient, isEnabledFor, rememberReference, settings } from './config'

/**
 * Gmail is the generic adapter plus the one thing only Gmail can do. D14.
 * Everywhere else gets the generic one, which is the whole point: people are
 * in Slack and Teams and a prompt box, not only in email.
 */
const adapter: ComposerAdapter = chooseAdapter(location.host, document)

/**
 * D11. Never on keypress. Grammarly's ~91% input lag reduction came from
 * moving work off that path, and this now costs a network request rather than
 * a local scan, so the pause before acting matters more than it used to.
 */
const DEBOUNCE_MS = 800

/**
 * D20. Fast or dropped.
 *
 * Requests are chained so only one is ever open, which means a request that
 * never returns would wedge every one after it and Second Word would go quiet
 * for the rest of the session without ever saying so. A hung read becomes
 * silence, deliberately, rather than a hang.
 */
const ANALYZE_TIMEOUT_MS = 15_000
/** A rewrite is optional; it must never leave an action button waiting forever. */
const REWRITE_TIMEOUT_MS = 15_000

type AnalyzeOutcome = AnalyzeResponse | SafetyResponse | NoMomentResponse

/** D12. Single flight, cache, and stale answers dropped rather than shown. */
const scheduler = createScheduler<AnalyzeOutcome>()

interface Attachment {
  composer: HTMLElement
  badge: SecondWordBadge | null
  overlay: SecondWordOverlay | null
  panel: SecondWordPanel | null
  /** Local-only mark under the exact phrase that prompted the reflection. */
  marker: MomentMarker | null
  /** The resolved reading remains available after the card is dismissed. */
  offer: { result: AnalyzeResponse | SafetyResponse; evidence: string[] } | null
  lastEvaluated: string
  timer: number | undefined
  dailyVerse: VerseOfTheDayResponse | null
}

const attachments = new WeakMap<HTMLElement, Attachment>()
let ambient = false
let presenceEnabled = false
const verseOfTheDayCache = new Map<string, Promise<VerseOfTheDayResponse | null>>()

async function boot(): Promise<void> {
  if (!(await isEnabledFor(location.host))) return
  ambient = await isAmbient()
  presenceEnabled = (await settings()).presence

  /**
   * D13. Focus, not a MutationObserver over the whole body. Gmail rebuilds its
   * DOM constantly, and Grammarly's own warning is that an observer used
   * carelessly "has the potential to degrade the performance of the entire
   * page". Focus also gets dynamically created composers for free.
   */
  document.addEventListener('focusin', onFocusIn, true)

  // Whatever already has focus when we load.
  if (document.activeElement) attach(document.activeElement)
}

function onFocusIn(event: FocusEvent): void {
  attach(event.target)
}

function attach(target: EventTarget | null): void {
  const composer = findEditable(target)
  if (!composer || isMounted(composer)) return
  // D18. Passwords, one-time codes, card numbers, and anything opted out.
  if (!isEligibleField(composer)) return

  markMounted(composer)
  const attachment: Attachment = {
    composer,
    badge: null,
    overlay: null,
    panel: null,
    marker: null,
    offer: null,
    lastEvaluated: '',
    timer: undefined,
    dailyVerse: null,
  }
  attachments.set(composer, attachment)

  mountInvitation(attachment)
  if (presenceEnabled) void mountPresence(attachment)

  composer.addEventListener('input', () => {
    // An offer belongs to one settled draft. Once the person changes the
    // words, remove it and let the debounced pass earn a new invitation.
    attachment.offer = null
    attachment.marker?.destroy()
    attachment.marker = null
    attachment.badge?.destroy()
    attachment.badge = null
    showPresenceBadge(attachment)
    window.clearTimeout(attachment.timer)
    attachment.timer = window.setTimeout(() => void evaluate(attachment), DEBOUNCE_MS)
  })
}

async function mountPresence(attachment: Attachment): Promise<void> {
  const currentSettings = await settings()
  const day = localDayOfYear(new Date())
  const base = currentSettings.apiBase.replace(/\/$/, '')
  const key = `${base}\u0000${day}\u0000${currentSettings.translationId}`
  let pending = verseOfTheDayCache.get(key)
  if (!pending) {
    const query = new URLSearchParams({ day: String(day) })
    if (currentSettings.translationId) query.set('translation_id', currentSettings.translationId)
    pending = fetch(`${base}/v1/verse-of-the-day?${query}`, {
      signal: AbortSignal.timeout(5_000),
    })
      .then(async (response) => {
        if (!response.ok) return null
        const body: unknown = await response.json()
        return isVerseOfTheDayResponse(body) ? body : null
      })
      .catch(() => null)
    verseOfTheDayCache.set(key, pending)
  }

  const verse = await pending
  if (
    !verse ||
    !attachment.composer.isConnected
  ) return
  attachment.dailyVerse = verse
  showPresenceBadge(attachment)
}

function showPresenceBadge(attachment: Attachment): void {
  if (!presenceEnabled || !attachment.dailyVerse || attachment.panel || attachment.offer) return
  attachment.badge?.destroy()
  attachment.badge = new SecondWordBadge({
    field: attachment.composer,
    label: '\u2726',
    tone: 'presence',
    title: 'Open today\'s verse',
    onOpen: () => openVerseOfTheDay(attachment),
  })
}

function openVerseOfTheDay(attachment: Attachment): void {
  const verse = attachment.dailyVerse
  if (!verse) return
  attachment.badge?.destroy()
  attachment.badge = null
  closePanel(attachment)
  const panel = buildPanel(attachment)
  attachment.panel = panel
  attachment.overlay = new SecondWordOverlay({
    field: attachment.composer,
    content: panel.host,
    onDismiss: () => closePanel(attachment),
  })
  panel.presentVerseOfTheDay(verse)
}


/**
 * The invitation, kept deliberately. D3.
 *
 * Grammarly runs a hybrid: ambient by default, plus one manual action. This is
 * the way in for moments no classifier can see, and the only way in at all
 * until someone turns ambient on.
 */
function mountInvitation(attachment: Attachment): void {
  const anchor = adapter.attachAnchor(attachment.composer)
  if (!anchor) return

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Second Word'
  button.setAttribute('aria-label', 'Reflect on this draft with Second Word')
  Object.assign(button.style, {
    all: 'unset',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    border: '1px solid #d8d5ce',
    borderRadius: '2px',
    background: '#fbfaf7',
    color: '#55524c',
    font: "12.5px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    cursor: 'pointer',
  })

  button.addEventListener('click', () => {
    if (!adapter.getDraft(attachment.composer).trim()) return
    openConsent(attachment)
  })
  anchor.append(button)
}

/**
 * The ambient path. Runs on its own, after typing settles.
 *
 * Two gates, and both must agree before anything appears. D6: a single
 * opinion is not enough to act on, and Grammarly states plainly that a quorum
 * of one is a poor strategy.
 *
 *   1. the local gate, loose, free, and silent about logistics
 *   2. the model, strict, and already silent on ordinary drafts
 */
async function evaluate(attachment: Attachment): Promise<void> {
  if (!ambient || attachment.panel) return

  const draft = adapter.getDraft(attachment.composer)
  if (attachment.lastEvaluated !== '' && !isMateriallyChanged(attachment.lastEvaluated, draft)) return

  const received = adapter.getReceivedMessage(attachment.composer) ?? undefined
  const local = detect(draft)

  // The marker is not a verdict and does not alter the editor. It makes the
  // local reason for our pause legible before any request leaves the browser.
  if (local.shouldOfferChip) {
    attachment.marker?.destroy()
    attachment.marker = markMoments(
      attachment.composer,
      local.signals.filter((signal) => signal.weight > 0).map((signal) => signal.evidence),
    )
  }

  // Gate one. No network call happens if this stops it.
  const decision = gate(draft, received)
  if (!decision.pass) return

  attachment.lastEvaluated = draft

  const key = `${draft}\u0000${received ?? ''}`
  let outcome: AnalyzeOutcome | null
  try {
    outcome = await scheduler.submit(key, () => analyze(draft, { received }))
  } catch {
    // A failed analysis is silence, never an error in someone's compose window.
    attachment.marker?.destroy()
    attachment.marker = null
    return
  }

  // Superseded while in flight. The draft it describes no longer exists.
  if (outcome === null) return

  // The person moved on while we were waiting.
  if (attachment.panel || adapter.getDraft(attachment.composer) !== draft) return

  // Gate two. A passage, or a safety response, is worth a badge. Anything else
  // is silence, and silence renders nothing: no badge, no placeholder, no trace.
  if ('verified_reference_id' in outcome) {
    showBadge(attachment, outcome, decision.evidence)
  } else if ('safety_flags' in outcome && outcome.safety_flags.length > 0) {
    // Self-harm, abuse, a threat, a crisis. Not a passage. Never swallowed as
    // silence: this is the moment showing up gently matters most.
    showBadge(attachment, outcome, [])
  } else {
    // The model saw no relational moment. A local heuristic never gets the
    // final word, so remove its marker and leave the person's draft alone.
    attachment.marker?.destroy()
    attachment.marker = null
  }
}

/**
 * D2. Automatic detection is not automatic interruption.
 *
 * The badge appears on its own. The passage does not. Opening it stays a
 * deliberate act, the way Grammarly's card is.
 */
function showBadge(attachment: Attachment, result: AnalyzeResponse | SafetyResponse, evidence: string[]): void {
  attachment.badge?.destroy()
  attachment.offer = { result, evidence }

  const safety = !('verified_reference_id' in result)
  const guide = !safety && result.experience === 'guide'
  attachment.badge = new SecondWordBadge({
    field: attachment.composer,
    label: guide ? '\u2726' : '\u201C',
    tone: guide ? 'guide' : 'guard',
    // D10. Explainability was a modelling constraint for Grammarly, not a
    // nicety: a suggestion with no visible reason is confusing. Something that
    // arrived uninvited owes an answer to "why are you here".
    title: safety
      ? 'Take a moment'
      : guide
        ? 'A word for this good moment'
      : evidence.length > 0
        ? `Noticed: ${evidence.join(', ')}`
        : 'Something here may be worth a second look',
    onOpen: () => openPassage(attachment, result),
  })
}

/** Re-show the same resolved invitation after a person closes the card. */
function restoreBadge(attachment: Attachment): void {
  const offer = attachment.offer
  if (!attachment.composer.isConnected) return
  if (offer && adapter.getDraft(attachment.composer).trim()) showBadge(attachment, offer.result, offer.evidence)
  else showPresenceBadge(attachment)
}

/** The click. Only now does anything take up room on the page. */
function openPassage(attachment: Attachment, result: AnalyzeResponse | SafetyResponse): void {
  attachment.badge?.destroy()
  attachment.badge = null

  closePanel(attachment)
  const panel = buildPanel(attachment)
  attachment.panel = panel

  // Positioned against the field, owned by us. Never appended into the host's
  // own compose window, which is what made Gmail's grow to 1053px.
  attachment.overlay = new SecondWordOverlay({
    field: attachment.composer,
    content: panel.host,
    onDismiss: () => closePanel(attachment),
  })

  // The analysis is already in hand. Re-running it to display it would be a
  // second request for a result we already paid for.
  if ('verified_reference_id' in result) panel.present(result)
  else panel.presentSafety(result)
}

/** The invited path, where the draft has not left the browser yet. */
function openConsent(attachment: Attachment): void {
  closePanel(attachment)
  const panel = buildPanel(attachment)
  attachment.panel = panel

  attachment.overlay = new SecondWordOverlay({
    field: attachment.composer,
    content: panel.host,
    onDismiss: () => closePanel(attachment),
  })
  panel.renderConsent(true)
}

/** Tear down the card and the box it sits in together, or one outlives the other. */
function closePanel(attachment: Attachment): void {
  attachment.panel?.destroy()
  attachment.panel = null
  attachment.overlay?.destroy()
  attachment.overlay = null
}

function buildPanel(attachment: Attachment): SecondWordPanel {
  return new SecondWordPanel({
    onAnalyze: (options) => analyze(adapter.getDraft(attachment.composer), options),
    onRewrite: (token, modes) => rewrite(adapter.getDraft(attachment.composer), token, modes, attachment),
    onReplace: (text) => {
      const previous = adapter.getDraft(attachment.composer)
      adapter.setDraft(attachment.composer, text)
      return previous
    },
    onClose: () => {
      closePanel(attachment)
      restoreBadge(attachment)
      attachment.composer.focus()
    },
  })
}

async function analyze(
  draft: string,
  options: AnalyzeOptions & { received?: string },
): Promise<AnalyzeResponse | SafetyResponse> {
  const base = await apiBase()
  const currentSettings = await settings()
  const translationId = currentSettings.translationId
  const response = await fetch(`${base}/v1/analyze`, {
    method: 'POST',
    signal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      draft,
      surface: adapter.id === 'gmail' ? 'gmail' : 'social',
      ...(options.principle ? { principle_hint: options.principle } : {}),
      ...(options.context ? { context: options.context } : {}),
      ...(options.received ? { received_message: options.received } : {}),
      ...(translationId ? { translation_id: translationId } : {}),
      ...(currentSettings.recentReferenceIds.length > 0 ? { recent_reference_ids: currentSettings.recentReferenceIds } : {}),
    }),
  })
  if (!response.ok) throw new Error(`analyze failed: ${response.status}`)
  const result = (await response.json()) as AnalyzeResponse | SafetyResponse
  const referenceId = 'verified_reference_id' in result ? result.verified_reference_id : result.comfort_reference_id
  if (referenceId) await rememberReference(referenceId)
  return result
}

async function rewrite(
  draft: string,
  token: string,
  modes: RewriteMode[],
  attachment: Attachment,
): Promise<RewriteResponse> {
  const base = await apiBase()
  // Must match what the analysis saw, or the token will not verify.
  const received = adapter.getReceivedMessage(attachment.composer) ?? undefined
  const response = await fetch(`${base}/v1/rewrite`, {
    method: 'POST',
    signal: AbortSignal.timeout(REWRITE_TIMEOUT_MS),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      draft,
      analysis_token: token,
      modes,
      ...(received ? { received_message: received } : {}),
    }),
  })
  if (!response.ok) throw new Error(`rewrite failed: ${response.status}`)
  return (await response.json()) as RewriteResponse
}

void boot()
