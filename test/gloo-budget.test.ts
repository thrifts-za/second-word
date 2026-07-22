import { describe, expect, it } from 'vitest'
import {
  budgetConfig,
  consumeGlooBudget,
  type GlooBudgetConfig,
  type GlooBudgetState,
} from '../src/security/gloo-budget'

const config: GlooBudgetConfig = {
  endAt: Date.parse('2026-07-31T22:00:00Z'),
  analyzeDailyLimit: 2,
  rewriteDailyLimit: 1,
  analyzeTotalLimit: 3,
  rewriteTotalLimit: 2,
  analyzeBurstLimit: 2,
  rewriteBurstLimit: 1,
}

describe('Gloo budget', () => {
  it('allows only the configured daily amount', () => {
    const now = Date.parse('2026-07-22T12:00:00Z')
    const first = consumeGlooBudget(undefined, 'analyze', now, config)
    const second = consumeGlooBudget(first.state, 'analyze', now, config)
    const third = consumeGlooBudget(second.state, 'analyze', now, config)

    expect(first.decision.allowed).toBe(true)
    expect(second.decision.allowed).toBe(true)
    expect(third.decision).toMatchObject({ allowed: false, reason: 'daily_limit' })
  })

  it('resets the daily count without resetting the competition total', () => {
    const dayOne = Date.parse('2026-07-22T12:00:00Z')
    const dayTwo = Date.parse('2026-07-23T12:00:00Z')
    let state: GlooBudgetState | undefined
    state = consumeGlooBudget(state, 'analyze', dayOne, config).state
    state = consumeGlooBudget(state, 'analyze', dayOne, config).state
    const third = consumeGlooBudget(state, 'analyze', dayTwo, config)
    const exhausted = consumeGlooBudget(third.state, 'analyze', dayTwo + 61_000, config)

    expect(third.decision.allowed).toBe(true)
    expect(exhausted.decision).toMatchObject({ allowed: false, reason: 'total_limit' })
  })

  it('separates analysis and rewrite allowances', () => {
    const now = Date.parse('2026-07-22T12:00:00Z')
    const analysis = consumeGlooBudget(undefined, 'analyze', now, config)
    const rewrite = consumeGlooBudget(analysis.state, 'rewrite', now, config)
    const secondRewrite = consumeGlooBudget(rewrite.state, 'rewrite', now, config)

    expect(analysis.decision.allowed).toBe(true)
    expect(rewrite.decision.allowed).toBe(true)
    expect(secondRewrite.decision).toMatchObject({ allowed: false, reason: 'daily_limit' })
  })

  it('blocks bursts before they can consume the daily allowance', () => {
    const now = Date.parse('2026-07-22T12:00:00Z')
    const first = consumeGlooBudget(undefined, 'rewrite', now, { ...config, rewriteDailyLimit: 5 })
    const second = consumeGlooBudget(first.state, 'rewrite', now, { ...config, rewriteDailyLimit: 5 })

    expect(second.decision).toMatchObject({ allowed: false, reason: 'burst_limit' })
  })

  it('stops Gloo at the end of 31 July in Johannesburg', () => {
    const before = consumeGlooBudget(undefined, 'analyze', config.endAt - 1, config)
    const atDeadline = consumeGlooBudget(undefined, 'analyze', config.endAt, config)

    expect(before.decision.allowed).toBe(true)
    expect(atDeadline.decision).toMatchObject({ allowed: false, reason: 'deadline' })
  })

  it('falls back to conservative defaults for invalid configuration', () => {
    expect(budgetConfig({
      GLOO_ANALYSIS_DAILY_LIMIT: '-1',
      GLOO_REWRITE_DAILY_LIMIT: 'not-a-number',
      GLOO_BUDGET_END: 'invalid',
    })).toMatchObject({
      analyzeDailyLimit: 300,
      rewriteDailyLimit: 75,
      endAt: Date.parse('2026-07-31T22:00:00Z'),
    })
  })
})
