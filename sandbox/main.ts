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
import type {
  AnalyzeResponse,
  NoMomentResponse,
  RewriteMode,
  RewriteResponse,
  SafetyResponse,
} from '../src/lib/contracts'
import { SecondWordBadge } from '../extension/src/badge'
import { createScheduler } from '../extension/src/scheduler'
import { SecondWordPanel, type AnalyzeOptions } from '../src/ui/panel'
import { SCENARIOS, type Scenario } from './scenarios'

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

/**
 * "It looked, on its own, and could not reach the reading service." Shown only
 * when a live call fails, so a rate-limited demo still shows the automatic
 * behaviour rather than looking dead. Cleared the moment typing resumes.
 */
function showChecked(): void {
  statusSlot.replaceChildren()
  const dot = document.createElement('span')
  dot.className = 'status__dot'
  statusSlot.append(dot, document.createTextNode('Second Word checked this on its own — the reading service is busy right now.'))
  statusSlot.classList.add('status--on')
}

function clearChecked(): void {
  statusSlot.classList.remove('status--on')
  statusSlot.replaceChildren()
}

let scenario: Scenario = SCENARIOS[0]!
let panel: SecondWordPanel | null = null
let badge: SecondWordBadge | null = null
let lastEvaluated = ''
let debounceTimer: number | undefined

/** Same as the extension: never on keypress, and never twice for one draft. */
const DEBOUNCE_MS = 800
const scheduler = createScheduler<AnalyzeResponse | SafetyResponse | NoMomentResponse>()

// ---------------------------------------------------------------------------
// Scenario switching
// ---------------------------------------------------------------------------

function renderScenario(next: Scenario): void {
  scenario = next
  closePanel()
  chipSlot.replaceChildren()
  clearChecked()
  lastEvaluated = ''

  el('location').textContent = next.location
  el('from').textContent = next.received.from
  el('meta').textContent = next.received.meta
  el('body').textContent = next.received.body
  el('composer-label').textContent = next.composerLabel

  draftField.value = ''
  draftField.placeholder = next.placeholder

  for (const tab of tabsNav.children) {
    tab.classList.toggle('tab--on', (tab as HTMLElement).dataset.id === next.id)
  }
}

for (const item of SCENARIOS) {
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.className = 'tab'
  tab.dataset.id = item.id
  tab.textContent = item.tab
  tab.addEventListener('click', () => renderScenario(item))
  tabsNav.append(tab)
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

function closePanel(): void {
  panel?.destroy()
  panel = null
  panelSlot.replaceChildren()
  badge?.destroy()
  badge = null
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
      draftField.focus()
    },
  })
}

/** The invitation. You press it because you know this one matters. */
inviteButton.addEventListener('click', () => {
  if (!draftField.value.trim()) {
    draftField.focus()
    return
  }
  closePanel()
  chipSlot.replaceChildren()
  panel = buildPanel()
  panelSlot.append(panel.host)
  panel.renderConsent(true)
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
    // The one place a live failure is worth surfacing. It fired on its own and
    // the reading service could not answer, so say exactly that rather than go
    // blank, which would make an automatic product look like it did nothing.
    // Never shown for silence: silence is a 200 and does not throw.
    badge?.destroy()
    badge = null
    showChecked()
    return
  }

  // Clear the thinking dot before deciding what, if anything, to show.
  badge?.destroy()
  badge = null

  if (result === null) return // Superseded: the draft it describes is gone.
  if (panel || draftField.value !== draft) return

  if ('verified_reference_id' in result) {
    showBadge(result)
  } else if ('safety_flags' in result && result.safety_flags.length > 0) {
    // A self-harm, abuse, threat or crisis signal. Not a passage, but never
    // silence either: this is the moment showing up gently matters most.
    showBadge(result)
  }
  // Otherwise the model said nothing is at stake. Nothing renders. Correct.
}

