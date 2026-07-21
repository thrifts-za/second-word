// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { gmailAdapter } from '../extension/src/adapters/gmail'
import { isMounted, markMounted } from '../extension/src/adapters/types'
import { mountGmailCompose } from './fixtures/gmail'

describe('gmail adapter', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('finds the compose body', () => {
    const { body } = mountGmailCompose(document)
    expect(gmailAdapter.findComposers(document)).toEqual([body])
  })

  it('returns each composer once, even when several selectors match it', () => {
    // The fixture body carries g_editable, role=textbox and .Am.Al.editable,
    // so all three selectors hit the same element.
    mountGmailCompose(document)
    expect(gmailAdapter.findComposers(document)).toHaveLength(1)
  })

  it('finds nothing on a page with no composer', () => {
    const main = document.createElement('div')
    main.setAttribute('role', 'main')
    main.textContent = 'Inbox'
    document.body.append(main)
    expect(gmailAdapter.findComposers(document)).toEqual([])
  })

  it('reads the draft the person typed', () => {
    const { body } = mountGmailCompose(document, { draft: 'Thanks for letting me know.' })
    expect(gmailAdapter.getDraft(body)).toBe('Thanks for letting me know.')
  })

  it('never returns anything but the draft', () => {
    const { body } = mountGmailCompose(document, { draft: 'My reply.' })
    const draft = gmailAdapter.getDraft(body)

    // The compose window's own chrome is all around it on the page.
    expect(draft).not.toContain('New Message')
    expect(draft).not.toContain('Send')
    expect(draft).toBe('My reply.')
  })

  it('replaces the draft and tells Gmail about it', () => {
    const { body } = mountGmailCompose(document, { draft: 'You clearly did not read it.' })
    const events: string[] = []
    body.addEventListener('input', () => events.push('input'))
    body.addEventListener('change', () => events.push('change'))

    gmailAdapter.setDraft(body, 'I read it differently, and here is why.')

    expect(gmailAdapter.getDraft(body)).toBe('I read it differently, and here is why.')
    // Without these, Gmail keeps the old draft and sends that instead.
    expect(events).toContain('input')
    expect(events).toContain('change')
  })

  it('preserves paragraphs as line breaks', () => {
    const { body } = mountGmailCompose(document)
    gmailAdapter.setDraft(body, 'First line.\nSecond line.')
    expect(body.querySelectorAll('br')).toHaveLength(1)
  })

  it('mounts the anchor next to Send, not over it', () => {
    const { body, send } = mountGmailCompose(document)
    const anchor = gmailAdapter.attachAnchor(body)

    expect(anchor).not.toBeNull()
    expect(anchor?.parentElement).toBe(send.parentElement)
    expect(send.isConnected).toBe(true)
  })

  it('falls back to the dialog when Send cannot be found', () => {
    const { body, dialog, send } = mountGmailCompose(document)
    send.remove()

    const anchor = gmailAdapter.attachAnchor(body)
    expect(anchor?.parentElement).toBe(dialog)
  })

  it('mounts beside an inline reply, which is not a dialog', () => {
    /*
     * Measured on live Gmail, 2026-07-21. Replying inside a thread gives a
     * composer nested in a <table> layout with no dialog ancestor at all, and
     * Send first shares an ancestor thirteen levels up.
     *
     * The old anchor required `div[role="dialog"]` before it would look for
     * anything, so on a real inbox it returned null and the entire product
     * mounted nothing: no button, no mark, no error. The previous fixture
     * agreed with the selector because both were written from the same guess.
     */
    const thread = document.createElement('div')
    thread.setAttribute('role', 'main')
    thread.innerHTML = `
      <div class="qz aiL"><div class="et"><div class="ZyRVue"><div>
        <table class="cf An"><tbody><tr>
          <td class="Ap"><div class="Ar Au"><div class="aO7">
            <div class="Am aiL aO9 Al editable" contenteditable="true" role="textbox" aria-label="Message Body"></div>
          </div></div></td>
        </tr></tbody></table>
        <div><div role="button" aria-label="Send ‪(⌘Enter)‬" class="T-I J-J5-Ji aoO v7">Send</div></div>
      </div></div></div></div>`
    document.body.append(thread)

    const body = thread.querySelector<HTMLElement>('div[role="textbox"]')!
    const send = thread.querySelector<HTMLElement>('div[role="button"]')!
    const anchor = gmailAdapter.attachAnchor(body)

    expect(anchor).not.toBeNull()
    expect(anchor?.parentElement).toBe(send.parentElement)
    expect(thread.querySelector('div[role="dialog"]')).toBeNull()
  })

  it('still mounts something when it recognises nothing around the field', () => {
    // Never null. One missed selector must not remove the product from the page.
    const orphan = document.createElement('div')
    orphan.setAttribute('contenteditable', 'true')
    orphan.setAttribute('role', 'textbox')
    orphan.setAttribute('aria-label', 'Message Body')
    document.body.append(orphan)
    expect(gmailAdapter.attachAnchor(orphan)?.parentElement).toBe(document.body)
  })

  it('gives the panel its own block below the controls, not the button row', () => {
    const { body, dialog, send } = mountGmailCompose(document)
    const chipAnchor = gmailAdapter.attachAnchor(body)
    const panelAnchor = gmailAdapter.panelAnchor(body)

    expect(panelAnchor).not.toBeNull()
    // A panel in the flex row crowds Send and overflows sideways.
    expect(panelAnchor?.parentElement).toBe(dialog)
    expect(panelAnchor).not.toBe(chipAnchor)
    expect(chipAnchor?.parentElement).toBe(send.parentElement)
  })

  it('caps the panel height so the compose window cannot outgrow the screen', () => {
    // Measured on live Gmail: unconstrained, the dialog grew to 1053px and
    // pushed its own header off the top of the viewport.
    const { body } = mountGmailCompose(document)
    const anchor = gmailAdapter.panelAnchor(body)!
    // Assert a real resolved value. A CSS math function here reads back as an
    // empty string, which is how this shipped broken the first time.
    expect(anchor.style.maxHeight).toMatch(/^\d+px$/)
    expect(anchor.style.overflowY).toBe('auto')
  })

  it('returns no panel anchor outside a compose window', () => {
    const orphan = document.createElement('div')
    orphan.setAttribute('contenteditable', 'true')
    orphan.setAttribute('role', 'textbox')
    document.body.append(orphan)
    expect(gmailAdapter.panelAnchor(orphan)).toBeNull()
  })

  it('allows replacement in a contenteditable body', () => {
    const { body } = mountGmailCompose(document)
    expect(gmailAdapter.canReplace(body)).toBe(true)
  })

  it('does not double-mount a composer', () => {
    const { body } = mountGmailCompose(document)
    expect(isMounted(body)).toBe(false)
    markMounted(body)
    expect(isMounted(body)).toBe(true)
  })

  it('places the cursor at the end after replacement', () => {
    const { body } = mountGmailCompose(document)
    const addRange = vi.fn()
    vi.spyOn(window, 'getSelection').mockReturnValue({
      removeAllRanges: vi.fn(),
      addRange,
    } as unknown as Selection)

    gmailAdapter.setDraft(body, 'Replaced.')
    expect(addRange).toHaveBeenCalled()
  })
})
