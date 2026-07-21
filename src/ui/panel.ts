/**
 * The Second Word panel.
 *
 * Framework-free and rendered into a shadow root, because the same component
 * has to survive injection into someone else's page later. No styles in, no
 * styles out, no bundle weight in a content script.
 *
 * The order of states is the product argument:
 *   chip -> consent -> passage and question -> (only if asked) rewrites
 *
 * Nothing is transmitted before consent. Nothing is replaced without a click.
 */

import type {
  AnalyzeResponse,
  NoMomentResponse,
  Principle,
  RewriteMode,
  RewriteResponse,
  SafetyResponse,
  VerseOfTheDayResponse,
} from '../lib/contracts'
import { PRINCIPLE_LIBRARY, SELECTABLE_MOMENTS } from '../lib/scripture-library'
import { balanceQuotes } from '../lib/verse-of-the-day'
import { PANEL_STYLES } from './styles'

export interface AnalyzeOptions {
  /** A moment the person named themselves. */
  principle?: Principle
  /** One line of context, typed by them. Never scraped from the page. */
  context?: string
}

export interface PanelCallbacks {
  /** Called only after the user explicitly consents. */
  onAnalyze(options: AnalyzeOptions): Promise<AnalyzeResponse | SafetyResponse | NoMomentResponse>
  /** Called only when the user asks for alternatives. */
  onRewrite(analysisToken: string, modes: RewriteMode[]): Promise<RewriteResponse>
  /** Replace the draft in the host composer. Returns the previous text for undo. */
  onReplace(text: string): string
  onClose(): void
}

const MODE_LABELS: Record<RewriteMode, string> = {
  clearer: 'Clearer',
  curious: 'Curious',
  firm_and_gracious: 'Firm and gracious',
}

const REQUESTED_MODES: RewriteMode[] = ['clearer', 'curious', 'firm_and_gracious']

type AnalyzeOutcome = AnalyzeResponse | SafetyResponse | NoMomentResponse

function isSafety(body: AnalyzeOutcome): body is SafetyResponse {
  return 'safety_flags' in body && Array.isArray(body.safety_flags) && body.safety_flags.length > 0
}

function isNoMoment(body: AnalyzeOutcome): body is NoMomentResponse {
  return 'needs_reflection' in body && body.needs_reflection === false
}

export class SecondWordPanel {
  readonly host: HTMLElement
  private readonly root: ShadowRoot
  private readonly callbacks: PanelCallbacks
  private analysis: AnalyzeResponse | null = null
  private chosenPrinciple: Principle | undefined
  private typedContext: string | undefined

  constructor(callbacks: PanelCallbacks) {
    this.callbacks = callbacks
    this.host = document.createElement('div')
    this.host.setAttribute('data-second-word', '')
    this.root = this.host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = PANEL_STYLES
    this.root.append(style)
  }

  /** The chip. Appearing costs nothing and sends nothing. */
  renderChip(onOpen: () => void): void {
    this.clear()
    const chip = el('button', 'chip')
    chip.type = 'button'
    chip.append(el('span', 'chip__dot'), text('Pause before sending?'))
    chip.addEventListener('click', onOpen)
    this.root.append(chip)
  }

  /**
   * The consent screen. This is the privacy promise, stated before it matters.
   *
   * `invited` is the path where the person pressed Second Word themselves
   * rather than being offered a chip. It asks what they are writing into,
   * because we never read the message they are replying to.
   */
  renderConsent(invited = false): void {
    const body = this.panel()

    body.append(heading(invited ? 'What are you writing into?' : 'Reflect on this draft?'))

    if (invited) {
      body.append(
        paragraph('consent__body', 'Pick one if it helps. You can skip it.'),
        this.momentPicker(),
        this.contextField(),
      )
    }

    body.append(
      paragraph(
        'consent__body',
        'Only the text in this reply box is sent',
        invited ? ', with anything you typed above.' : '.',
        ' The page, thread, username, and account history stay in your browser.',
      ),
    )

    const actions = el('div', 'actions')
    const confirm = button('Reflect with Scripture', 'action action--primary')
    const cancel = button('Not now', 'action')

    confirm.addEventListener('click', () => void this.runAnalysis(confirm))
    cancel.addEventListener('click', () => this.callbacks.onClose())

    actions.append(confirm, cancel)
    body.append(actions)
  }

  /** The moments a person recognises without being told they are angry. */
  private momentPicker(): HTMLElement {
    const list = el('div', 'moments')

    for (const principle of SELECTABLE_MOMENTS) {
      const option = button(PRINCIPLE_LIBRARY[principle].moment, 'moment')
      option.addEventListener('click', () => {
        const alreadyChosen = this.chosenPrinciple === principle
        this.chosenPrinciple = alreadyChosen ? undefined : principle
        for (const node of list.children) node.classList.remove('moment--on')
        if (!alreadyChosen) option.classList.add('moment--on')
      })
      list.append(option)
    }
    return list
  }

  private contextField(): HTMLElement {
    const wrapper = el('div', 'context')
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'context__input'
    input.placeholder = 'Or say it in your own words'
    input.maxLength = 240
    input.addEventListener('input', () => {
      this.typedContext = input.value.trim() || undefined
    })
    wrapper.append(input)
    return wrapper
  }

