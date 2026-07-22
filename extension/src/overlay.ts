/**
 * Where the passage appears once someone opens it.
 *
 * The first version appended the card inside the host's own compose window,
 * which is the mistake D28 exists to prevent, and it showed: measured on live
 * Gmail the window grew to 1053px and pushed its own header off the top of the
 * screen. Capping the height only made it grow less. The window still grew,
 * because the card was inside it.
 *
 * It also could not work anywhere else. The generic adapter has no compose
 * window to append to, so on Slack or a prompt box the card landed at the
 * bottom of the page, far from the person who asked for it.
 *
 * So the card is an overlay, positioned against the field and owned by us,
 * exactly like the badge. The host page is never touched and never resized.
 */

const GAP = 8
const MAX_WIDTH = 440
const MIN_WIDTH = 300
/** Assumed card height before anything has been laid out. */
const TYPICAL_HEIGHT = 300
const RECONCILE_MS = 1000

/** See D33: two hazards, `:not(:defined)` rules and ancestor transforms. */
const HOST_STYLE: ReadonlyArray<readonly [string, string]> = [
  ['position', 'fixed'],
  ['top', '0'],
  ['left', '0'],
  ['width', '0'],
  ['height', '0'],
  ['z-index', '2147483647'],
  ['display', 'block'],
  ['visibility', 'visible'],
  ['opacity', '1'],
  ['transform', 'none'],
  ['filter', 'none'],
  ['pointer-events', 'none'],
]

export interface OverlayOptions {
  field: HTMLElement
  /** The panel's own host element. Placed inside the frame, not the page. */
  content: HTMLElement
  onDismiss?: () => void
}

export class SecondWordOverlay {
  readonly host: HTMLElement
  /** The positioned box the content sits in. */
  readonly frame: HTMLElement

  private readonly field: HTMLElement
  private readonly reconcile: ReturnType<typeof setInterval>
  private framePending = false
  private destroyed = false

  constructor(options: OverlayOptions) {
    this.field = options.field

    this.host = document.createElement('second-word-overlay')
    for (const [property, value] of HOST_STYLE) {
      this.host.style.setProperty(property, value, 'important')
    }

    this.frame = document.createElement('div')
    Object.assign(this.frame.style, {
      position: 'fixed',
      pointerEvents: 'auto',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
      background: '#16181d',
      scrollbarColor: 'rgba(236, 233, 226, 0.28) #16181d',
      scrollbarWidth: 'thin',
      borderRadius: '3px',
      boxShadow: '0 10px 34px rgba(20, 14, 10, 0.30)',
    })
    this.frame.className = 'second-word-overlay__frame'
    const scrollbarStyle = document.createElement('style')
    scrollbarStyle.textContent = `
      second-word-overlay > .second-word-overlay__frame::-webkit-scrollbar { width: 7px; }
      second-word-overlay > .second-word-overlay__frame::-webkit-scrollbar-track { background: #16181d; }
      second-word-overlay > .second-word-overlay__frame::-webkit-scrollbar-thumb {
        border: 2px solid #16181d;
        border-radius: 999px;
        background: rgba(236, 233, 226, 0.28);
      }
    `
    this.frame.append(options.content)
    this.host.append(scrollbarStyle, this.frame)
    ;(document.body ?? document.documentElement).append(this.host)

    this.schedule = this.schedule.bind(this)
    window.addEventListener('scroll', this.schedule, true)
    window.addEventListener('resize', this.schedule, true)
    this.field.addEventListener('scroll', this.schedule, true)

    // D34. Also the lifecycle check: a composer can vanish without a word.
    this.reconcile = setInterval(() => {
      if (!this.field.isConnected) {
        options.onDismiss?.()
        this.destroy()
        return
      }
      this.reposition()
    }, RECONCILE_MS)

    this.reposition()
  }

  /** D29. One measurement per frame at most, never a loop. */
  private schedule(): void {
    if (this.framePending || this.destroyed) return
    this.framePending = true
    requestAnimationFrame(() => {
      this.framePending = false
      if (!this.destroyed) this.reposition()
    })
  }

  reposition(): void {
    if (this.destroyed) return

    const field = this.field.getBoundingClientRect()
    const viewport = window.innerHeight

    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, field.width))
    this.frame.style.width = `${width}px`
    this.frame.style.left = `${Math.max(GAP, Math.min(field.left, window.innerWidth - width - GAP))}px`

    const below = viewport - field.bottom - GAP * 2
    const above = field.top - GAP * 2
    // Before first paint there is nothing to measure. Assuming zero would make
    // "does it fit below" trivially true and pin the card off the bottom of
    // the screen, so assume a typical card instead.
    /*
     * scrollHeight, not the rendered rect. The rect returns the height after
     * maxHeight has already clamped it, so the first cap became the measure
     * for every later one: a 367px card measured 300, asked for 300, and kept
     * a scrollbar forever no matter how much room was above it.
     */
    const wanted = this.frame.scrollHeight || TYPICAL_HEIGHT

    /*
     * Below reads more naturally, but the host's own controls live directly
     * under the field: Gmail's Send button, Slack's send arrow. Covering them
     * would make a product that promises never to block Send do exactly that
     * with a box of Scripture. So below is only used for a composer in the
     * upper half of the window, where there is something other than the Send
     * row underneath it.
     */
    const wouldCoverControls = field.bottom > viewport / 2

    /*
     * Whole card or nothing. The old rule accepted a side with 200px in it
     * for a card that wanted 330, so the card scrolled inside a box that does
     * not look scrollable and the buttons fell below the fold. Take a side
     * that fits the whole card, and only when neither does, take the larger.
     */
    const placeBelow = (): void => {
      this.frame.style.top = `${field.bottom + GAP}px`
      this.frame.style.maxHeight = `${Math.max(140, below)}px`
    }
    const placeAbove = (): void => {
      const height = Math.max(140, Math.min(above, wanted || above))
      this.frame.style.top = `${Math.max(GAP, field.top - GAP - height)}px`
      this.frame.style.maxHeight = `${height}px`
    }

    if (!wouldCoverControls && below >= wanted) placeBelow()
    else if (above >= wanted) placeAbove()
    else if (below > above && !wouldCoverControls) placeBelow()
    else placeAbove()
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
