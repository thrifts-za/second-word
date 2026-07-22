// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { SecondWordOverlay } from '../extension/src/overlay'

let field: HTMLElement
let content: HTMLElement

function place(element: HTMLElement, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}), ...rect }) as DOMRect
}

beforeEach(() => {
  document.body.replaceChildren()
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })

  field = document.createElement('div')
  document.body.append(field)
  content = document.createElement('div')
  place(content, { width: 380, height: 300 })
})

describe('overlay', () => {
  it('never grows the host page', () => {
    // The whole point. Appending the passage inside Gmail's compose window
    // made it 1053px tall and pushed its own header off screen.
    place(field, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })
    const overlay = new SecondWordOverlay({ field, content })

    expect(field.contains(overlay.host)).toBe(false)
    expect(overlay.host.style.getPropertyValue('position')).toBe('fixed')
    expect(overlay.host.style.getPropertyPriority('position')).toBe('important')
    overlay.destroy()
  })

  it('sits below the field when there is room', () => {
    place(field, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })
    const overlay = new SecondWordOverlay({ field, content })
    overlay.reposition()

    expect(parseFloat(overlay.frame.style.top)).toBeGreaterThanOrEqual(300)
    overlay.destroy()
  })

  it('flips above the field when there is not room below', () => {
    // A composer near the bottom of the window, which is where Gmail puts it.
    place(field, { left: 100, top: 600, right: 500, bottom: 700, width: 400, height: 100 })
    const overlay = new SecondWordOverlay({ field, content })
    overlay.reposition()

    expect(parseFloat(overlay.frame.style.top)).toBeLessThan(600)
    overlay.destroy()
  })

  it('stays inside the viewport even when nothing fits', () => {
    place(field, { left: 100, top: 10, right: 500, bottom: 780, width: 400, height: 770 })
    const overlay = new SecondWordOverlay({ field, content })
    overlay.reposition()

    const top = parseFloat(overlay.frame.style.top)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top).toBeLessThanOrEqual(800)
    overlay.destroy()
  })

  it('aligns to the left edge of the field', () => {
    place(field, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })
    const overlay = new SecondWordOverlay({ field, content })
    overlay.reposition()

    expect(overlay.frame.style.left).toBe('100px')
    overlay.destroy()
  })

  it('caps its own height rather than running off the screen', () => {
    place(field, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })
    const overlay = new SecondWordOverlay({ field, content })
    overlay.reposition()

    expect(overlay.frame.style.maxHeight).toMatch(/^\d+(\.\d+)?px$/)
    expect(overlay.frame.style.overflowY).toBe('auto')
    overlay.destroy()
  })

  it('keeps a necessary scrollbar inside the dark card instead of a pale gutter', () => {
    place(field, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })
    const overlay = new SecondWordOverlay({ field, content })

    expect(overlay.frame.style.background).toBe('rgb(22, 24, 29)')
    expect(overlay.frame.style.scrollbarColor).toContain('#16181d')
    overlay.destroy()
  })

  it('removes itself from the document on destroy', () => {
    place(field, { left: 100, top: 200, right: 500, bottom: 300, width: 400, height: 100 })
    const overlay = new SecondWordOverlay({ field, content })
    overlay.destroy()
    expect(overlay.host.isConnected).toBe(false)
  })
})

describe('overlay: not in the way', () => {
  it('does not cover the host controls under the composer', () => {
    // Gmail's Send button lives directly beneath the field. A product that
    // promises never to block Send must not cover it with Scripture.
    place(field, { left: 100, top: 344, right: 984, bottom: 444, width: 884, height: 100 })
    const overlay = new SecondWordOverlay({ field, content })
    overlay.reposition()

    expect(parseFloat(overlay.frame.style.top)).toBeLessThan(344)
    overlay.destroy()
  })
})