/** Automatic detection is not automatic interruption. The badge waits. */
function showBadge(result: AnalyzeResponse | SafetyResponse): void {
  const safety = !('verified_reference_id' in result)
  badge?.destroy()
  badge = new SecondWordBadge({
    field: draftField,
    label: '\u201C',
    title: safety ? 'Take a moment' : 'Something here may be worth a second look',
    onOpen: () => {
      badge?.destroy()
      badge = null
      closePanel()
      panel = buildPanel()
      panelSlot.append(panel.host)
      // Already paid for. Re-running it to display it would be a second call.
      if ('verified_reference_id' in result) panel.present(result)
      else panel.presentSafety(result)
    },
  })
}

draftField.addEventListener('input', () => {
  clearChecked()
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => void evaluateDraft(), DEBOUNCE_MS)
})

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

async function analyze(
  draft: string,
  options: AnalyzeOptions & { received?: string },
): Promise<AnalyzeResponse | SafetyResponse | NoMomentResponse> {
  const response = await fetch(`${API_BASE}/v1/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      draft,
      surface: scenario.surface,
      ...(options.principle ? { principle_hint: options.principle } : {}),
      ...(options.context ? { context: options.context } : {}),
      ...(options.received ? { received_message: options.received } : {}),
    }),
  })
  if (!response.ok) throw new Error(`analyze failed: ${response.status}`)
  return (await response.json()) as AnalyzeResponse | SafetyResponse | NoMomentResponse
}

async function rewrite(draft: string, token: string, modes: RewriteMode[]): Promise<RewriteResponse> {
  const response = await fetch(`${API_BASE}/v1/rewrite`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ draft, analysis_token: token, modes, received_message: scenario.received.body }),
  })
  if (!response.ok) throw new Error(`rewrite failed: ${response.status}`)
  return (await response.json()) as RewriteResponse
}

/**
 * The epigraph comes from YouVersion too. No verse text is ever hardcoded.
 *
 * Every failure path removes the element. Returning early on a bad response
 * left an empty quote block with a rule and no words in it, which looks like
 * the product broke rather than like nothing happened.
 */
async function loadEpigraph(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/v1/epigraph`)
    if (!response.ok) throw new Error(String(response.status))

    const body = (await response.json()) as { verse_text?: string; reference?: string; translation?: string }
    if (!body.verse_text) throw new Error('no verse text')

    el('epigraph-text').textContent = body.verse_text
    el('epigraph-ref').textContent = `${body.reference ?? ''} ${body.translation ?? ''}`.trim()
  } catch {
    // The page reads fine without it. Never show placeholder Scripture.
    el('epigraph').remove()
  }
}

/**
 * Say which model actually read the draft, rather than naming the one the
 * competition requires and hoping nobody checks.
 */
async function loadProvider(): Promise<void> {
  const label = document.querySelector<HTMLElement>('#provider')
  if (!label) return
  try {
    const response = await fetch(`${API_BASE}/health`)
    if (!response.ok) return
    const body = (await response.json()) as { llm_provider?: string }
    const provider = body.llm_provider
    label.textContent =
      provider === 'gloo'
        ? 'Gloo AI Studio'
        : provider === 'workers-ai'
          ? 'Cloudflare Workers AI, standing in for Gloo AI Studio while its credentials are unavailable'
          : (provider ?? 'an unknown provider')
  } catch {
    // Leave the neutral wording already in the page.
  }
}

// ---------------------------------------------------------------------------

fillButton.addEventListener('click', () => {
  closePanel()
  chipSlot.replaceChildren()
  lastEvaluated = ''
  draftField.value = scenario.suggestedDraft
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
  chipSlot.replaceChildren()
  const note = document.createElement('span')
  note.className = 'sent'
  note.textContent = 'Sent. Nothing left this page.'
  chipSlot.append(note)
  draftField.value = ''
  lastEvaluated = ''
})

renderScenario(SCENARIOS[0]!)
void loadEpigraph()
void loadProvider()
