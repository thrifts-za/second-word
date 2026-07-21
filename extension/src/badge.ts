/**
 * The badge: the only thing Second Word puts on screen uninvited.
 *
 * It is a mark in the corner of the box you are typing in, and it does nothing
 * except exist until you click it. That is the whole design. Grammarly never
 * blocks Send, never edits, never opens a modal at you; it renders a badge and
 * waits. Automatic detection is not automatic interruption. See D2.
 *
 * Mechanics are taken from GemType's overlay, which ships this on real sites:
 *
 *   D28  never inside the field being watched
 *   D29  measure on events, coalesced to one per frame, never in a loop
 *   D32  check visibility first, and hide instead of positioning
 *   D33  pin the styles a host page could otherwise undo
 *   D34  the reconciliation poll doubles as the lifecycle check
 *   D35  bottom right of the field, clamped to the viewport
 */

/** Diameter, and the inset used to place it inside the field's corner. */
export const BADGE_SIZE = 34

/**
 * The collapsed mark, for a composer whose text has reached the corner.
 *
 * Grammarly's own answer to this collision, and the right one: the labelled
 * control becomes a dot the moment the words arrive, rather than sitting on
 * top of them. Ours belongs inside the box, so it has to yield inside the box.
 */
export const BADGE_COMPACT_SIZE = 14
/** Conservative width used before a host browser has laid the prompt out. */
export const BADGE_PROMPT_WIDTH = 132

/** Width of the browser's resize grip, plus a little air. */
const GRIP_CLEARANCE = 18

/** Width of another assistant's badge, plus air. Grammarly's is about 28px. */
const NEIGHBOUR_CLEARANCE = 36

/**
 * Hosts other writing assistants mount on the page.
 *
 * Not an exhaustive list and cannot be. It covers the ones common enough that
 * a collision is likely, and costs one selector query per reposition.
 */
const NEIGHBOUR_SELECTOR = [
  'grammarly-extension',
  'grammarly-btn',
  'grammarly-desktop-integration',
  'gemtype-ext',
].join(',')

const RECONCILE_MS = 1000

export interface BadgeOptions {
  field: HTMLElement
  /** What the badge shows. One glyph or a small number. */
  label: string
  /** Why it appeared. D10: something uninvited owes an answer. */
  title: string
  onOpen: () => void
  /** A breathing dot while the model reads, so the box shows life. Not clickable. */
  thinking?: boolean
  /** Guide is a blessing/affirmation, visually distinct from Guard. */
  tone?: 'guide' | 'guard'
}

/**
 * Every property here is inline and `!important`.
 *
 * Two separate hazards. Sites that use web components ship rules like
 * `:not(:defined) { visibility: hidden }`, which match any custom element the
 * page does not know about, including ours. And a `transform` or `filter`
 * anywhere in the ancestor chain creates a containing block, which silently
 * turns `position: fixed` into something else entirely. D33.
 */
const HOST_STYLE: ReadonlyArray<readonly [string, string]> = [
  ['position', 'fixed'],
  ['top', '0'],
  ['left', '0'],
  ['width', '0'],
  ['height', '0'],
  ['z-index', '2147483646'],
  ['display', 'block'],
  ['visibility', 'visible'],
  ['opacity', '1'],
  ['transform', 'none'],
  ['filter', 'none'],
  ['pointer-events', 'none'],
]

/**
 * Clay, the accent already used on the passage card, not a warning colour.
 *
 * The first version was near-white on white and effectively invisible, which
 * fails D10 on its own terms: a signal nobody notices has not communicated
 * anything. It also must not read as an error. Grammarly's badge is red
 * because a mistake is a mistake. Nothing here is a mistake, including the
 * moments this exists for most.
 */
