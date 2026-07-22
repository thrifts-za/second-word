/**
 * A single, atomic allowance for the public Gloo demo.
 *
 * The Durable Object stores counts only. It never receives or stores a draft,
 * IP address, account identifier, or model response.
 */

export type GlooOperation = 'analyze' | 'rewrite'

export interface GlooBudgetConfig {
  endAt: number
  analyzeDailyLimit: number
  rewriteDailyLimit: number
  analyzeTotalLimit: number
  rewriteTotalLimit: number
  analyzeBurstLimit: number
  rewriteBurstLimit: number
}

export interface GlooBudgetState {
  day: string
  minute: string
  dailyAnalyze: number
  dailyRewrite: number
  burstAnalyze: number
  burstRewrite: number
  totalAnalyze: number
  totalRewrite: number
}

export interface GlooBudgetDecision {
  allowed: boolean
  reason?: 'deadline' | 'daily_limit' | 'total_limit' | 'burst_limit'
  remainingDaily: number
  remainingTotal: number
}

const EMPTY_STATE: GlooBudgetState = {
  day: '',
  minute: '',
  dailyAnalyze: 0,
  dailyRewrite: 0,
  burstAnalyze: 0,
  burstRewrite: 0,
  totalAnalyze: 0,
  totalRewrite: 0,
}

function timeKey(now: number, length: number): string {
  return new Date(now).toISOString().slice(0, length)
}

export function consumeGlooBudget(
  current: GlooBudgetState | undefined,
  operation: GlooOperation,
  now: number,
  config: GlooBudgetConfig,
): { state: GlooBudgetState; decision: GlooBudgetDecision } {
  const state = { ...(current ?? EMPTY_STATE) }
  const day = timeKey(now, 10)
  const minute = timeKey(now, 16)

  if (state.day !== day) {
    state.day = day
    state.dailyAnalyze = 0
    state.dailyRewrite = 0
  }
  if (state.minute !== minute) {
    state.minute = minute
    state.burstAnalyze = 0
    state.burstRewrite = 0
  }

  const analyze = operation === 'analyze'
  const daily = analyze ? state.dailyAnalyze : state.dailyRewrite
  const total = analyze ? state.totalAnalyze : state.totalRewrite
  const burst = analyze ? state.burstAnalyze : state.burstRewrite
  const dailyLimit = analyze ? config.analyzeDailyLimit : config.rewriteDailyLimit
  const totalLimit = analyze ? config.analyzeTotalLimit : config.rewriteTotalLimit
  const burstLimit = analyze ? config.analyzeBurstLimit : config.rewriteBurstLimit
  const remaining = (allowed: boolean, reason?: GlooBudgetDecision['reason']): GlooBudgetDecision => ({
    allowed,
    ...(reason ? { reason } : {}),
    remainingDaily: Math.max(0, dailyLimit - daily - (allowed ? 1 : 0)),
    remainingTotal: Math.max(0, totalLimit - total - (allowed ? 1 : 0)),
  })

  if (now >= config.endAt) return { state, decision: remaining(false, 'deadline') }
  if (daily >= dailyLimit) return { state, decision: remaining(false, 'daily_limit') }
  if (total >= totalLimit) return { state, decision: remaining(false, 'total_limit') }
  if (burst >= burstLimit) return { state, decision: remaining(false, 'burst_limit') }

  if (analyze) {
    state.dailyAnalyze += 1
    state.totalAnalyze += 1
    state.burstAnalyze += 1
  } else {
    state.dailyRewrite += 1
    state.totalRewrite += 1
    state.burstRewrite += 1
  }
  return { state, decision: remaining(true) }
}

export interface GlooBudgetEnv {
  GLOO_BUDGET_END?: string
  GLOO_ANALYSIS_DAILY_LIMIT?: string
  GLOO_REWRITE_DAILY_LIMIT?: string
  GLOO_ANALYSIS_TOTAL_LIMIT?: string
  GLOO_REWRITE_TOTAL_LIMIT?: string
  GLOO_ANALYSIS_BURST_LIMIT?: string
  GLOO_REWRITE_BURST_LIMIT?: string
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function budgetConfig(env: GlooBudgetEnv): GlooBudgetConfig {
  const endAt = Date.parse(env.GLOO_BUDGET_END ?? '2026-07-31T22:00:00Z')
  return {
    endAt: Number.isFinite(endAt) ? endAt : Date.parse('2026-07-31T22:00:00Z'),
    analyzeDailyLimit: positiveInteger(env.GLOO_ANALYSIS_DAILY_LIMIT, 300),
    rewriteDailyLimit: positiveInteger(env.GLOO_REWRITE_DAILY_LIMIT, 75),
    analyzeTotalLimit: positiveInteger(env.GLOO_ANALYSIS_TOTAL_LIMIT, 2_500),
    rewriteTotalLimit: positiveInteger(env.GLOO_REWRITE_TOTAL_LIMIT, 600),
    analyzeBurstLimit: positiveInteger(env.GLOO_ANALYSIS_BURST_LIMIT, 30),
    rewriteBurstLimit: positiveInteger(env.GLOO_REWRITE_BURST_LIMIT, 10),
  }
}

export class GlooBudget {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: GlooBudgetEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const body = await request.json().catch(() => null) as { operation?: unknown } | null
    if (body?.operation !== 'analyze' && body?.operation !== 'rewrite') {
      return Response.json({ allowed: false, reason: 'invalid_operation' }, { status: 400 })
    }

    const current = await this.state.storage.get<GlooBudgetState>('budget')
    const result = consumeGlooBudget(current, body.operation, Date.now(), budgetConfig(this.env))
    if (result.decision.allowed) await this.state.storage.put('budget', result.state)
    return Response.json(result.decision)
  }
}
