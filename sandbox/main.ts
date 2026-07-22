/**
 * Sandbox wiring.
 *
 * The public artifact a judge opens without installing anything. It uses the
 * same gate, the same badge, the same panel and the same backend as the
 * extension, so what it demonstrates is the product rather than a mock-up.
 *
 * It behaves the way the extension does: it looks on its own once you stop
 * typing, and it reads the message you are answering. Proverbs 16:2, a draft
 * cannot be weighed against itself. The invitation stays, for the moments no
 * classifier can see.
 */

import { gate, isMateriallyChanged } from '../src/lib/detector'
import { localDayOfYear } from '../src/lib/calendar'
import type {
  AnalyzeResponse,
  NoMomentResponse,
  RewriteMode,
  RewriteResponse,
  SafetyResponse,
  VerseOfTheDayResponse,
} from '../src/lib/contracts'
import { balanceQuotes, isVerseOfTheDayResponse } from '../src/lib/verse-of-the-day'
import { SecondWordBadge } from '../extension/src/badge'
import { SecondWordOverlay } from '../extension/src/overlay'
import { createScheduler } from '../extension/src/scheduler'
import { SecondWordPanel, type AnalyzeOptions } from '../src/ui/panel'
import { APP_SURFACES, SCENARIOS, type AppId, type AppSurface, type Scenario } from './scenarios'

const API_BASE = (document.documentElement.dataset.api ?? 'http://localhost:8787').replace(/\/$/, '')

const el = <T extends HTMLElement>(id: string): T => document.querySelector<T>(`#${id}`)!

const draftField = el<HTMLTextAreaElement>('draft')
const chipSlot = el('chip-slot')
const panelSlot = el('panel-slot')
const tabsNav = el('tabs')
const inviteButton = el<HTMLButtonElement>('invite')
const sendButton = el<HTMLButtonElement>('send')
const fillButton = el<HTMLButtonElement>('fill')
const statusSlot = el('status-slot')
const surfaceTabsNav = el('surface-tabs')
const momentGrid = el('moment-grid')
const supportedSurfaces = el('supported-surfaces')
const productSurface = el('product-surface')
const sendLabel = el<HTMLButtonElement>('send')

/*
 * Nothing writes into this slot on the ambient path any more.
 *
 * It used to carry "the reading service is busy right now" when a live call
 * failed, so a rate-limited demo would not look dead. The trade was wrong: it
 * turns our daily neuron allocation into an interruption in someone's compose
 * window, in a product that promises to be quiet unless something is at stake.
 * The mark returning to rest says everything that needed saying.
 *
 * Kept, and still cleared on input, because the invited path renders its
 * answer inside the panel, where a person who asked is owed one.
 */
function clearChecked(): void {
  statusSlot.classList.remove('status--on')
  statusSlot.replaceChildren()
}

let scenario: Scenario = SCENARIOS[0]!
let panel: SecondWordPanel | null = null
let overlay: SecondWordOverlay | null = null
let badge: SecondWordBadge | null = null
let offer: AnalyzeResponse | SafetyResponse | null = null
let lastEvaluated = ''
let debounceTimer: number | undefined
let dailyVerse: VerseOfTheDayResponse | null = null
let recentReferenceIds: string[] = []
/** Increments per ambient run, so a stale one cannot touch a newer badge. */
let evaluationRun = 0

/** Same as the extension: never on keypress, and never twice for one draft. */
const DEBOUNCE_MS = 800
/** Match the extension: a demo must fail visibly, never wait forever. */
const ANALYZE_TIMEOUT_MS = 15_000
const REWRITE_TIMEOUT_MS = 15_000
const PASSAGE_TIMEOUT_MS = 5_000
const HEALTH_TIMEOUT_MS = 5_000
const scheduler = createScheduler<AnalyzeResponse | SafetyResponse | NoMomentResponse>()

// ---------------------------------------------------------------------------
// Scenario switching
// ---------------------------------------------------------------------------

function appFor(id: AppId): AppSurface {
  const app = APP_SURFACES.find((item) => item.id === id)
  if (!app) throw new Error(`Unknown application surface: ${id}`)
  return app
}