  private async runAnalysis(trigger: HTMLButtonElement): Promise<void> {
    trigger.disabled = true
    trigger.textContent = 'Reading'

    try {
      const result = await this.callbacks.onAnalyze({
        principle: this.chosenPrinciple,
        context: this.typedContext,
      })
      if (isSafety(result)) {
        this.renderSafety(result)
        return
      }
      // Silence is a real answer, so it gets a real state rather than an
      // apology or an empty panel.
      if (isNoMoment(result)) {
        this.renderNoMoment(result)
        return
      }
      this.analysis = result as AnalyzeResponse
      this.renderPassage(result as AnalyzeResponse)
    } catch {
      this.renderError('Reflection is unavailable right now. Your draft has not changed.')
    }
  }

  /**
   * Show a passage the caller already has.
   *
   * The ambient path analyses before there is any UI, so by the time the badge
   * is clicked the answer is in hand. Re-running the analysis to display it
   * would be a second request for a result we already paid for.
   */
  present(result: AnalyzeResponse): void {
    this.analysis = result
    this.renderPassage(result)
  }

  /**
   * Show a safety response the caller already has.
   *
   * A draft that signals self-harm, abuse, a threat or crisis is routed here
   * instead of to a passage. The ambient path must not swallow it as silence:
   * the moment someone writes that they want to give up is the moment showing
   * up gently matters most.
   */
  presentSafety(result: SafetyResponse): void {
    this.renderSafety(result)
  }

  /** Presence stays a quiet icon until the person asks to see today's verse. */
  presentVerseOfTheDay(result: VerseOfTheDayResponse): void {
    const body = this.panel()
    body.append(el('p', 'guide__kicker', 'Verse of the Day'))

    const eyebrow = el('div', 'eyebrow')
    eyebrow.append(text(result.display_reference), el('span', 'eyebrow__translation', result.translation))
    const passage = el('p', 'passage')
    passage.append(el('span', 'passage__marker', verseNumber(result.verified_reference_id)))
    passage.append(text(balanceQuotes(result.verse_text)))
    body.append(eyebrow, passage)

    const actions = el('div', 'actions')
    const close = button('Return to my message', 'action')
    close.addEventListener('click', () => this.callbacks.onClose())
    actions.append(close)
    body.append(actions, this.attribution(result))
  }

  private renderPassage(result: AnalyzeResponse): void {
    const body = this.panel()
    body.dataset.experience = result.experience
    if (result.experience === 'guide') {
      body.append(el('p', 'guide__kicker', 'A word for this good moment'))
    }

    const eyebrow = el('div', 'eyebrow')
    eyebrow.append(text(result.display_reference))
    if (result.translation) {
      eyebrow.append(el('span', 'eyebrow__translation', result.translation))
    }

    // The hanging marker, as a Bible page sets it.
    const passage = el('p', 'passage')
    passage.append(el('span', 'passage__marker', verseNumber(result.verified_reference_id)))
    passage.append(text(result.verse_text))

    body.append(eyebrow, passage)

    if (result.why) body.append(el('p', 'gloss', result.why))

    // Guide recognises something already good. Asking the person to examine
    // their motive turns affirmation back into suspicion, so only Guard asks.
    if (result.experience === 'guard' && result.question) {
      body.append(el('hr', 'rule'), el('p', 'question', result.question))
    }

    const actions = el('div', 'actions')
    const keepEditing = button('Keep editing', 'action')
    const keepOriginal = button('Keep original', 'action')

    keepEditing.addEventListener('click', () => this.callbacks.onClose())
    keepOriginal.addEventListener('click', () => this.callbacks.onClose())

    if (result.experience === 'guide') {
      keepOriginal.textContent = 'Return to my message'
      actions.append(keepOriginal)
    } else {
      const alternatives = button('Show alternatives', 'action action--primary')
      alternatives.addEventListener('click', () => void this.runRewrites(alternatives))
      actions.append(alternatives, keepEditing, keepOriginal)
    }
    body.append(actions, this.attribution(result))
  }

  private async runRewrites(trigger: HTMLButtonElement): Promise<void> {
    if (!this.analysis?.analysis_token) return
    trigger.disabled = true
    trigger.textContent = 'Working'

    try {
      const result = await this.callbacks.onRewrite(this.analysis.analysis_token, REQUESTED_MODES)
      // Its job is done; leaving a disabled button behind is just clutter.
      trigger.remove()
      this.renderRewrites(result)
    } catch {
      trigger.disabled = false
      trigger.textContent = 'Show alternatives'
      this.appendStatus('Alternatives could not be generated. You can keep editing your original draft.')
    }
  }

