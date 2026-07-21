// @vitest-environment jsdom

/**
 * Integration test for the ambient path, end to end inside the content script.
 *
 * This is the file that had no tests at all, and it is where the interesting
 * decisions live: whether anything is sent, whether anything is shown, and
 * whether the two gates actually both have to agree. Everything below drives
 * the real `content.ts`, not a reimplementation of it.
 *
 * Nothing here needs credentials, a network, or a browser profile.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PASSAGE = {
  request_id: 'req_test',
  goal: 'answer without returning the blow',
  principle: 'bear_false_accusation',
  verified_reference_id: 'PSA.37.6',
  display_reference: 'Psalm 37:6',
  verse_text: 'He will make your righteous reward shine like the dawn.',
  bible_id: '111',
  translation: 'NIV',
  attribution: 'The Holy Bible, New International Version',
  attribution_url: null,
  why: 'You are answering a claim about you that is not true.',
  question: 'What do you want to be true after you send this?',
  analysis_token: 'test.token',
  safety_flags: [],
  source: 'model_ranked_reviewed_library',
  experience: 'guard',
  provider: 'fake',
  latency_ms: 5,
}

const GUIDE_PASSAGE = {
  ...PASSAGE,
  principle: 'offer_support',
  verified_reference_id: 'GAL.5.13',
  display_reference: 'Galatians 5:13',
  verse_text: 'Serve one another humbly in love.',
  why: 'You are freely choosing to carry something for someone.',
  question: 'What makes this help an act of love rather than obligation?',
  experience: 'guide',
}

/** Guard with no credential: the moment is real, the draft is not the problem. */
const UNEARNED_PASSAGE = (() => {
  const { analysis_token: _token, ...rest } = PASSAGE
  return { ...rest, principle: 'meet_disappointment', why: 'The plan was yours. The decision was not.' }
})()

const SILENCE = {
  request_id: 'req_test',
  needs_reflection: false,
  message: 'Nothing here needs a second thought.',
  provider: 'fake',
  latency_ms: 4,
}

interface Harness {
  body: HTMLElement
  requests: Array<Record<string, unknown>>
}

class FakeHighlight {
  constructor(readonly ranges: Range[]) {}
}

const highlights = new Map<string, unknown>()

function stubCssHighlights(): void {
  highlights.clear()
  Object.defineProperty(globalThis, 'CSS', { value: { highlights }, configurable: true })
  Object.defineProperty(globalThis, 'Highlight', { value: FakeHighlight, configurable: true })
}

/** Gmail's compose DOM, plus the message being replied to. */
function mountHarness(options: { thread?: string; quoted?: string } = {}): Harness {
  document.body.replaceChildren()

  const main = document.createElement('div')
  main.setAttribute('role', 'main')

  if (options.thread) {
    const wrapper = document.createElement('div')
    wrapper.className = 'adn ads'
    const message = document.createElement('div')
    message.className = 'a3s aiL'
    message.append(document.createTextNode(options.thread))
    if (options.quoted) {
      const quote = document.createElement('div')
      quote.className = 'gmail_quote'
      quote.textContent = options.quoted
      message.append(quote)
    }
    wrapper.append(message)
    main.append(wrapper)
  }

  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  dialog.className = 'nH Hd'

  const body = document.createElement('div')
  body.setAttribute('g_editable', 'true')
  body.setAttribute('role', 'textbox')
  body.setAttribute('contenteditable', 'true')
  body.className = 'Am Al editable'

  const controls = document.createElement('div')
  controls.className = 'btC'
  const send = document.createElement('div')
  send.setAttribute('role', 'button')
  send.setAttribute('aria-label', 'Send')
  controls.append(send)

  dialog.append(body, controls)
  main.append(dialog)
  document.body.append(main)

  return { body, requests: [] }
}

