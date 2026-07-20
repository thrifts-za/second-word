/**
 * The adapter for everywhere else.
 *
 * Slack, Teams, WhatsApp Web, a comment box, a prompt box. Anywhere someone
 * types to another person. It knows nothing about any particular site, which is
 * the point: the word should reach the text box people are actually in, not
 * only the one email client we happened to write selectors for.
 *
 * Gmail extends this with the one thing only Gmail can do, which is read the
 * message being replied to.
 *
 * D28: nothing here is ever placed inside the field being watched. Grammarly
 * shipped in-field injection for years, and it corrupted user text, crashed
 * host pages, sent underline markup inside real emails, and got them explicitly
 * blocked by ProseMirror, Quill and Draft.js. Our UI lives in its own host.
 */

import type { ComposerAdapter } from './types'

/** Inputs where a passing glance is a security incident. D18. */
const FORBIDDEN_INPUT_TYPES = new Set(['password', 'hidden'])

const FORBIDDEN_AUTOCOMPLETE = /^(one-time-code|cc-|current-password|new-password)/i

/** Anyone can switch Second Word off, per field or per page. */
export const OPT_OUT_ATTRIBUTE = 'data-second-word'

function isContentEditable(node: Element | null): node is HTMLElement {
  if (!node || !(node instanceof HTMLElement)) return false
  return node.isContentEditable === true || node.getAttribute('contenteditable') === 'true'
}

/**
 * The editable element a focus event belongs to.
 *
 * Focus lands wherever the host put it, often several nodes deep inside a
 * contenteditable tree. The element we want is the outermost editable one, so
 * that reading and writing see the whole draft rather than one paragraph.
 */
export function findEditable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null

  const field = target.closest('textarea, input')
  if (field instanceof HTMLElement) return field

  if (!isContentEditable(target)) {
    const editableAncestor = target.closest('[contenteditable="true"]')
    if (!isContentEditable(editableAncestor)) return null
    return topmostEditable(editableAncestor)
  }

  return topmostEditable(target)
}

function topmostEditable(node: HTMLElement): HTMLElement {
  let current = node
  while (isContentEditable(current.parentElement)) {
    current = current.parentElement as HTMLElement
  }
  return current
}

/**
 * Below this, a box is not somewhere anyone writes to a person.
 *
 * Grammarly publishes the exact test they use, and a decade of shipping is
 * behind the numbers:
 *
 *   $0.clientWidth > 301 && $0.clientHeight > 38
 *
 * https://support.grammarly.com/hc/en-us/articles/115000090392
 *
 * The reason underneath is intent, not pixels. A search field, a filter, a
 * username box: nothing written there is ever addressed to a person, so
 * nothing there can be a moment. Skipping them is not an optimisation, it is
 * the product refusing to turn up where it has no business.
 */
const MIN_FIELD_WIDTH = 301
const MIN_FIELD_HEIGHT = 38

/**
 * Not our attribute, and honoured anyway.
 *
 * `data-gramm="false"` is what site owners already write to mean "no writing
 * assistant in here", and it is the only such convention that exists. Ignoring
 * it because it carries a competitor's name would be reading the letter of the
 * request over its plain intent, on someone else's page.
 */
const FOREIGN_OPT_OUT = '[data-gramm="false"]'

/** Whether Second Word is allowed to watch this field at all. */
export function isEligibleField(element: HTMLElement): boolean {
  if (element.closest(`[${OPT_OUT_ATTRIBUTE}="off"]`)) return false
  if (element.closest(FOREIGN_OPT_OUT)) return false

  if (element instanceof HTMLInputElement) {
    if (FORBIDDEN_INPUT_TYPES.has(element.type)) return false
    const autocomplete = element.getAttribute('autocomplete') ?? ''
    if (FORBIDDEN_AUTOCOMPLETE.test(autocomplete)) return false
  }

  const rect = element.getBoundingClientRect()
  // Zero by zero means "not laid out yet", not "too small". A composer that
  // mounts hidden and is revealed on click would otherwise be skipped forever.
  const measured = rect.width > 0 || rect.height > 0
  if (measured && (rect.width <= MIN_FIELD_WIDTH || rect.height <= MIN_FIELD_HEIGHT)) {
    return false
  }

  return true
}

function isValueField(element: HTMLElement): element is HTMLTextAreaElement | HTMLInputElement {
  return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement
}

/** Our own host, appended to the document. Never to the field. See D28. */
function createHost(): HTMLElement {
  const host = document.createElement('div')
  host.setAttribute('data-second-word-host', '')
  document.body.append(host)
  return host
}

export const genericAdapter: ComposerAdapter = {
  id: 'generic',

  findComposers(root) {
    const found = new Set<HTMLElement>()
    for (const node of root.querySelectorAll<HTMLElement>('textarea, [contenteditable="true"]')) {
      const editable = findEditable(node)
      if (editable && isEligibleField(editable)) found.add(editable)
    }
    return [...found]
  },

  getDraft(element) {
    if (isValueField(element)) return element.value
    // innerText, not textContent: hosts use <div> and <br> for line breaks, and
    // textContent would run every paragraph together into one line.
    return (element.innerText ?? element.textContent ?? '').replace(/ /g, ' ').trimEnd()
  },

  setDraft(element, value) {
    element.focus()

    if (isValueField(element)) {
      element.value = value
    } else {
      const paragraphs = value.split('\n')
      element.replaceChildren()
      paragraphs.forEach((line, index) => {
        if (index > 0) element.append(document.createElement('br'))
        element.append(document.createTextNode(line))
      })
    }

    // Hosts listen for input events to enable their own Send button and to
    // autosave. Writing text without dispatching loses the message.
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  },

  /** Only a site-specific adapter can know what a conversation looks like. */
  getReceivedMessage() {
    return null
  },

  attachAnchor() {
    return createHost()
  },

  panelAnchor() {
    return createHost()
  },

  canReplace(element) {
    if (isValueField(element)) return !element.readOnly && !element.disabled
    return element.isContentEditable === true || element.getAttribute('contenteditable') === 'true'
  },
}
