/**
 * Gmail adapter.
 *
 * Gmail's compose body is a contenteditable div, not a textarea, and Gmail
 * rebuilds its DOM constantly. Selectors are ordered from most stable to most
 * incidental, and every one of them is a guess that can break: the fixture in
 * test/fixtures/gmail.ts is what keeps that guess honest.
 *
 * Nothing here reads the thread, the recipient, or the account. Only the draft.
 */

import { MAX_RECEIVED_LENGTH } from '../../../src/lib/contracts'
import type { ComposerAdapter } from './types'

/**
 * Gmail's own markers, best first.
 *
 * `g_editable` is the oldest and most stable. The `role`/`aria-label` pair is
 * the accessible name Gmail gives the body, which changes with UI language,
 * so it is matched loosely and used last.
 */
const COMPOSER_SELECTORS = [
  'div[g_editable="true"][role="textbox"]',
  'div[contenteditable="true"][role="textbox"][aria-label]',
  'div.Am.Al.editable[contenteditable="true"]',
] as const

/** Walk up to the compose window so the chip can be placed near its controls. */
const DIALOG_SELECTORS = ['div[role="dialog"]', 'div.nH.Hd', 'div.iN'] as const

/** The thread the compose box belongs to, so a reply reads its own conversation. */
const THREAD_SELECTORS = ['div[role="main"]', 'div.nH.if', 'div.ao9'] as const

/** One rendered message body. `a3s` is Gmail's long-standing marker. */
const MESSAGE_BODY_SELECTOR = 'div.a3s, div.ii.gt'

/**
 * Removed before reading.
 *
 * Quoted history is the important one: Gmail folds the entire prior thread
 * into every message, so reading a message whole is reading everything ever
 * said, disguised as one email.
 */
const STRIP_SELECTORS = [
  '.gmail_quote',
  'blockquote',
  '.gmail_signature',
  '.gmail_extra',
  'div[data-smartmail="gmail_signature"]',
] as const

/** Gmail's send button, used only to sit beside it, never to click it. */
const SEND_SELECTORS = [
  'div[role="button"][data-tooltip^="Send"]',
  'div[role="button"][aria-label^="Send"]',
  'div.dC',
] as const

function firstMatch(root: ParentNode, selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const found = root.querySelector<HTMLElement>(selector)
    if (found) return found
  }
  return null
}

function closestMatch(element: HTMLElement, selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const found = element.closest<HTMLElement>(selector)
    if (found) return found
  }
  return null
}

export const gmailAdapter: ComposerAdapter = {
  id: 'gmail',

  findComposers(root) {
    const found = new Set<HTMLElement>()
    for (const selector of COMPOSER_SELECTORS) {
      for (const node of root.querySelectorAll<HTMLElement>(selector)) found.add(node)
    }
    return [...found]
  },

  getDraft(element) {
    // innerText, not textContent: Gmail uses <div> and <br> for line breaks,
    // and textContent would run every paragraph together into one line.
    return (element.innerText ?? element.textContent ?? '').replace(/ /g, ' ').trimEnd()
  },

  setDraft(element, value) {
    // Gmail listens for input events to enable Send and to autosave the draft.
    // Writing text without dispatching leaves the UI believing the old draft
    // is still there, which loses the person's message on send.
    element.focus()

    const paragraphs = value.split('\n')
    element.replaceChildren()
    paragraphs.forEach((line, index) => {
      if (index > 0) element.append(document.createElement('br'))
      element.append(document.createTextNode(line))
    })

    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
    element.dispatchEvent(new Event('change', { bubbles: true }))

    placeCursorAtEnd(element)
  },

  getReceivedMessage(element) {
    const thread = closestMatch(element, THREAD_SELECTORS) ?? element.ownerDocument.body
    const messages = thread.querySelectorAll<HTMLElement>(MESSAGE_BODY_SELECTOR)
    // Gmail renders oldest first. The one being answered is the last.
    const latest = messages[messages.length - 1]
    if (!latest) return null

    // Clone before stripping. Editing the live thread would delete mail from
    // the person's own screen.
    const copy = latest.cloneNode(true) as HTMLElement
    for (const noise of copy.querySelectorAll(STRIP_SELECTORS.join(','))) noise.remove()

    const text = (copy.innerText ?? copy.textContent ?? '').replace(/ /g, ' ').trim()
    if (!text) return null
    return text.slice(0, MAX_RECEIVED_LENGTH)
  },

  attachAnchor(element) {
    const dialog = closestMatch(element, DIALOG_SELECTORS)
    if (!dialog) return null

    // Sit beside Send, never over it.
    const send = firstMatch(dialog, SEND_SELECTORS)
    const host = document.createElement('div')
    host.style.display = 'inline-flex'
    host.style.margin = '0 0 0 10px'
    host.style.verticalAlign = 'middle'

    if (send?.parentElement) {
      send.parentElement.append(host)
      return host
    }

    dialog.append(host)
    return host
  },

  panelAnchor(element) {
    const dialog = closestMatch(element, DIALOG_SELECTORS)
    if (!dialog) return null

    const host = document.createElement('div')
    host.setAttribute('data-second-word-panel', '')
    host.style.display = 'block'
    host.style.padding = '0 16px 14px'

    // Gmail's compose window grows to fit whatever you put in it. Measured on
    // live Gmail: an unconstrained panel made the window 1053px tall and
    // pushed its own header 53px above the top of the viewport, taking the
    // subject line with it. Cap the height here and scroll inside instead.
    //
    // Resolve to a plain pixel value rather than min(46vh, 420px): assigning a
    // CSS math function through style.maxHeight is silently dropped, and the
    // property reads back as an empty string with no error anywhere.
    host.style.setProperty('max-height', `${Math.min(420, Math.round(window.innerHeight * 0.46))}px`)
    host.style.setProperty('overflow-y', 'auto')
    host.style.setProperty('overscroll-behavior', 'contain')

    dialog.append(host)
    return host
  },

  canReplace(element) {
    // Check the attribute as well as the derived property. The property is
    // the more correct signal but is not universally implemented, and a
    // false negative here silently downgrades Replace to Copy for everyone.
    return element.isContentEditable === true || element.getAttribute('contenteditable') === 'true'
  },
}

function placeCursorAtEnd(element: HTMLElement): void {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}
