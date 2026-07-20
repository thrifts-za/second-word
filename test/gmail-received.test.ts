// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { gmailAdapter } from '../extension/src/adapters/gmail'
import { MAX_RECEIVED_LENGTH } from '../src/lib/contracts'
import { mountGmailCompose } from './fixtures/gmail'

beforeEach(() => {
  document.body.replaceChildren()
})

describe('gmail adapter: the message being replied to', () => {
  it('returns the most recent message, not the first', () => {
    const { body } = mountGmailCompose(document, {
      thread: [
        { body: 'Thanks for applying. We will be in touch.' },
        { body: 'We have decided to move forward with another candidate.' },
      ],
    })
    expect(gmailAdapter.getReceivedMessage(body)).toBe(
      'We have decided to move forward with another candidate.',
    )
  })

  it('leaves out quoted history', () => {
    // Otherwise the whole thread arrives disguised as one message.
    const { body } = mountGmailCompose(document, {
      thread: [{ body: 'We are going with someone else.', quoted: 'On Monday you wrote: I am very keen' }],
    })
    const received = gmailAdapter.getReceivedMessage(body)
    expect(received).toBe('We are going with someone else.')
    expect(received).not.toContain('very keen')
  })

  it('leaves out the signature', () => {
    const { body } = mountGmailCompose(document, {
      thread: [{ body: 'We are going with someone else.', signature: 'Sent from my iPhone' }],
    })
    expect(gmailAdapter.getReceivedMessage(body)).not.toContain('iPhone')
  })

  it('returns null on a new message with no thread', () => {
    const { body } = mountGmailCompose(document, { draft: 'Hello' })
    expect(gmailAdapter.getReceivedMessage(body)).toBeNull()
  })

  it('returns null rather than an empty string when the message is blank', () => {
    const { body } = mountGmailCompose(document, { thread: [{ body: '   ' }] })
    expect(gmailAdapter.getReceivedMessage(body)).toBeNull()
  })

  it('caps a long message at the contract limit', () => {
    const { body } = mountGmailCompose(document, { thread: [{ body: 'x'.repeat(MAX_RECEIVED_LENGTH * 2) }] })
    const received = gmailAdapter.getReceivedMessage(body)
    expect(received).not.toBeNull()
    expect(received!.length).toBeLessThanOrEqual(MAX_RECEIVED_LENGTH)
  })
})
