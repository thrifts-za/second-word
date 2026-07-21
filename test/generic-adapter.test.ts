// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findEditable, genericAdapter, isEligibleField } from '../extension/src/adapters/generic'

beforeEach(() => {
  document.body.replaceChildren()
})

describe('generic anchor: one per field, and only while the field lives', () => {
  it('anchors the invitation to its field and removes it when the field goes', () => {
    /*
     * Seen on ChatGPT: five stacked invitations in the corner of the page.
     * The host was appended to the body with no position and no lifecycle, so
     * every composer the site rebuilt left another one behind, and none of
     * them were anywhere near the box being typed in.
     */
    vi.useFakeTimers()
    const field = document.createElement('textarea')
    field.getBoundingClientRect = () =>
      ({ left: 120, top: 400, right: 620, bottom: 460, width: 500, height: 60 }) as DOMRect
    document.body.append(field)

    const host = genericAdapter.attachAnchor(field)!
    expect(host.style.position).toBe('fixed')
    expect(host.style.left).toBe('120px')
    expect(host.isConnected).toBe(true)

    field.remove()
    vi.advanceTimersByTime(1200)
    expect(host.isConnected).toBe(false)
    vi.useRealTimers()
  })
})

function mount(html: () => HTMLElement): HTMLElement {
  const node = html()
  document.body.append(node)
  return node
}

describe('findEditable', () => {
  it('finds a plain textarea', () => {
    const area = mount(() => document.createElement('textarea'))
    expect(findEditable(area)).toBe(area)
  })

  it('climbs from a nested node to the topmost contenteditable', () => {
    // Gmail's compose body is a contenteditable tree, and focus lands deep in it.
    const outer = document.createElement('div')
    outer.setAttribute('contenteditable', 'true')
    const inner = document.createElement('div')
    inner.setAttribute('contenteditable', 'true')
    const leaf = document.createElement('span')
    inner.append(leaf)
    outer.append(inner)
    document.body.append(outer)

    expect(findEditable(leaf)).toBe(outer)
  })

  it('ignores a node that is not editable at all', () => {
    const div = mount(() => document.createElement('div'))
    expect(findEditable(div)).toBeNull()
  })
})

describe('isEligibleField', () => {
  it('accepts an ordinary textarea', () => {
    expect(isEligibleField(mount(() => document.createElement('textarea')))).toBe(true)
  })

  it('refuses a password field', () => {
    const input = document.createElement('input')
    input.type = 'password'
    document.body.append(input)
    expect(isEligibleField(input)).toBe(false)
  })

  it('refuses one-time codes and card numbers', () => {
    for (const value of ['one-time-code', 'cc-number', 'cc-csc']) {
      const input = document.createElement('input')
      input.setAttribute('autocomplete', value)
      document.body.append(input)
      expect(isEligibleField(input)).toBe(false)
    }
  })

  it('honours an opt-out on the field', () => {
    const area = document.createElement('textarea')
    area.setAttribute('data-second-word', 'off')
    document.body.append(area)
    expect(isEligibleField(area)).toBe(false)
  })

  it('honours an opt-out on an ancestor', () => {
    // A whole page or a single form can switch it off.
    const region = document.createElement('div')
    region.setAttribute('data-second-word', 'off')
    const area = document.createElement('textarea')
    region.append(area)
    document.body.append(region)
    expect(isEligibleField(area)).toBe(false)
  })
})

describe('genericAdapter', () => {
  it('reads a textarea by value, not textContent', () => {
    const area = mount(() => document.createElement('textarea')) as HTMLTextAreaElement
    area.value = 'I am so sorry for your loss.'
    expect(genericAdapter.getDraft(area)).toBe('I am so sorry for your loss.')
  })

  it('reads a contenteditable by its rendered text', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    div.textContent = 'Thank you for the update.'
    document.body.append(div)
    expect(genericAdapter.getDraft(div)).toBe('Thank you for the update.')
  })

  it('has no thread to read', () => {
    // Only a site-specific adapter can know what a conversation looks like.
    const area = mount(() => document.createElement('textarea'))
    expect(genericAdapter.getReceivedMessage(area)).toBeNull()
  })

  it('never mounts anything inside the field it is watching', () => {
    // D28. Grammarly's original in-field injection corrupted user text and got
    // them blocked by ProseMirror, Quill and Draft.js.
    const area = mount(() => document.createElement('textarea'))
    const anchor = genericAdapter.attachAnchor(area)
    expect(anchor).not.toBeNull()
    expect(area.contains(anchor!)).toBe(false)
  })
})

/**
 * Dimensions, from Grammarly's own published check:
 *   $0.clientWidth > 301 && $0.clientHeight > 38
 * https://support.grammarly.com/hc/en-us/articles/115000090392
 *
 * The reason underneath the numbers is intent. A box too small to hold a
 * message is a search field, a filter, a username. Nobody writes to a person
 * in one, so nothing there is ever a moment.
 */
function sized(element: HTMLElement, width: number, height: number): HTMLElement {
  element.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) }) as DOMRect
  document.body.append(element)
  return element
}

describe('isEligibleField: dimensions', () => {
  it('accepts a box big enough to hold a message', () => {
    expect(isEligibleField(sized(document.createElement('textarea'), 600, 120))).toBe(true)
  })

  it('refuses a search box', () => {
    // Wide enough, far too short.
    expect(isEligibleField(sized(document.createElement('input'), 600, 28))).toBe(false)
  })

  it('refuses a narrow field', () => {
    expect(isEligibleField(sized(document.createElement('textarea'), 240, 120))).toBe(false)
  })

  it('does not judge a field that has never been laid out', () => {
    // Zero by zero means "not measured yet", not "too small". Rejecting here
    // would skip every composer that mounts hidden and is revealed on click.
    expect(isEligibleField(sized(document.createElement('textarea'), 0, 0))).toBe(true)
  })
})

describe('isEligibleField: the site said no', () => {
  it('honours data-gramm="false" on the field', () => {
    // Not our attribute, but it is the one site owners already use to mean
    // "no writing assistant here". Ignoring it because it carries a
    // competitor's name would be reading the letter over the intent.
    const area = sized(document.createElement('textarea'), 600, 120)
    area.setAttribute('data-gramm', 'false')
    expect(isEligibleField(area)).toBe(false)
  })

  it('honours data-gramm="false" on a container', () => {
    const region = document.createElement('div')
    region.setAttribute('data-gramm', 'false')
    const area = document.createElement('textarea')
    sized(area, 600, 120)
    region.append(area)
    document.body.append(region)
    expect(isEligibleField(area)).toBe(false)
  })
})
