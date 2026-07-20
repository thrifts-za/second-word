// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BADGE_SIZE, SecondWordBadge } from '../extension/src/badge'

let field: HTMLTextAreaElement
let measured = 0

/** jsdom lays nothing out, so every rect is zero unless we say otherwise. */
function place(element: HTMLElement, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () => {
    measured += 1
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
      ...rect,
    } as DOMRect
  }
}

beforeEach(() => {
  measured = 0
  document.body.replaceChildren()
  field = document.createElement('textarea')
  document.body.append(field)
  place(field, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })
  window.innerHeight = 800
  window.innerWidth = 1200
})

afterEach(() => {
  vi.useRealTimers()
})

function mount(): SecondWordBadge {
  return new SecondWordBadge({ field, label: '1', title: 'noticed something', onOpen: () => {} })
}

describe('badge: where it lives', () => {
  it('mounts outside the field it is watching', () => {
    // D28. Never inside the host's own text field.
    const badge = mount()
    expect(field.contains(badge.host)).toBe(false)
    expect(badge.host.isConnected).toBe(true)
    badge.destroy()
  })

  it('pins the styles a hostile page could otherwise undo', () => {
    // D33. A transform or filter on any ancestor silently breaks position:fixed,
    // and sites ship rules like :not(:defined){visibility:hidden}.
    const badge = mount()
    for (const property of ['position', 'transform', 'filter', 'visibility', 'z-index']) {
      expect(badge.host.style.getPropertyPriority(property)).toBe('important')
    }
    expect(badge.host.style.getPropertyValue('position')).toBe('fixed')
    expect(badge.host.style.getPropertyValue('transform')).toBe('none')
    badge.destroy()
  })

  it('keeps its own DOM in a shadow root', () => {
    const badge = mount()
    expect(badge.host.shadowRoot).not.toBeNull()
    badge.destroy()
  })
})

describe('badge: positioning', () => {
  it('sits at the bottom right of the field', () => {
    // D35, matching where people already expect to find it.
    const badge = mount()
    badge.reposition()
    expect(badge.element.style.left).toBe(`${500 - BADGE_SIZE}px`)
    expect(badge.element.style.top).toBe(`${300 - BADGE_SIZE}px`)
    badge.destroy()
  })

  it('clamps to the viewport when the field runs off the bottom', () => {
    place(field, { left: 100, top: 700, right: 500, bottom: 1400, width: 400, height: 700 })
    const badge = mount()
    badge.reposition()
    expect(badge.element.style.top).toBe(`${800 - BADGE_SIZE}px`)
    badge.destroy()
  })

  it('hides rather than positions when the field is scrolled out of view', () => {
    // D32. Cheapest possible outcome for an off-screen field.
    place(field, { left: 100, top: -400, right: 500, bottom: -300, width: 400, height: 100 })
    const badge = mount()
    badge.reposition()
    expect(badge.element.style.display).toBe('none')
    badge.destroy()
  })

  it('hides when the field has collapsed to nothing', () => {
    place(field, { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
    const badge = mount()
    badge.reposition()
    expect(badge.element.style.display).toBe('none')
    badge.destroy()
  })
})

describe('badge: cost', () => {
  it('collapses a burst of scroll events into one measurement', async () => {
    // D29. Scroll fires at frame rate. Measuring per event is the 90% CPU case.
    const badge = mount()
    measured = 0

    for (let i = 0; i < 20; i += 1) window.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

    expect(measured).toBeLessThanOrEqual(1)
    badge.destroy()
  })

  it('stops measuring once destroyed', async () => {
    const badge = mount()
    badge.destroy()
    measured = 0

    window.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

    expect(measured).toBe(0)
  })
})

describe('badge: lifecycle', () => {
  it('tears itself down when the field leaves the page', () => {
    // D34. Hosts remove composers constantly and fire no event when they do.
    vi.useFakeTimers()
    const badge = mount()
    field.remove()

    vi.advanceTimersByTime(1200)

    expect(badge.host.isConnected).toBe(false)
  })

  it('removes its host from the document on destroy', () => {
    const badge = mount()
    badge.destroy()
    expect(badge.host.isConnected).toBe(false)
  })
})

describe('badge: interaction', () => {
  it('opens on click', () => {
    let opened = 0
    const badge = new SecondWordBadge({
      field,
      label: '1',
      title: 'noticed',
      onOpen: () => {
        opened += 1
      },
    })
    badge.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(opened).toBe(1)
    badge.destroy()
  })

  it('does not steal focus from the draft', () => {
    // Clicking the badge must not pull the caret out of the message.
    const badge = mount()
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    badge.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    badge.destroy()
  })

  it('says why it appeared', () => {
    // D10. Something that arrives uninvited owes an answer.
    const badge = mount()
    expect(badge.element.title).toContain('noticed something')
    badge.destroy()
  })
})

describe('badge: staying out of the way', () => {
  it('clears the resize grip on a resizable textarea', () => {
    // Reported against Grammarly in 2018 and never fixed: a badge in the
    // bottom-right corner sits exactly on the drag handle and makes the box
    // impossible to resize. https://news.ycombinator.com/item?id=16316937
    const area = document.createElement('textarea')
    area.style.resize = 'both'
    document.body.append(area)
    place(area, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })

    const badge = new SecondWordBadge({ field: area, label: '"', title: 'x', onOpen: () => {} })
    badge.reposition()

    expect(parseFloat(badge.element.style.left)).toBeLessThan(500 - BADGE_SIZE)
    badge.destroy()
  })

  it('uses the corner when there is no grip to avoid', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.append(div)
    place(div, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })

    const badge = new SecondWordBadge({ field: div, label: '"', title: 'x', onOpen: () => {} })
    badge.reposition()

    expect(badge.element.style.left).toBe(`${500 - BADGE_SIZE}px`)
    badge.destroy()
  })
})

describe('badge: sharing the corner', () => {
  it('steps aside when Grammarly is already on this field', () => {
    // Grammarly stamps the field it has claimed. From the DOM dump in
    // https://news.ycombinator.com/item?id=16316937:
    //   <div contenteditable="true" data-gramm_id="..." data-gramm="true"
    //        data-gramm_editor="true">
    // Its own button then sits in the bottom-right corner, where ours wants
    // to be. Most people who want Second Word also run Grammarly.
    field.setAttribute('data-gramm_id', 'd1a428f0-40fd-1fca-a617-acf5aeeaa147')
    field.setAttribute('data-gramm', 'true')

    const badge = mount()
    badge.reposition()

    // Clear of the corner by more than the resize grip alone would need.
    expect(parseFloat(badge.element.style.left)).toBeLessThan(500 - BADGE_SIZE - 18)
    badge.destroy()
  })

  it('steps aside for another assistant mounted on the page', () => {
    const other = document.createElement('grammarly-extension')
    document.body.append(other)

    const badge = mount()
    badge.reposition()

    expect(parseFloat(badge.element.style.left)).toBeLessThan(500 - BADGE_SIZE - 18)
    badge.destroy()
  })

  it('takes the corner when it has it to itself', () => {
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.append(div)
    place(div, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })

    const badge = new SecondWordBadge({ field: div, label: '"', title: 'x', onOpen: () => {} })
    badge.reposition()

    expect(badge.element.style.left).toBe(`${500 - BADGE_SIZE}px`)
    badge.destroy()
  })
})
