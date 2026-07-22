/**
 * Reading the message being answered, on surfaces that are not Gmail.
 *
 * Proverbs 16:2 is the product's deepest idea: a draft cannot be weighed
 * against itself. A reply to a decline letter is calm on its face and the whole
 * weight sits in what arrived. Until now that argument operated on exactly one
 * of nine surfaces, because only the Gmail adapter could see a thread.
 *
 * Every one of these products renders the conversation in the DOM directly
 * above the composer. The problem is the same as Gmail's and the shape of the
 * solution is the same: find the messages, take the last one that is not mine,
 * strip the noise, cap the length.
 *
 * Two rules govern everything here.
 *
 * **Wrong is worse than nothing.** A selector that misses returns null and the
 * model weighs the draft alone, which is the behaviour we already ship. A
 * selector that matches the wrong element feeds a stranger's words, or the
 * person's own previous message, into the analysis as context. So every rule
 * below is narrow, and anything ambiguous returns null.
 *
 * **Never my own last message.** On a chat surface the final bubble is very
 * often mine: I sent something, nobody replied, and I am following up. Reading
 * that as "what arrived" would weigh a person's reply against their own words,
 * which is precisely the error Proverbs 16:2 names.
 *
 * Selectors are best-effort against products that obfuscate and rotate their
 * class names, and are verified live per surface. See docs/SURFACE-CHECKS.md.
 */

import { MAX_RECEIVED_LENGTH } from '../../../src/lib/contracts'

interface SurfaceRule {
  /** Matched against location.host. */
  host: RegExp
  /** One rendered message body. */
  message: string
  /**
   * Marks a message as the person's own, tested against the message element
   * and its ancestors. Where a surface gives no reliable signal, leave this
   * undefined and rely on `message` matching only incoming messages.
   */
  mine?: string
  /** Removed from the copy before reading, like Gmail's quoted history. */
  strip?: string
}

const SURFACES: SurfaceRule[] = [
  {
    // Slack marks its own composer separately, so message blocks are safe to
    // query, but a channel mixes both sides freely.
    host: /(^|\.)slack\.com$/,
    message: '[data-qa="message-text"], .c-message_kit__blocks .p-rich_text_section',
    mine: '.c-message--is-by-me, [data-qa-is-by-me="true"]',
    strip: 'blockquote, .c-message_attachment, .c-message__edited_label',
  },
  {
    host: /(^|\.)teams\.microsoft\.com$/,
    message: '[data-tid="messageBodyContent"]',
    mine: '[data-tid="message-own"], .ui-chat__item--mine',
    strip: 'blockquote, [data-tid="quotedReply"]',
  },
  {
    // WhatsApp is the clearest of the set: incoming and outgoing carry
    // different classes on the row itself.
    host: /(^|\.)web\.whatsapp\.com$/,
    message: '.message-in .selectable-text',
    strip: '.quoted-mention, [data-testid="quoted-message"]',
  },
  {
    host: /(^|\.)x\.com$/,
    message: '[data-testid="tweetText"]',
  },
  {
    host: /(^|\.)linkedin\.com$/,
    message: '.msg-s-event-listitem__body, .comments-comment-item__main-content',
    mine: '.msg-s-event-listitem--user-own-message',
  },
  {
    host: /(^|\.)reddit\.com$/,
    message: '[data-test-id="post-content"] .md, shreddit-comment .md',
  },
]

/**
 * How far up from the composer to look for the conversation.
 *
 * Bounded rather than searching the document, so a page with an unrelated
 * message list somewhere else cannot supply context for this box.
 */
const SCOPE_LIMIT = 25

function ruleFor(host: string): SurfaceRule | null {
  return SURFACES.find((rule) => rule.host.test(host)) ?? null
}

/**
 * The nearest ancestor that actually contains messages.
 *
 * Walking up from the composer rather than querying the document means the
 * conversation we read is the one this box replies into, which matters on X
 * and Reddit where several threads can be on screen at once.
 */
function scopeFor(element: HTMLElement, selector: string): HTMLElement | null {
  /*
   * Start above the composer, and require a match outside it.
   *
   * On X the composer carries the same marker as a post, so starting at the
   * element found the draft itself, called that the conversation, and then
   * correctly refused to read it: the whole surface went silent. A scope has
   * to contain a message that is not the one being written.
   */
  let node: HTMLElement | null = element.parentElement
  for (let depth = 0; node && depth < SCOPE_LIMIT; depth += 1) {
    const outside = [...node.querySelectorAll<HTMLElement>(selector)].some(
      (message) => !element.contains(message),
    )
    if (outside) return node
    node = node.parentElement
  }
  return null
}

/**
 * The last message in this conversation that somebody else wrote.
 *
 * Returns null whenever the answer is not obvious, which is most of the time on
 * a surface we have not verified. Silence is the safe result: the draft is
 * still analysed, exactly as it is today.
 */
export function readConversation(element: HTMLElement, host: string): string | null {
  const rule = ruleFor(host)
  if (!rule) return null

  const scope = scopeFor(element, rule.message)
  if (!scope) return null

  const messages = [...scope.querySelectorAll<HTMLElement>(rule.message)]
  if (messages.length === 0) return null

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!
    // Mine, or inside the composer itself. Either way it is not what arrived.
    if (element.contains(message) || message.contains(element)) continue
    if (rule.mine && message.closest(rule.mine)) continue

    // Clone before stripping: editing the live conversation would delete
    // somebody's message from their own screen.
    const copy = message.cloneNode(true) as HTMLElement
    if (rule.strip) {
      for (const noise of copy.querySelectorAll(rule.strip)) noise.remove()
    }

    const text = (copy.innerText ?? copy.textContent ?? '').replace(/ /g, ' ').trim()
    if (!text) continue
    return text.slice(0, MAX_RECEIVED_LENGTH)
  }

  return null
}

/** Exposed so a live console check can report exactly what would be read. */
export const SURFACE_RULES: ReadonlyArray<SurfaceRule> = SURFACES
