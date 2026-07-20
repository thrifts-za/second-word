// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { markMoments } from '../extension/src/moment-marker'

class FakeHighlight {
  constructor(readonly ranges: Range[]) {}
}

const registry = new Map<string, unknown>()

beforeEach(() => {
  document.head.replaceChildren()
  document.body.replaceChildren()
  registry.clear()
  Object.defineProperty(globalThis, 'CSS', { value: { highlights: registry }, configurable: true })
  Object.defineProperty(globalThis, 'Highlight', { value: FakeHighlight, configurable: true })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'CSS')
  Reflect.deleteProperty(globalThis, 'Highlight')
})

describe('Living Margin marker', () => {
  it('marks the detected words without changing a contenteditable draft', () => {
    const field = document.createElement('div')
    field.setAttribute('contenteditable', 'true')
    field.textContent = 'You always dismiss what I say.'
    document.body.append(field)

    const marker = markMoments(field, ['you always'])

    expect(marker).not.toBeNull()
    expect(field.textContent).toBe('You always dismiss what I say.')
    expect(field.querySelectorAll('span')).toHaveLength(0)
    expect(registry.size).toBe(1)

    marker?.destroy()
    expect(registry.size).toBe(0)
    expect(document.head.querySelectorAll('style')).toHaveLength(0)
  })

  it('fails quietly for textareas, where ranges cannot map safely to rendered text', () => {
    const field = document.createElement('textarea')
    field.value = 'You always dismiss what I say.'
    document.body.append(field)

    expect(markMoments(field, ['you always'])).toBeNull()
    expect(field.value).toBe('You always dismiss what I say.')
  })
})