const SHADOW_STYLE = `
  .badge {
    position: fixed;
    min-width: ${BADGE_SIZE}px;
    height: ${BADGE_SIZE}px;
    padding: 0 10px 0 8px;
    border-radius: 17px;
    display: none;
    align-items: center;
    justify-content: center;
    gap: 6px;
    box-sizing: border-box;
    border: none;
    background: #c4705a;
    color: #fdfbf7;
    font: 600 11px/1 system-ui, -apple-system, 'Segoe UI', sans-serif;
    cursor: pointer;
    pointer-events: auto;
    box-shadow: 0 1px 4px rgba(38, 22, 16, 0.28);
    user-select: none;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }
  .badge:hover {
    transform: scale(1.08);
    box-shadow: 0 2px 7px rgba(38, 22, 16, 0.34);
  }
  .badge:focus-visible {
    outline: 2px solid #c4705a;
    outline-offset: 2px;
  }
  .badge.guide {
    background: #9a6a17;
    box-shadow: 0 1px 4px rgba(73, 45, 8, 0.25);
  }
  .badge.guide:focus-visible { outline-color: #9a6a17; }
  .badge .mark {
    font: 600 19px/.8 'Iowan Old Style', Palatino, 'Book Antiqua', Georgia, serif;
    transform: translateY(-1px);
  }
  .badge .copy {
    white-space: nowrap;
    letter-spacing: 0.01em;
  }

  /*
   * Collapsed. The words come back on hover and on keyboard focus, so the
   * explanation is never lost, only moved behind an intent to read it.
   */
  .badge.compact {
    min-width: ${BADGE_COMPACT_SIZE}px;
    width: ${BADGE_COMPACT_SIZE}px;
    height: ${BADGE_COMPACT_SIZE}px;
    padding: 0;
    gap: 0;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(38, 22, 16, 0.30);
  }
  .badge.compact .mark,
  .badge.compact .copy { display: none; }

  /* Thinking: a quiet breathing dot while the model reads. Shows life. */
  .badge.thinking {
    width: ${BADGE_SIZE}px;
    padding: 0;
    background: #fff;
    border: 1px solid #d8d5ce;
    box-shadow: 0 1px 3px rgba(38, 22, 16, 0.14);
    cursor: default;
  }
  .badge.thinking:hover { transform: none; }
  .badge .pulse {
    width: 9px; height: 9px;
    border-radius: 50%;
    background: #c4705a;
    animation: sw-breathe 1.15s ease-in-out infinite;
  }
  @keyframes sw-breathe {
    0%, 100% { opacity: 0.3; transform: scale(0.75); }
    50%      { opacity: 1;   transform: scale(1); }
  }
`

export class SecondWordBadge {
  readonly host: HTMLElement
  readonly element: HTMLElement

  private readonly field: HTMLElement
  private readonly reconcile: ReturnType<typeof setInterval>
  private framePending = false
  private destroyed = false
  /** Hovered or focused: the person is reaching for it, so it shows its words. */
  private attended = false

  constructor(options: BadgeOptions) {
    this.field = options.field

    // D28. Our own host on the document, never a node inside their field.
    this.host = document.createElement('second-word-badge')
    for (const [property, value] of HOST_STYLE) {
      this.host.style.setProperty(property, value, 'important')
    }
    const root = this.host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = SHADOW_STYLE
    root.append(style)

    this.element = document.createElement('div')
    this.element.title = options.title

    if (options.thinking) {
      // A breathing dot, no label, not interactive. It says "I am reading this"
      // for the couple of seconds the model takes, so the box is never dead.
      this.element.className = 'badge thinking'
      this.element.setAttribute('aria-label', 'Second Word is reading this')
      const pulse = document.createElement('span')
      pulse.className = 'pulse'
      this.element.append(pulse)
    } else {
      this.element.className = `badge ${options.tone === 'guide' ? 'guide' : 'guard'}`
      this.element.setAttribute('role', 'button')
      this.element.setAttribute('tabindex', '0')
      const mark = document.createElement('span')
      mark.className = 'mark'
      mark.textContent = options.label
      const copy = document.createElement('span')
      copy.className = 'copy'
      copy.textContent = options.tone === 'guide' ? 'A word for this good moment' : 'A word for this'
      this.element.append(mark, copy)
      this.element.setAttribute('aria-label', `Second Word: ${options.title}`)
      // Clicking must not pull the caret out of the message being written.
      this.element.addEventListener('mousedown', (event) => event.preventDefault())
      this.element.addEventListener('click', () => options.onOpen())

      // Reaching for it is the intent to read it, so the words come back.
      const attend = (on: boolean) => (): void => {
        this.attended = on
        this.reposition()
      }
      this.element.addEventListener('mouseenter', attend(true))
      this.element.addEventListener('mouseleave', attend(false))
      this.element.addEventListener('focus', attend(true))
      this.element.addEventListener('blur', attend(false))
    }

    root.append(this.element)
    ;(document.body ?? document.documentElement).append(this.host)

    this.schedule = this.schedule.bind(this)
    window.addEventListener('scroll', this.schedule, true)
    window.addEventListener('resize', this.schedule, true)
    this.field.addEventListener('scroll', this.schedule, true)

    // D34. Layout changes in ways nothing reports, and hosts remove composers
    // without saying so. One cheap check a second covers both.
    this.reconcile = setInterval(() => {
      if (!this.field.isConnected) {
        this.destroy()
        return
      }
      this.reposition()
    }, RECONCILE_MS)

    this.reposition()
  }