function logoFor(app: AppSurface, className: string): HTMLImageElement {
  const image = document.createElement('img')
  image.className = className
  image.src = `./assets/${app.id}.svg`
  // Each vendor draws to its own margins: WhatsApp's mark sits inside a large
  // transparent bleed and reads noticeably smaller than the rest at the same
  // box size. Optical sizing per logo, not one number for all six.
  image.dataset.logo = app.id
  image.alt = ''
  image.width = 22
  image.height = 22
  image.setAttribute('aria-hidden', 'true')
  return image
}

function initials(name: string): string {
  return name
    .split(/\s|·/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function renderScenarioTabs(appId: AppId): void {
  tabsNav.replaceChildren()
  for (const item of SCENARIOS.filter((candidate) => candidate.app === appId)) {
    const tab = document.createElement('button')
    tab.type = 'button'
    tab.className = `scenario-tab${item.id === scenario.id ? ' scenario-tab--on' : ''}`
    tab.dataset.id = item.id
    tab.textContent = item.tab
    tab.setAttribute('aria-pressed', String(item.id === scenario.id))
    tab.addEventListener('click', () => renderScenario(item))
    tabsNav.append(tab)
  }
}

function renderScenario(next: Scenario): void {
  scenario = next
  const app = appFor(next.app)
  closePanel()
  badge?.destroy()
  badge = null
  offer = null
  chipSlot.replaceChildren()
  clearChecked()
  lastEvaluated = ''

  el('location').textContent = next.location
  el('app-name').textContent = app.name
  const appGlyph = el('app-glyph')
  appGlyph.replaceChildren(logoFor(app, 'surface__logo'))
  el('from').textContent = next.received.from
  el('meta').textContent = next.received.meta
  el('body').textContent = next.received.body
  el('avatar').textContent = initials(next.received.from)
  el('composer-label').textContent = next.composerLabel
  productSurface.dataset.app = app.id
  productSurface.style.setProperty('--app-accent', app.accent)
  sendLabel.textContent = app.id === 'x' || app.id === 'linkedin' ? 'Post' : 'Send'

  draftField.value = ''
  resizeDraftField()
  draftField.placeholder = next.placeholder
  showPresenceBadge()

  renderScenarioTabs(app.id)
  for (const tab of surfaceTabsNav.children) {
    const selected = (tab as HTMLElement).dataset.id === app.id
    tab.classList.toggle('app-tab--on', selected)
    tab.setAttribute('aria-pressed', String(selected))
  }
}

for (const app of APP_SURFACES) {
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.className = 'app-tab'
  tab.dataset.id = app.id
  tab.style.setProperty('--app-accent', app.accent)
  tab.append(logoFor(app, 'app-tab__logo'))
  const name = document.createElement('span')
  name.className = 'app-tab__name'
  name.textContent = app.shortName
  tab.append(name)
  tab.setAttribute('aria-label', `Show Second Word in ${app.name}`)
  tab.addEventListener('click', () => {
    const first = SCENARIOS.find((item) => item.app === app.id)
    if (first) renderScenario(first)
  })
  surfaceTabsNav.append(tab)
}

for (const item of SCENARIOS) {
  const app = appFor(item.app)
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'moment-card'
  card.style.setProperty('--app-accent', app.accent)
  card.setAttribute('aria-label', `${item.moment} in ${app.name}`)

  const top = document.createElement('span')
  top.className = 'moment-card__top'
  const appLabel = document.createElement('span')
  appLabel.className = 'moment-card__app'
  appLabel.append(logoFor(app, 'moment-card__logo'), document.createTextNode(app.shortName))
  /*
   * No Guard/Guide/Silence pill.
   *
   * The card's job here is "this moment happens in this app". Labelling the
   * product's internal states on a card nobody has interacted with yet asks a
   * first-time reader to learn a taxonomy before they have seen the thing it
   * describes. The tone still carries it: clay, gold, or neither.
   */
  top.append(appLabel)

  const title = document.createElement('span')
  title.className = 'moment-card__title'
  title.textContent = item.moment
  card.append(top, title)
  card.addEventListener('click', () => {
    renderScenario(item)
    document.querySelector('#experience')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => draftField.focus(), 450)
  })
  momentGrid.append(card)
}

for (const app of APP_SURFACES) {
  const item = document.createElement('div')
  item.className = 'supported__item'
  item.style.setProperty('--app-accent', app.accent)
  item.append(logoFor(app, 'supported__logo'))
  const copy = document.createElement('div')
  const name = document.createElement('div')
  name.className = 'supported__name'
  name.textContent = app.shortName
  const state = document.createElement('div')
  state.className = 'supported__state'
  state.textContent = 'Live in this experience'
  copy.append(name, state)
  item.append(copy)
  supportedSurfaces.append(item)
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

function closePanel(): void {
  panel?.destroy()
  panel = null
  overlay?.destroy()
  overlay = null
  panelSlot.replaceChildren()
}

function buildPanel(): SecondWordPanel {
  return new SecondWordPanel({
    onAnalyze: (options) => analyze(draftField.value, { ...options, received: scenario.received.body }),
    onRewrite: (token, modes) => rewrite(draftField.value, token, modes),
    onReplace: (text) => {
      const previous = draftField.value
      draftField.value = text
      draftField.dispatchEvent(new Event('input', { bubbles: true }))
      return previous
    },
    onClose: () => {
      closePanel()
      restoreBadge()
      draftField.focus()
    },
  })
}

/** The invitation. You press it because you know this one matters. */
inviteButton.addEventListener('click', () => {
  if (!draftField.value.trim()) {
    openVerseOfTheDay()
    return
  }
  closePanel()
  badge?.destroy()
  badge = null
  chipSlot.replaceChildren()
  panel = buildPanel()
  overlay = new SecondWordOverlay({ field: draftField, content: panel.host })
  void panel.analyzeNow()
})

/**
 * The ambient path, identical in shape to the extension's.
 *
 * Two gates, and both must agree before anything appears:
 *   1. the local gate, free and silent, which stops task talk before the
 *      network is touched at all
 *   2. the model, which is already silent on ordinary drafts
 */
async function evaluateDraft(): Promise<void> {
  if (panel) return

  /*
   * Only the newest run may touch the badge.
   *
   * Without this, a call that fails after the person has typed again tears
   * down a badge it never created. Typing and deleting left the mark gone for
   * good, because the stale run's failure path removed the Presence mark the
   * input handler had just put back.
   */
  const run = (evaluationRun += 1)
  const current = (): boolean => run === evaluationRun

  const draft = draftField.value
  if (lastEvaluated !== '' && !isMateriallyChanged(lastEvaluated, draft)) return

  // The message being answered. It is on screen above the composer, and it is
  // what carries the weight when the reply itself is perfectly calm.
  const received = scenario.received.body

  if (!gate(draft, received).pass) return
  lastEvaluated = draft

  // Show life the instant the gate opens: a breathing dot in the corner while
  // the model reads, so the ~3s call is never dead air.
  badge?.destroy()
  badge = new SecondWordBadge({ field: draftField, label: '“', title: 'Second Word is reading this', thinking: true, onOpen: () => {} })

  let result: AnalyzeResponse | SafetyResponse | NoMomentResponse | null
  try {
    result = await scheduler.submit(`${draft}\u0000${received}`, () => analyze(draft, { received }))
  } catch {
    /*
     * A failure is our problem, not theirs.
     *
     * This used to print that the reading service was busy. That is our daily
     * neuron allocation showing up as an interruption in someone's compose
     * window, in a product whose whole claim is that it is quiet unless
     * something is at stake. Nothing is at stake in a quota.
     *
     * Silence, and the mark goes back to resting. Grammarly's icon does not
     * leave when its backend has a bad minute, and neither does ours.
     */
    if (current()) {
      badge?.destroy()
      badge = null
      restoreBadge()
    }
    return
  }

  if (!current()) return

  // Clear the thinking dot before deciding what, if anything, to show.
  badge?.destroy()
  badge = null

  // Superseded, or the person moved on. Either way the mark still belongs here.
  if (result === null || panel || draftField.value !== draft) {
    restoreBadge()
    return
  }

  if ('verified_reference_id' in result) {
    showBadge(result)
  } else if ('safety_flags' in result && result.safety_flags.length > 0) {
    // A self-harm, abuse, threat or crisis signal. Not a passage, but never
    // silence either: this is the moment showing up gently matters most.
    showBadge(result)
  } else {
    // The model said nothing is at stake. No passage, and no absence either:
    // the day's verse is the resting state, not a prize for being troubled.
    restoreBadge()
  }
}

/** Automatic detection is not automatic interruption. The badge waits. */
function showBadge(result: AnalyzeResponse | SafetyResponse): void {
  offer = result
  const safety = !('verified_reference_id' in result)
  const guide = !safety && result.experience === 'guide'
  badge?.destroy()
  badge = new SecondWordBadge({
    field: draftField,
    label: guide ? '\u2726' : '\u201C',
    tone: guide ? 'guide' : 'guard',
    title: safety ? 'Take a moment' : guide ? 'A word for this good moment' : 'Something here may be worth a second look',
    onOpen: () => {
      badge?.destroy()
      badge = null
      closePanel()
      panel = buildPanel()
      // Already paid for. Re-running it to display it would be a second call.
      if ('verified_reference_id' in result) panel.present(result)
      else panel.presentSafety(result)
      // Present before measuring: the resolved card opens at its real height
      // on the first frame rather than growing out of a temporary 300px box.
      overlay = new SecondWordOverlay({ field: draftField, content: panel.host })
    },
  })
}

/** A choice to keep writing is not a choice to lose the reading forever. */
function restoreBadge(): void {
  if (offer && draftField.value.trim()) showBadge(offer)
  else showPresenceBadge()
}

draftField.addEventListener('input', () => {
  resizeDraftField()
  clearChecked()
  offer = null
  badge?.destroy()
  badge = null
  showPresenceBadge()
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => void evaluateDraft(), DEBOUNCE_MS)
})

function resizeDraftField(): void {
  draftField.style.height = 'auto'
  const height = Math.min(220, Math.max(110, draftField.scrollHeight))
  draftField.style.height = `${height}px`
  draftField.style.overflowY = draftField.scrollHeight > height ? 'auto' : 'hidden'
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

async function analyze(
  draft: string,
  options: AnalyzeOptions & { received?: string },
): Promise<AnalyzeResponse | SafetyResponse | NoMomentResponse> {
  const response = await fetch(`${API_BASE}/v1/analyze`, {
    method: 'POST',
    signal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      draft,
      surface: scenario.surface,
      ...(options.principle ? { principle_hint: options.principle } : {}),
      ...(options.context ? { context: options.context } : {}),
      ...(options.received ? { received_message: options.received } : {}),
      ...(recentReferenceIds.length > 0 ? { recent_reference_ids: recentReferenceIds } : {}),
    }),
  })
  if (!response.ok) throw new Error(`analyze failed: ${response.status}`)
  const result = (await response.json()) as AnalyzeResponse | SafetyResponse | NoMomentResponse
  const referenceId = 'verified_reference_id' in result
    ? result.verified_reference_id
    : 'comfort_reference_id' in result
      ? result.comfort_reference_id
      : undefined
  if (referenceId) recentReferenceIds = [referenceId, ...recentReferenceIds.filter((id) => id !== referenceId)].slice(0, 5)
  return result
}

