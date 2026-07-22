import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../sandbox/scenarios'

describe('competition sandbox story', () => {
  it('shows distinct human moments across six recognisable writing surfaces', () => {
    expect(SCENARIOS).toHaveLength(8)
    expect(new Set(SCENARIOS.map((scenario) => scenario.id)).size).toBe(8)
    expect(new Set(SCENARIOS.map((scenario) => scenario.app))).toEqual(
      new Set(['gmail', 'slack', 'teams', 'whatsapp', 'x', 'linkedin']),
    )
  })

  it('makes a freely offered act of care a first-class demo moment', () => {
    const support = SCENARIOS.find((scenario) => scenario.id === 'support')
    expect(support?.tab).toBe('A willing yes')
    expect(support?.suggestedDraft).toContain('I can carry Thursday for you')
  })

  it('makes deliberate silence visible with genuinely neutral logistics', () => {
    const ordinary = SCENARIOS.find((scenario) => scenario.id === 'ordinary')
    expect(ordinary?.tab).toBe('Knows when to stay quiet')
    expect(ordinary?.suggestedDraft).toBe(
      'Received. Thursday at 10 works. I will join from the usual link.',
    )
  })

  it('opens on financial pressure with provision available to the model', () => {
    const provision = SCENARIOS[0]
    expect(provision?.id).toBe('provision')
    expect(provision?.received.body).toContain('arrears')
    expect(provision?.suggestedDraft).toContain('things are hard right now')
  })
})