  /**
   * D29. Scroll fires at frame rate. Measuring per event is the case Grammarly
   * measured at over 90% CPU, so a burst collapses into one measurement.
   */
  private schedule(): void {
    if (this.framePending || this.destroyed) return
    this.framePending = true
    requestAnimationFrame(() => {
      this.framePending = false
      if (!this.destroyed) this.reposition()
    })
  }

  /** D32. Cheapest possible answer for a field nobody can currently see. */
  private visible(rect: DOMRect): boolean {
    if (!this.field.isConnected) return false
    if (rect.width === 0 || rect.height === 0) return false
    return !(
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    )
  }

  /**
   * How far left of the corner to sit, so the resize handle stays usable.
   *
   * A browser draws the drag grip in the bottom-right corner of a resizable
   * textarea, which is the same corner a badge wants. Grammarly put theirs
   * there and it was reported in 2018 as making textareas "next to impossible
   * to resize": https://news.ycombinator.com/item?id=16316937
   *
   * Costing someone the ability to resize their own message box, in order to
   * offer them a verse, is not a trade this product gets to make.
   */
  private gripInset(): number {
    if (!(this.field instanceof HTMLTextAreaElement)) return 0
    const resize = getComputedStyle(this.field).resize
    // jsdom reports '' rather than the CSS default of 'both'. Absent means
    // resizable, which is the safe assumption: we give up a few pixels.
    return resize === 'none' ? 0 : GRIP_CLEARANCE
  }

  /**
   * Room for a writing assistant that got here first.
   *
   * Grammarly's badge sits in the bottom-right corner of the field, which is
   * the corner ours wants, and most people who would want Second Word are
   * already running Grammarly. Two badges on the same pixel is a turf war
   * nobody asked for, and the one that loses is the person trying to write.
   *
   * Grammarly stamps the field it has claimed, so we can tell the difference
   * between "installed somewhere on this page" and "attached to this box":
   *   <div contenteditable="true" data-gramm_id="..." data-gramm="true"
   *        data-gramm_editor="true">
   *
   * We move. We were here second.
   */
  private neighbourInset(): number {
    const claimed =
      this.field.hasAttribute('data-gramm_id') ||
      this.field.getAttribute('data-gramm') === 'true' ||
      this.field.hasAttribute('data-gramm_editor')

    if (claimed) return NEIGHBOUR_CLEARANCE

    // Otherwise look for an assistant mounted anywhere on the page. Less
    // precise, but a badge slightly too far left costs nothing; one directly
    // on top of somebody else's costs both of us.
    const doc = this.field.ownerDocument
    return doc.querySelector(NEIGHBOUR_SELECTOR) ? NEIGHBOUR_CLEARANCE : 0
  }

  reposition(): void {
    if (this.destroyed) return

    // One rect per reposition, never one per rendered item. D31.
    const rect = this.field.getBoundingClientRect()
    if (!this.visible(rect)) {
      this.element.style.display = 'none'
      return
    }

    this.element.style.display = 'flex'

    // Decide the shape before measuring it: width and height both depend on it.
    this.element.classList.toggle('compact', this.crowded())
    const height = this.element.classList.contains('compact') ? BADGE_COMPACT_SIZE : BADGE_SIZE

    const neighbour = this.neighbourInset()
    const inset = Math.max(this.gripInset(), neighbour)
    // When Grammarly owns the bottom-right corner, move to the lower-left
    // rather than creating a second competing control in its hit target.
    const width = this.element.getBoundingClientRect().width || BADGE_PROMPT_WIDTH
    const left = neighbour > 0 ? rect.left + 10 : rect.right - width - inset
    this.element.style.left = `${Math.max(0, left)}px`
    // The dot keeps the pill's corner rather than dropping to the field's edge.
    const top = rect.bottom - BADGE_SIZE + (BADGE_SIZE - height) / 2
    this.element.style.top = `${Math.min(window.innerHeight - height, top)}px`
  }

  /**
   * Has the writing reached the corner the badge sits in?
   *
   * Measured on the box, not on the words: a composer whose content is within
   * one line of filling it is a composer whose next line lands under the
   * badge. Scrolled past full counts too, and is the common case.
   */
  private crowded(): boolean {
    if (this.attended) return false
    if (this.element.classList.contains('thinking')) return false
    const box = this.field.clientHeight
    if (!box) return false
    const line = Number.parseFloat(getComputedStyle(this.field).lineHeight)
    return this.field.scrollHeight > box - (Number.isFinite(line) ? line : 20)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    clearInterval(this.reconcile)
    window.removeEventListener('scroll', this.schedule, true)
    window.removeEventListener('resize', this.schedule, true)
    this.field.removeEventListener('scroll', this.schedule, true)
    this.host.remove()
  }
}