async function rewrite(draft: string, token: string, modes: RewriteMode[]): Promise<RewriteResponse> {
  const response = await fetch(`${API_BASE}/v1/rewrite`, {
    method: 'POST',
    signal: AbortSignal.timeout(REWRITE_TIMEOUT_MS),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ draft, analysis_token: token, modes, received_message: scenario.received.body }),
  })
  if (!response.ok) throw new Error(`rewrite failed: ${response.status}`)
  return (await response.json()) as RewriteResponse
}

/**
 * YouVersion chooses the day's reference. We then resolve its text and full
 * publisher attribution through the same Worker path as every other passage.
 *
 * Every failure path removes the element. Returning early on a bad response
 * left an empty quote block with a rule and no words in it, which looks like
 * the product broke rather than like nothing happened.
 */
async function loadPresence(): Promise<void> {
  try {
    const day = localDayOfYear(new Date())
    const response = await fetch(`${API_BASE}/v1/verse-of-the-day?day=${day}`, {
      signal: AbortSignal.timeout(PASSAGE_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(String(response.status))

    const body: unknown = await response.json()
    if (!isVerseOfTheDayResponse(body)) throw new Error('unverifiable verse')
    dailyVerse = body
    showPresenceBadge()
  } catch {
    // The composer reads fine without it. Never show placeholder Scripture.
    dailyVerse = null
  }
}

function showPresenceBadge(): void {
  if (!dailyVerse || panel || offer) return
  badge?.destroy()
  badge = new SecondWordBadge({
    field: draftField,
    label: '\u2726',
    tone: 'presence',
    title: 'Open today\'s verse',
    onOpen: openVerseOfTheDay,
  })
}

function openVerseOfTheDay(): void {
  if (!dailyVerse) return
  badge?.destroy()
  badge = null
  closePanel()
  panel = buildPanel()
  panel.presentVerseOfTheDay(dailyVerse)
  overlay = new SecondWordOverlay({ field: draftField, content: panel.host })
}

/**
 * Say which model actually read the draft, rather than naming the one the
 * competition requires and hoping nobody checks.
 */
async function loadProvider(): Promise<void> {
  const label = document.querySelector<HTMLElement>('#provider')
  const status = document.querySelector<HTMLElement>('#live-status')
  const dot = document.querySelector<HTMLElement>('#live-dot')
  try {
    const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
    if (!response.ok) throw new Error('health unavailable')
    const body = (await response.json()) as { llm_provider?: string }
    const provider = body.llm_provider
    if (label) {
      label.textContent =
        provider === 'gloo'
          ? 'Gloo AI Studio'
          : provider === 'workers-ai'
            ? 'Cloudflare Workers AI, standing in for Gloo AI Studio while its credentials are unavailable'
            : (provider ?? 'an unknown provider')
    }
    if (status) status.textContent = 'Connected to the live Second Word Worker'
    if (dot) dot.style.background = '#75a783'
  } catch {
    if (status) status.textContent = 'The live Worker is unavailable right now'
    if (dot) dot.style.background = '#c4705a'
  }
}

// ---------------------------------------------------------------------------

fillButton.addEventListener('click', () => {
  closePanel()
  badge?.destroy()
  badge = null
  chipSlot.replaceChildren()
  lastEvaluated = ''
  draftField.value = scenario.suggestedDraft
  resizeDraftField()
  draftField.focus()
  evaluateDraft()
})

/**
 * Second Word does not own the send action, so the sandbox does not simulate
 * posting. It acknowledges that the decision was the user's.
 */
sendButton.addEventListener('click', () => {
  if (!draftField.value.trim()) return
  closePanel()
  badge?.destroy()
  badge = null
  chipSlot.replaceChildren()
  const note = document.createElement('span')
  note.className = 'sent'
  note.textContent = 'Sent. Nothing left this page.'
  chipSlot.append(note)
  draftField.value = ''
  lastEvaluated = ''
  offer = null
})

renderScenario(SCENARIOS[0]!)
void loadPresence()
void loadProvider()

/**
 * Entrances, once each.
 *
 * A page about noticing should itself behave like it is paying attention:
 * content arrives when it comes into view rather than being there already.
 * Unobserved after firing, so nothing re-animates on the way back up, and the
 * whole thing is skipped for anyone who has asked for less motion.
 */
function revealOnScroll(): void {
  const targets = [...document.querySelectorAll<HTMLElement>('[data-reveal]')]
  if (targets.length === 0) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    for (const node of targets) node.classList.add('is-in')
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        observer.unobserve(entry.target)
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
  )
  for (const node of targets) observer.observe(node)
}

/**
 * The day's verse, shown on the page as well as in the composer.
 *
 * Same endpoint, same YouVersion text, same attribution rules. If it cannot be
 * fetched the section says so plainly rather than inventing a verse.
 */
async function renderVerseOfTheDaySection(): Promise<void> {
  const textNode = document.querySelector<HTMLElement>('#votd-text')
  const refNode = document.querySelector<HTMLElement>('#votd-ref')
  if (!textNode || !refNode) return
  try {
    const day = localDayOfYear(new Date())
    const response = await fetch(`${API_BASE}/v1/verse-of-the-day?day=${day}`, {
      signal: AbortSignal.timeout(PASSAGE_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(String(response.status))
    const body: unknown = await response.json()
    if (!isVerseOfTheDayResponse(body)) throw new Error('unverifiable verse')
    textNode.textContent = balanceQuotes(body.verse_text)
    refNode.textContent = `${body.display_reference} · ${body.translation} · ${body.attribution.split('\n')[0] ?? ''}`
  } catch {
    textNode.textContent = 'Today\u2019s verse could not be reached just now. Nothing is shown in its place.'
    refNode.textContent = ''
  }
}

revealOnScroll()
void renderVerseOfTheDaySection()

/**
 * The last word of the headline rotates.
 *
 * "where your words happen" is one claim; the product is really about all of
 * them. Each word is a different thing a sentence can do to somebody, and the
 * set is the argument. Held long enough to read, and it stops entirely for
 * anyone who has asked for less motion.
 */
function rotateHeadlineWord(): void {
  const host = document.querySelector<HTMLElement>('#rotator')
  if (!host) return

  /*
   * Typed, deleted, retyped.
   *
   * A cross-fade was the wrong gesture for this product. What Second Word
   * actually does is give somebody the two seconds in which they go back and
   * change the word they were about to send, so the headline does exactly
   * that: it writes "wound", stops, takes it back, and writes "heal".
   *
   * The sizer holds the longest word at zero opacity, which fixes the box
   * width. Without it the line reflows on every keystroke and the break before
   * the word, which is the point of the break, comes and goes.
   */
  const words = ['happen.', 'land.', 'wound.', 'heal.', 'matter.']

  host.replaceChildren()
  const sizer = document.createElement('span')
  sizer.className = 'rotator__sizer'
  sizer.setAttribute('aria-hidden', 'true')
  /*
   * Widest, measured, not longest by character count. In this serif "matter."
   * and "happen." are both seven characters and different widths, and the box
   * has to clear whichever actually draws wider, plus the caret. Guessing left
   * a 10px twitch at the end of every word.
   */
  sizer.textContent = words[0]!
  host.append(sizer)
  let widest = words[0]!
  let widestPx = 0
  for (const word of words) {
    sizer.textContent = word
    const measured = sizer.getBoundingClientRect().width
    if (measured > widestPx) {
      widestPx = measured
      widest = word
    }
  }
  sizer.textContent = widest
  const typed = document.createElement('span')
  typed.className = 'rotator__typed'
  typed.textContent = words[0]!
  host.append(typed)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  /*
   * Paced for reading, not for showing off the effect.
   *
   * At 62ms a character the word was gone before anyone had finished the line
   * it belongs to. A person reads "where your words wound." in roughly two
   * seconds; the hold has to be longer than that or the sentence never lands.
   */
  const TYPE_MS = 105
  const DELETE_MS = 45
  const HOLD_MS = 3400
  const BETWEEN_MS = 700

  let index = 0
  let count = words[0]!.length
  let deleting = false
  host.classList.add('is-typing')

  const tick = (): void => {
    const word = words[index]!
    if (deleting) {
      count -= 1
      typed.textContent = word.slice(0, count)
      if (count === 0) {
        deleting = false
        index = (index + 1) % words.length
        window.setTimeout(tick, BETWEEN_MS)
        return
      }
      window.setTimeout(tick, DELETE_MS)
      return
    }

    count += 1
    typed.textContent = word.slice(0, count)
    if (count >= word.length) {
      deleting = true
      window.setTimeout(tick, HOLD_MS)
      return
    }
    window.setTimeout(tick, TYPE_MS)
  }

  window.setTimeout(tick, HOLD_MS)
}

rotateHeadlineWord()
