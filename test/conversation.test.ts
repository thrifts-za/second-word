// @vitest-environment jsdom

/**
 * Reading the conversation on surfaces that are not Gmail.
 *
 * These fixtures are written from each product's published DOM markers, which
 * means they prove the rules are internally consistent and nothing more. The
 * Gmail lesson applies exactly: a fixture written from the same guess as the
 * selector agrees with itself and proves nothing about a real inbox. Every
 * surface still needs one live check, and docs/SURFACE-CHECKS.md carries the
 * console probe for it.
 *
 * What these tests do prove is the part that is ours rather than theirs: the
 * last message wins, my own messages are skipped, the composer is never read
 * as context, quoted material is stripped, and an unknown host stays silent.
 */

import { describe, expect, it } from 'vitest'
import { readConversation } from '../extension/src/adapters/conversation'

function mount(html: string): HTMLElement {
  document.body.replaceChildren()
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.append(root)
  return root
}

/** jsdom has no layout and no innerText; textContent is the honest stand-in. */
Object.defineProperty(HTMLElement.prototype, 'innerText', {
  get(this: HTMLElement) {
    return this.textContent ?? ''
  },
  configurable: true,
})

describe('reading the conversation', () => {
  it('takes the last message somebody else wrote, on Slack', () => {
    const root = mount(`
      <div class="thread">
        <div class="c-message_kit__blocks"><div class="p-rich_text_section">Morning all.</div></div>
        <div class="c-message_kit__blocks"><div class="p-rich_text_section">The client meeting fell apart this morning.</div></div>
        <div contenteditable="true" role="textbox" class="composer"></div>
      </div>`)
    const composer = root.querySelector<HTMLElement>('.composer')!

    expect(readConversation(composer, 'app.slack.com')).toBe('The client meeting fell apart this morning.')
  })

  it('skips my own last message, which is the follow-up case', () => {
    /*
     * I sent something, nobody replied, and I am writing again. Reading my own
     * words back as "what arrived" would weigh a reply against itself, which is
     * the exact error Proverbs 16:2 names.
     */
    const root = mount(`
      <div class="thread">
        <div class="c-message_kit__blocks"><div class="p-rich_text_section">Could you take a look at the handover?</div></div>
        <div class="c-message--is-by-me c-message_kit__blocks"><div class="p-rich_text_section">Bumping this, sorry.</div></div>
        <div contenteditable="true" role="textbox" class="composer"></div>
      </div>`)
    const composer = root.querySelector<HTMLElement>('.composer')!

    expect(readConversation(composer, 'app.slack.com')).toBe('Could you take a look at the handover?')
  })

  it('reads only incoming messages on WhatsApp', () => {
    const root = mount(`
      <div class="thread">
        <div class="message-in"><span class="selectable-text">My father passed away on Saturday.</span></div>
        <div class="message-out"><span class="selectable-text">I am so sorry.</span></div>
        <div contenteditable="true" role="textbox" class="composer"></div>
      </div>`)
    const composer = root.querySelector<HTMLElement>('.composer')!

    expect(readConversation(composer, 'web.whatsapp.com')).toBe('My father passed away on Saturday.')
  })

  it('strips quoted replies rather than reading them as the message', () => {
    const root = mount(`
      <div class="thread">
        <div data-tid="messageBodyContent">
          <div data-tid="quotedReply">Earlier: we agreed Friday.</div>
          The deadline is Wednesday and that is final.
        </div>
        <div contenteditable="true" role="textbox" class="composer"></div>
      </div>`)
    const composer = root.querySelector<HTMLElement>('.composer')!

    const read = readConversation(composer, 'teams.microsoft.com')
    expect(read).toContain('The deadline is Wednesday')
    expect(read).not.toContain('we agreed Friday')
  })

  it('never reads the composer itself as the message being answered', () => {
    // On X the composer and the post it replies to can carry the same marker.
    const root = mount(`
      <div class="thread">
        <div data-testid="tweetText">You have completely misrepresented what I said.</div>
        <div contenteditable="true" role="textbox" class="composer">
          <div data-testid="tweetText">Here is what I actually said, again.</div>
        </div>
      </div>`)
    const composer = root.querySelector<HTMLElement>('.composer')!

    expect(readConversation(composer, 'x.com')).toBe('You have completely misrepresented what I said.')
  })

  it('stays silent on a host it does not know', () => {
    // Wrong is worse than nothing. An unrecognised surface weighs the draft
    // alone, which is exactly what shipped before any of this existed.
    const root = mount(`
      <div class="thread">
        <div class="c-message_kit__blocks"><div class="p-rich_text_section">Something.</div></div>
        <div contenteditable="true" role="textbox" class="composer"></div>
      </div>`)
    const composer = root.querySelector<HTMLElement>('.composer')!

    expect(readConversation(composer, 'example.com')).toBeNull()
  })

  it('stays silent when the conversation holds nothing but my own messages', () => {
    const root = mount(`
      <div class="thread">
        <div class="c-message--is-by-me c-message_kit__blocks"><div class="p-rich_text_section">Anyone about?</div></div>
        <div contenteditable="true" role="textbox" class="composer"></div>
      </div>`)
    const composer = root.querySelector<HTMLElement>('.composer')!

    expect(readConversation(composer, 'app.slack.com')).toBeNull()
  })

  it('caps what it sends, like Gmail does', () => {
    const long = 'x'.repeat(4000)
    const root = mount(`
      <div class="thread">
        <div class="c-message_kit__blocks"><div class="p-rich_text_section">${long}</div></div>
        <div contenteditable="true" role="textbox" class="composer"></div>
      </div>`)
    const composer = root.querySelector<HTMLElement>('.composer')!

    expect(readConversation(composer, 'app.slack.com')!.length).toBeLessThanOrEqual(1200)
  })
})
