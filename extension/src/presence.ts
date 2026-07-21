import type { VerseOfTheDayResponse } from '../../src/lib/contracts'
import { balanceQuotes } from '../../src/lib/verse-of-the-day'

const GAP = 10
const RECONCILE_MS = 1000

const HOST_STYLE: ReadonlyArray<readonly [string, string]> = [
  ['position', 'fixed'],
  ['top', '0'],
  ['left', '0'],
  ['width', '0'],
  ['height', '0'],
  ['z-index', '2147483645'],
  ['display', 'block'],
  ['visibility', 'visible'],
  ['opacity', '1'],
  ['transform', 'none'],
  ['filter', 'none'],
  ['pointer-events', 'none'],
]

const STYLES = `
  .presence {
    position: fixed;
    display: none;
    box-sizing: border-box;
    padding: 8px 11px;
    border-left: 2px solid #9a6a17;
    border-radius: 2px;
    /* Fully opaque. At 0.96 the composer's own placeholder read through the
       card, so the day's verse arrived with ghost words printed across it. */
    background: #fffefa;
    color: #4f4a40;
    box-shadow: 0 1px 4px rgba(45, 34, 18, 0.10);
    pointer-events: none;
    font-family: 'Iowan Old Style', Palatino, 'Book Antiqua', Georgia, serif;
  }
  .label {
    margin-bottom: 3px;
    color: #9a6a17;
    font: 600 9px/1.2 system-ui, -apple-system, 'Segoe UI', sans-serif;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .verse {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.4;
  }
  .meta {
    margin-top: 4px;
    color: #817b70;
    font: 9px/1.25 system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
`

/** A quiet, non-editable Verse of the Day layer over an empty composer. */
export class SecondWordPresence {
  readonly host: HTMLElement
  readonly element: HTMLElement

  private readonly field: HTMLElement
  private readonly reconcile: ReturnType<typeof setInterval>
  private framePending = false
  private destroyed = false

  constructor(field: HTMLElement, verse: VerseOfTheDayResponse) {
    this.field = field
    this.host = document.createElement('second-word-presence')
    for (const [property, value] of HOST_STYLE) this.host.style.setProperty(property, value, 'important')

    const root = this.host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = STYLES

    this.element = document.createElement('aside')
    this.element.className = 'presence'
    this.element.setAttribute('role', 'note')
    this.element.setAttribute('aria-label', `YouVersion Verse of the Day, ${verse.display_reference}`)

    const label = document.createElement('div')
    label.className = 'label'
    label.textContent = 'Verse of the Day'
    const text = document.createElement('p')
    text.className = 'verse'
    text.textContent = balanceQuotes(verse.verse_text)
    const meta = document.createElement('div')
    meta.className = 'meta'
    meta.textContent = `${verse.display_reference} · ${verse.translation} · ${verse.attribution}`
    meta.title = verse.attribution
    this.element.append(label, text, meta)
    root.append(style, this.element)
    ;(document.body ?? document.documentElement).append(this.host)

    this.schedule = this.schedule.bind(this)
    window.addEventListener('scroll', this.schedule, true)
    window.addEventListener('resize', this.schedule, true)
    this.field.addEventListener('scroll', this.schedule, true)
    this.reconcile = setInterval(() => {
      if (!this.field.isConnected) this.destroy()
      else this.reposition()
    }, RECONCILE_MS)
    this.reposition()
  }

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
    const rect = this.field.getBoundingClientRect()
    const visible =
      this.field.isConnected &&
      rect.width >= 320 &&
      rect.height >= 100 &&
      rect.bottom >= 0 &&
      rect.top <= window.innerHeight &&
      rect.right >= 0 &&
      rect.left <= window.innerWidth
    if (!visible) {
      this.element.style.display = 'none'
      return
    }

    // Width first: the height depends on how the verse wraps at this width.
    this.element.style.display = 'block'
    this.element.style.left = `${Math.max(GAP, rect.left)}px`
    this.element.style.width = `${Math.max(280, rect.width)}px`

    /*
     * Never inside the field's own rectangle. Sitting over the composer, the
     * day's verse reads as text somebody typed into the draft, which is the
     * one thing Second Word promises it never does. Above by preference,
     * below when there is no headroom, and always clear of the border.
     */
    const height = this.element.offsetHeight || this.element.getBoundingClientRect().height
    const above = rect.top - GAP - height
    this.element.style.top = `${above >= GAP ? above : rect.bottom + GAP}px`
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