function stubChrome(ambient: boolean, initial: Record<string, unknown> = {}): Record<string, unknown> {
  const stored: Record<string, unknown> = { ambient, apiBase: 'https://stub.invalid', ...initial }
  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async () => stored,
        set: async (values: Record<string, unknown>) => Object.assign(stored, values),
      },
    },
  }
  return stored
}

function stubFetch(harness: Harness, response: unknown): void {
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    harness.requests.push(JSON.parse(String(init.body)))
    return new Response(JSON.stringify(response), {
      headers: { 'content-type': 'application/json' },
    })
  })
}

/**
 * Focus, type, then let the debounce and the request settle.
 *
 * The focus matters: the content script attaches on `focusin` rather than by
 * observing the DOM (D13), so a field nobody has clicked into is a field
 * Second Word has never looked at. That is deliberate, and it is why this
 * helper focuses first.
 */
async function type(harness: Harness, text: string): Promise<void> {
  harness.body.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  harness.body.textContent = text
  harness.body.dispatchEvent(new InputEvent('input', { bubbles: true }))
  await vi.advanceTimersByTimeAsync(1000)
  await vi.advanceTimersByTimeAsync(0)
}

async function load(): Promise<void> {
  vi.resetModules()
  await import('../extension/src/content')
  // boot() is async: let isEnabledFor and isAmbient resolve before typing.
  await vi.advanceTimersByTimeAsync(0)
}

function badges(): number {
  return document.querySelectorAll('second-word-badge').length
}

/**
 * The content script registers a `focusin` listener on `document` and never
 * removes it, which is correct in a page but means every `resetModules` here
 * would leave a previous copy of the script still listening on the same jsdom
 * document. Two tests were being answered by an earlier test's module. Track
 * what gets added and take it away again.
 */
const documentListeners: Array<[string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]> = []
const realAddEventListener = document.addEventListener.bind(document)

beforeEach(() => {
  vi.useFakeTimers()

  documentListeners.length = 0
  document.addEventListener = (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    documentListeners.push([type, listener, options])
    realAddEventListener(type, listener, options)
  }
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
  Object.defineProperty(HTMLElement.prototype, 'innerText', {
    get(this: HTMLElement) {
      return this.textContent ?? ''
    },
    configurable: true,
  })
  // jsdom lays nothing out, so the badge would judge itself invisible.
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100, x: 100, y: 200, toJSON: () => ({}) }) as DOMRect
})

afterEach(() => {
  for (const [type, listener, options] of documentListeners) {
    document.removeEventListener(type, listener, options)
  }
  documentListeners.length = 0
  document.addEventListener = realAddEventListener
  vi.unstubAllGlobals()
  Reflect.deleteProperty(globalThis, 'CSS')
  Reflect.deleteProperty(globalThis, 'Highlight')
  highlights.clear()
  vi.useRealTimers()
})

