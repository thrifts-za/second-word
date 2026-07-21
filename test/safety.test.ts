import { describe, expect, it } from 'vitest'
import { detectExplicitSafety } from '../src/lib/safety'

describe('explicit safety backstop', () => {
  it('recognises unmistakable self-harm language', () => {
    expect(detectExplicitSafety('I am writing goodbye because I plan to hurt myself tonight.')).toEqual(['self_harm'])
  })

  it('recognises a direct abuse disclosure and explicit threat', () => {
    expect(detectExplicitSafety('My partner hits me.')).toEqual(['abuse_disclosure'])
    expect(detectExplicitSafety('He said he would kill me.')).toEqual(['threat'])
  })

  it('does not turn ordinary grief or disappointment into a crisis', () => {
    expect(detectExplicitSafety('I miss her every day and today the grief feels especially heavy.')).toEqual([])
    expect(detectExplicitSafety('I am devastated by the decision, but I want to respond with grace.')).toEqual([])
  })
})
