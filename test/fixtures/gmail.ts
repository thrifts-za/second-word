/**
 * A stand-in for Gmail's compose window.
 *
 * Mirrors the structure the adapter depends on: a dialog wrapper, a
 * contenteditable body carrying Gmail's own markers, and a Send button the
 * chip is meant to sit beside.
 *
 * This is a fixture, not a guarantee. Gmail can change its DOM at any time,
 * and when it does these tests keep passing while the real thing breaks. The
 * fixture proves the adapter's logic is right; only a live check proves the
 * selectors are still right. Both are needed.
 *
 * Built with DOM calls rather than a markup string, matching the rule the
 * product follows everywhere: never construct DOM from text.
 */

function div(document: Document, attributes: Record<string, string>): HTMLElement {
  const node = document.createElement('div')
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value)
  return node
}

export interface ThreadMessage {
  body: string
  /** Quoted history Gmail folds into the message. Must not be read as the message. */
  quoted?: string
  signature?: string
}

export function mountGmailCompose(
  document: Document,
  options: { draft?: string; thread?: ThreadMessage[] } = {},
): { dialog: HTMLElement; body: HTMLElement; send: HTMLElement } {
  document.body.replaceChildren()

  const main = div(document, { class: 'nH', role: 'main' })

  // Gmail renders the thread above the reply box, oldest first.
  for (const message of options.thread ?? []) {
    const wrapper = div(document, { class: 'adn ads' })
    const messageBody = div(document, { class: 'a3s aiL' })
    messageBody.append(document.createTextNode(message.body))

    if (message.signature) {
      const signature = div(document, { class: 'gmail_signature' })
      signature.append(document.createTextNode(message.signature))
      messageBody.append(signature)
    }

    if (message.quoted) {
      const quote = div(document, { class: 'gmail_quote' })
      quote.append(document.createTextNode(message.quoted))
      messageBody.append(quote)
    }

    wrapper.append(messageBody)
    main.append(wrapper)
  }
  const dialog = div(document, { role: 'dialog', class: 'nH Hd', 'aria-label': 'New Message' })
  const bodyWrap = div(document, { class: 'aoP' })

  const body = div(document, {
    g_editable: 'true',
    role: 'textbox',
    contenteditable: 'true',
    'aria-label': 'Message Body',
    class: 'Am Al editable',
  })

  const controls = div(document, { class: 'btC' })
  const send = div(document, {
    role: 'button',
    'data-tooltip': 'Send ⁨(Ctrl-Enter)',
    'aria-label': 'Send',
  })
  send.textContent = 'Send'

  bodyWrap.append(body)
  controls.append(send)
  dialog.append(bodyWrap, controls)
  main.append(dialog)
  document.body.append(main)

  // jsdom does not implement innerText, and the adapter depends on it so that
  // Gmail's div-and-br line breaks survive. Back it with textContent.
  if (!('innerText' in body)) {
    Object.defineProperty(body, 'innerText', {
      get(this: HTMLElement) {
        return this.textContent ?? ''
      },
      configurable: true,
    })
  }

  if (options.draft) body.textContent = options.draft
  return { dialog, body, send }
}