describe('ambient path', () => {
  it('keeps a quiet Presence mark in the composer and reveals the verified daily verse on click', async () => {
    const harness = mountHarness()
    stubChrome(false, { presence: true })
    vi.stubGlobal('fetch', async (input: string) => {
      expect(String(input)).toContain('/v1/verse-of-the-day?')
      return Response.json({
        day: 203,
        verified_reference_id: 'PSA.23.4',
        display_reference: 'Psalm 23:4',
        verse_text: 'Even though I walk through the darkest valley, I will fear no evil.',
        bible_id: '111',
        translation: 'NIV',
        attribution: 'The Holy Bible, New International Version. Copyright Biblica.',
        attribution_url: 'https://www.bible.com/versions/111',
        source: 'youversion_verse_of_the_day',
      })
    })
    await load()

    harness.body.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(0)
    expect(badges()).toBe(1)
    const badge = document.querySelector('second-word-badge')
    expect(badge?.shadowRoot?.querySelector('.presence')).not.toBeNull()
    badge?.shadowRoot?.querySelector<HTMLElement>('.presence')?.click()

    const overlay = document.querySelector('second-word-overlay')
    const panel = overlay?.querySelector<HTMLElement>('[data-second-word]')
    expect(panel?.shadowRoot?.textContent).toContain('Verse of the Day')
    expect(panel?.shadowRoot?.textContent).toContain('Psalm 23:4')
    expect(panel?.shadowRoot?.textContent).toContain('References')
    expect(panel?.shadowRoot?.querySelector('details')?.open).toBe(false)

    panel?.shadowRoot?.querySelector<HTMLButtonElement>('.action')?.click()

    harness.body.textContent = 'I have started writing.'
    harness.body.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(badges()).toBe(1)
    expect(document.querySelector('second-word-badge')?.shadowRoot?.querySelector('.presence')).not.toBeNull()
  })

  it('sends nothing and shows nothing for logistics', async () => {
    // The local gate stops this before the network is ever touched.
    const harness = mountHarness()
    stubChrome(true)
    stubFetch(harness, PASSAGE)
    await load()

    await type(harness, 'Sounds good, I will pick this up in the morning and send the draft across before lunch.')

    expect(harness.requests).toHaveLength(0)
    expect(badges()).toBe(0)
  })

  it('stays silent when the model says there is nothing at stake', async () => {
    // The second gate. The request happens, and still nothing is shown:
    // no badge, no placeholder, no trace. D6.
    const harness = mountHarness()
    stubChrome(true)
    stubFetch(harness, SILENCE)
    await load()

    await type(harness, 'I disagree with the approach but I can see the reasoning here, happy to go with it.')

    expect(harness.requests.length).toBeGreaterThan(0)
    expect(badges()).toBe(0)
  })

  it('shows a badge, and only a badge, when something is at stake', async () => {
    // D2. Automatic detection is not automatic interruption: nothing opens.
    const harness = mountHarness()
    stubChrome(true)
    stubFetch(harness, PASSAGE)
    await load()

    await type(harness, 'Dave, I sent the handover pack on the 14th and you were on the email. Please check before copying in the team.')

    expect(badges()).toBe(1)
    expect(document.querySelector('[data-second-word-panel]')).toBeNull()
  })

  it('offers no rewrite for a guard passage the server did not license', async () => {
    // The gracious reply under a decline letter. A passage, and no suggestion
    // that the words in the box are the thing that needs fixing.
    const harness = mountHarness({ thread: 'We have decided to move forward with another candidate.' })
    stubChrome(true)
    stubFetch(harness, UNEARNED_PASSAGE)
    await load()

    await type(harness, 'Thank you for the time your team gave me. I wish you everything of the best.')

    const badge = document.querySelector<HTMLElement>('second-word-badge')!
    badge.shadowRoot!.querySelector<HTMLElement>('.badge')!.click()

    const cardText = document.querySelector<HTMLElement>('second-word-overlay')!
      .querySelector<HTMLElement>('[data-second-word]')!
      .shadowRoot!.textContent
    expect(cardText).toContain('Psalm 37:6')
    expect(cardText).not.toContain('Show alternatives')
    expect(cardText).toContain('Return to my message')
  })

  it('renders a positive moment as gold Guide with no rewrite action', async () => {
    const harness = mountHarness({ thread: 'My son is unwell. Could anyone carry Thursday for me?' })
    stubChrome(true)
    stubFetch(harness, GUIDE_PASSAGE)
    await load()

    await type(harness, 'Be with your family, Priya. I can carry Thursday for you.')

    const badge = document.querySelector<HTMLElement>('second-word-badge')!
    expect(badge.shadowRoot!.querySelector('.badge')?.classList.contains('guide')).toBe(true)
    expect(badge.shadowRoot!.textContent).toContain('A word for this good moment')
    badge.shadowRoot!.querySelector<HTMLElement>('.badge')!.click()

    const panelText = document.querySelector<HTMLElement>('second-word-overlay')!
      .querySelector<HTMLElement>('[data-second-word]')!
      .shadowRoot!.textContent
    expect(panelText).toContain('A word for this good moment')
    expect(panelText).not.toContain('Show alternatives')
    expect(panelText).not.toContain('What makes this help an act of love rather than obligation?')
  })

  it('marks an exact local phrase without changing the draft, then clears it on the next edit', async () => {
    const harness = mountHarness()
    stubChrome(true)
    stubCssHighlights()
    stubFetch(harness, PASSAGE)
    await load()

    const draft = 'You always dismiss what I say, and it is honestly embarrassing.'
    await type(harness, draft)

    expect(highlights.size).toBe(1)
    expect(harness.body.textContent).toBe(draft)
    expect(harness.body.querySelectorAll('span')).toHaveLength(0)

    // Clearing happens synchronously on input, before the next debounce or
    // request. No stale marker is allowed to describe words that are gone.
    harness.body.textContent = 'I need some time before I respond.'
    harness.body.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(highlights.size).toBe(0)
    expect(harness.body.textContent).toBe('I need some time before I respond.')
  })

  it('restores the resolved invitation after the card is dismissed', async () => {
    const harness = mountHarness()
    stubChrome(true)
    stubFetch(harness, PASSAGE)
    await load()

    await type(harness, 'Dave, I sent the handover pack on the 14th and you were on the email. Please check before copying in the team.')

    const badge = document.querySelector<HTMLElement>('second-word-badge')!
    badge.shadowRoot!.querySelector<HTMLElement>('.badge')!.click()
    const dismiss = document.querySelector<HTMLElement>('second-word-overlay')!
      .querySelector<HTMLElement>('[data-second-word]')!
      .shadowRoot!
      .querySelector<HTMLButtonElement>('.panel__dismiss')!
    dismiss.click()

    expect(badges()).toBe(1)
    expect(document.querySelector('second-word-overlay')).toBeNull()
    expect(harness.requests).toHaveLength(1)
  })

  it('sends the message being replied to, without its quoted history', async () => {
    const harness = mountHarness({
      thread: 'You missed the handover deadline again and the client noticed.',
      quoted: 'On Monday you wrote: the pack is ready whenever you are.',
    })
    stubChrome(true)
    stubFetch(harness, PASSAGE)
    await load()

    await type(harness, 'Dave, I sent the handover pack on the 14th and you were on the email. Please check first.')

    const sent = harness.requests[0] as { received_message?: string; surface?: string }
    expect(sent.surface).toBe('gmail')
    expect(sent.received_message).toContain('missed the handover deadline')
    expect(sent.received_message).not.toContain('On Monday')
  })

  it('does nothing at all until ambient is switched on', async () => {
    // Off by default. Until someone chooses it, the draft never leaves.
    const harness = mountHarness()
    stubChrome(false)
    stubFetch(harness, PASSAGE)
    await load()

    await type(harness, 'Dave, I sent the handover pack on the 14th and you were on the email. Please check first.')

    expect(harness.requests).toHaveLength(0)
    expect(badges()).toBe(0)
  })

  it('never sends the same settled draft twice', async () => {
    // D12. Retyping into the same message must not cost a second request.
    const harness = mountHarness()
    stubChrome(true)
    stubFetch(harness, PASSAGE)
    await load()

    const draft = 'Dave, I sent the handover pack on the 14th and you were on the email. Please check first.'
    await type(harness, draft)
    await type(harness, draft)

    expect(harness.requests).toHaveLength(1)
  })

  it('sends only recent reference IDs for rotation and remembers the verified result locally', async () => {
    const harness = mountHarness()
    const stored = stubChrome(true, { recentReferenceIds: ['PSA.34.18'] })
    stubFetch(harness, PASSAGE)
    await load()

    await type(harness, 'Dave, I sent the handover pack on the 14th and you were on the email. Please check first.')

    expect(harness.requests[0]?.recent_reference_ids).toEqual(['PSA.34.18'])
    expect(stored.recentReferenceIds).toEqual(['PSA.37.6', 'PSA.34.18'])
    expect(stored).not.toHaveProperty('draft')
    expect(stored).not.toHaveProperty('safety_flags')
  })
})
