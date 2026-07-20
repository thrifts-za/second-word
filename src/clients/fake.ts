/**
 * Deterministic stand-in, so the pipeline is testable with no provider at all.
 *
 * Opt-in via LLM_PROVIDER=fake, and every rewrite it returns is prefixed
 * `[fake]`. It must never be reachable in the deployed demo: spec section 10.4
 * forbids silently substituting a fabricated result for a live one.
 */

import { GlooAnalysisSchema, GlooRewritesSchema, type GlooAnalysis, type GlooRewrites, type Principle } from '../lib/contracts'
import { PRINCIPLE_LIBRARY } from '../lib/scripture-library'
import type { AnalyzeInput, ReflectionModel, RewriteInput } from './model'

export class FakeModel implements ReflectionModel {
  readonly provider = 'fake' as const

  async analyze({ draft, context, principleHint }: AnalyzeInput): Promise<GlooAnalysis> {
    const lower = `${draft} ${context ?? ''}`.toLowerCase()
    const principle: Principle =
      principleHint ??
      (lower.includes('unsuccessful') || lower.includes('regret to inform') || lower.includes('turned down')
        ? 'meet_disappointment'
        : lower.includes("didn't do") || lower.includes('did not do') || lower.includes('blamed')
          ? 'bear_false_accusation'
          : lower.includes('sorry') || lower.includes('apolog')
            ? 'make_amends'
            : lower.includes('never') || lower.includes('always')
              ? 'refuse_contempt'
              : lower.includes('did you even') || lower.includes('clearly')
                ? 'gentle_answer'
                : 'speak_truth_in_love')

    const entry = PRINCIPLE_LIBRARY[principle]
    return GlooAnalysisSchema.parse({
      needs_reflection: true,
      goal: 'Make a point without being dismissed',
      principle,
      candidate_reference_ids: entry.candidates,
      why: entry.explanation,
      question: entry.question,
      safety_flags: [],
    })
  }

  async rewrite({ draft }: RewriteInput): Promise<GlooRewrites> {
    const trimmed = draft.trim().replace(/\s+/g, ' ').slice(0, 160)
    return GlooRewritesSchema.parse({
      clearer: `[fake] I disagree, and here is why: ${trimmed}`,
      curious: '[fake] What led you to that conclusion? I am reading it differently.',
      firm_and_gracious: '[fake] I do not think that is right, and I want to be straight about why.',
      goal_preserved: true,
      register_preserved: true,
    })
  }
}
