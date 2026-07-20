/**
 * Living Margin: a local-only, non-destructive mark beneath the words that
 * caused Second Word to pause. Unlike a grammar underline it names no error;
 * it is a gentle visual bridge from a live phrase to a considered response.
 *
 * CSS Custom Highlights are ranges over the host's text nodes. They do not
 * insert spans, move a caret, or change the draft that will be sent. When a
 * host/browser does not support the API (including textareas), this returns
 * null and the usual badge remains the graceful fallback.
 */

interface HighlightRegistryLike {
  set(name: string, value: unknown): void
  delete(name: string): boolean
}

interface HighlightConstructorLike {
  new (...ranges: Range[]): unknown
}

export interface MomentMarker {
  destroy(): void
}

let nextMarkerId = 0

export function markMoments(field: HTMLElement, phrases: string[]): MomentMarker | null {
  // jsdom does not implement isContentEditable; the attribute is also the
  // reliable signal for a host that has just promoted an editable region.
  if (!field.isContentEditable && field.getAttribute('contenteditable') !== 'true') return null
  const css = (globalThis as typeof globalThis & {
    CSS?: { highlights?: HighlightRegistryLike }
  }).CSS
  const registry = css?.highlights
  const Highlight = (globalThis as typeof globalThis & { Highlight?: HighlightConstructorLike }).Highlight
  if (!registry || !Highlight) return null

  const ranges = rangesFor(field, phrases)
  if (ranges.length === 0) return null

  const name = `second-word-moment-${nextMarkerId++}`
  const style = ensureStyle(field.ownerDocument, name)
  registry.set(name, new Highlight(...ranges))

  return {
    destroy: () => {
      registry.delete(name)
      style.remove()
    },
  }
}

/** Find phrase ranges without touching the page's DOM or its editor model. */
function rangesFor(field: HTMLElement, phrases: string[]): Range[] {
  const wanted = [...new Set(phrases.map((phrase) => phrase.trim()).filter((phrase) => phrase.length > 2))]
  if (wanted.length === 0) return []

  const walker = field.ownerDocument.createTreeWalker(field, NodeFilter.SHOW_TEXT)
  const ranges: Range[] = []
  let node = walker.nextNode()
  while (node) {
    const text = node.textContent ?? ''
    const lower = text.toLowerCase()
    for (const phrase of wanted) {
      const needle = phrase.toLowerCase()
      let from = 0
      while (from < lower.length) {
        const start = lower.indexOf(needle, from)
        if (start === -1) break
        const range = field.ownerDocument.createRange()
        range.setStart(node, start)
        range.setEnd(node, start + needle.length)
        ranges.push(range)
        from = start + needle.length
      }
    }
    node = walker.nextNode()
  }
  return ranges
}

function ensureStyle(doc: Document, name: string): HTMLStyleElement {
  const style = doc.createElement('style')
  style.textContent = `::highlight(${name}) { background-color: rgba(196, 112, 90, 0.14); color: inherit; text-decoration: underline dotted rgba(150, 73, 55, 0.72) 2px; text-underline-offset: 3px; }`
  ;(doc.head ?? doc.documentElement).append(style)
  return style
}
