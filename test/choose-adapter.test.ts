// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { chooseAdapter } from '../extension/src/adapters/choose'

beforeEach(() => {
  document.body.replaceChildren()
})

describe('chooseAdapter', () => {
  it('uses the Gmail adapter on Gmail', () => {
    expect(chooseAdapter('mail.google.com', document).id).toBe('gmail')
  })

  it('uses the generic adapter everywhere else', () => {
    for (const host of [
      'app.slack.com',
      'teams.microsoft.com',
      'web.whatsapp.com',
      'x.com',
      'www.linkedin.com',
      'www.reddit.com',
      'chatgpt.com',
      'claude.ai',
    ]) {
      expect(chooseAdapter(host, document).id, host).toBe('generic')
    }
  })

  it('recognises Gmail by its own markup, not only by hostname', () => {
    // Gmail's compose body carries g_editable, an attribute nothing else uses.
    // Without this the dev harness silently exercises the generic path and the
    // thread-reading code never runs, which is exactly what happened.
    const body = document.createElement('div')
    body.setAttribute('g_editable', 'true')
    body.setAttribute('role', 'textbox')
    document.body.append(body)

    expect(chooseAdapter('localhost', document).id).toBe('gmail')
  })

  it('is not fooled by an unrelated contenteditable', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.append(div)
    expect(chooseAdapter('example.com', document).id).toBe('generic')
  })
})
