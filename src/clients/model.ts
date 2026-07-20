/**
 * The reflection model: the one component that reads a draft and decides what
 * kind of moment it is.
 *
 * It has exactly two jobs, both auditable:
 *   1. analyze - goal, principle, ranked candidate IDs from the reviewed library
 *   2. rewrite - alternatives constrained by the validated principle
 *
 * It is never asked to produce verse text. The schema has no field for it.
 *
 * COMPETITION NOTE: Scripture in New Frontiers requires Gloo AI Studio, and
 * the submission runs on Gloo. Workers AI exists here because Gloo AI Studio
 * requires payment details even on its free tier and the cards available to
 * this builder were declined, so development could not otherwise proceed.
 * Provider is a single env var. Nothing else changes when Gloo is wired in.
 */

import type { GlooAnalysis, GlooRewrites, Principle, RewriteMode } from '../lib/contracts'

export interface AnalyzeInput {
  draft: string
  locale: string
  /** What is happening, in the person's own words. */
  context?: string
  /** The message being replied to. Written by someone else; see RECEIVED_GUARD. */
  receivedMessage?: string
  /** A moment the person chose themselves when they invited Second Word. */
  principleHint?: Principle
}

export interface RewriteInput {
  draft: string
  goal: string
  principle: Principle
  modes: RewriteMode[]
  locale: string
}

export interface ReflectionModel {
  /** Named in responses and logs so it is always clear what actually ran. */
  readonly provider: 'gloo' | 'workers-ai' | 'fake'
  analyze(input: AnalyzeInput): Promise<GlooAnalysis>
  rewrite(input: RewriteInput): Promise<GlooRewrites>
}

export class ModelError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ModelError'
  }
}

/**
 * Models wrap JSON in prose or fences often enough to be worth handling once,
 * here, rather than in every provider. This is extraction, not repair of bad
 * values: anything outside the allow-lists still fails validation.
 */
export function parseStructured<T>(
  raw: string,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  label: string,
  provider: string,
): T {
  const candidates = [raw, stripFences(raw), extractFirstObject(raw)].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      const parsed = schema.safeParse(JSON.parse(candidate))
      if (parsed.success && parsed.data !== undefined) return parsed.data
    } catch {
      // try the next candidate
    }
  }
  throw new ModelError(`${label} response did not match the contract`, provider)
}

function stripFences(raw: string): string {
  return raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
}

function extractFirstObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  return start >= 0 && end > start ? raw.slice(start, end + 1) : null
}