  private renderRewrites(result: RewriteResponse): void {
    const existing = this.root.querySelector('.rewrites')
    existing?.remove()

    const body = this.root.querySelector('.panel__body')
    if (!body) return

    const list = el('div', 'rewrites')

    for (const mode of REQUESTED_MODES) {
      const value = result.rewrites[mode]
      if (!value) continue

      const card = el('div', 'rewrite')
      card.append(el('div', 'rewrite__label', MODE_LABELS[mode]), el('p', 'rewrite__text', value))

      const controls = el('div', 'rewrite__actions')
      const use = el('button', 'rewrite__button', 'Replace my draft') as HTMLButtonElement
      const copy = el('button', 'rewrite__button', 'Copy') as HTMLButtonElement

      use.addEventListener('click', () => this.replaceDraft(value))
      copy.addEventListener('click', () => {
        void navigator.clipboard?.writeText(value)
        copy.textContent = 'Copied'
      })

      controls.append(use, copy)
      card.append(controls)
      list.append(card)
    }

    // Alternatives sit below the question, never above it.
    const actions = this.root.querySelector('.actions')
    actions ? actions.before(list) : body.append(list)
  }

  /** Replacement is explicit, and immediately undoable. */
  private replaceDraft(value: string): void {
    const previous = this.callbacks.onReplace(value)
    const body = this.panel()

    const row = el('div', 'undo')
    row.append(el('p', 'status', 'Your draft was replaced.'))

    const undo = button('Undo', 'action')
    undo.addEventListener('click', () => {
      this.callbacks.onReplace(previous)
      this.callbacks.onClose()
    })

    row.append(undo)
    body.append(row)

    const done = el('div', 'actions')
    const close = button('Done', 'action action--primary')
    close.addEventListener('click', () => this.callbacks.onClose())
    done.append(close)
    body.append(done)
  }

  /** Nothing was at stake. Say so plainly and get out of the way. */
  private renderNoMoment(result: NoMomentResponse): void {
    const body = this.panel()
    body.append(el('p', 'quiet', result.message))

    const actions = el('div', 'actions')
    const close = button('Back to your draft', 'action')
    close.addEventListener('click', () => this.callbacks.onClose())
    actions.append(close)
    body.append(actions)
  }

  private renderSafety(result: SafetyResponse): void {
    const body = this.panel()
    body.append(heading('You are not alone'), el('p', 'safety__lead', 'This message can wait. You matter more than it.'), el('p', 'status', result.message))
    if (result.verse_text && result.display_reference) {
      body.append(el('p', 'verse__text', result.verse_text), el('p', 'eyebrow', `${result.display_reference}${result.translation ? ` · ${result.translation}` : ''}`))
      if (result.attribution) body.append(this.attribution(result))
    }

    const actions = el('div', 'actions')
    const close = button('Return to my draft', 'action')
    close.addEventListener('click', () => this.callbacks.onClose())
    actions.append(close)
    body.append(actions)
  }

  private renderError(message: string): void {
    const body = this.panel()
    body.append(el('p', 'status', message))

    const actions = el('div', 'actions')
    const close = button('Close', 'action')
    close.addEventListener('click', () => this.callbacks.onClose())
    actions.append(close)
    body.append(actions)
  }

  private appendStatus(message: string): void {
    this.root.querySelector('.panel__body')?.append(el('p', 'status', message))
  }

  /**
   * Attribution is a licence requirement, not a nicety.
   *
   * The publisher notice comes from the platform verbatim and is displayed
   * verbatim, line breaks included. Never paraphrase it.
   */
  private attribution(result: { attribution?: string; attribution_url?: string | null }): HTMLElement {
    const disclosure = document.createElement('details')
    disclosure.className = 'references'
    const summary = document.createElement('summary')
    summary.textContent = 'References'
    const note = el('p', 'footnote')
    if (result.attribution) note.append(text(result.attribution))

    if (result.attribution_url) {
      const link = document.createElement('a')
      link.href = result.attribution_url
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = 'via YouVersion'
      note.append(text('\n'), link)
    }
    disclosure.append(summary, note)
    return disclosure
  }

  private panel(): HTMLElement {
    this.clear()
    const panel = el('div', 'panel')
    const header = el('div', 'panel__header')
    header.append(el('span', 'panel__name', 'Second Word'))
    const dismiss = button('×', 'panel__dismiss')
    dismiss.setAttribute('aria-label', 'Dismiss Second Word')
    dismiss.title = 'Dismiss'
    dismiss.addEventListener('click', () => this.callbacks.onClose())
    header.append(dismiss)
    const body = el('div', 'panel__body')
    panel.append(header, body)
    this.root.append(panel)
    return body
  }

  private clear(): void {
    for (const node of [...this.root.children]) {
      if (node.tagName !== 'STYLE') node.remove()
    }
  }

  destroy(): void {
    this.host.remove()
  }
}

// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (textContent !== undefined) node.textContent = textContent
  return node
}

function button(label: string, className: string): HTMLButtonElement {
  const node = el('button', className, label)
  node.type = 'button'
  return node
}

function heading(value: string): HTMLElement {
  return el('h2', 'consent__title', value)
}

function paragraph(className: string, ...parts: string[]): HTMLElement {
  return el('p', className, parts.join(''))
}

function text(value: string): Text {
  return document.createTextNode(value)
}

/** PRO.15.1 -> "1". The verse number a Bible page hangs in the margin. */
function verseNumber(referenceId: string): string {
  return referenceId.split('.')[2] ?? ''
}
