/**
 * Cloudflare Workers AI provider.
 *
 * A stand-in for Gloo while Gloo AI Studio is unreachable: its free tier
 * requires payment details, and the cards available were declined. This keeps
 * development honest rather than stalling behind a billing form.
 *
 * The submission runs on Gloo. Everything here exists behind the same
 * interface, receives the same prompts, and is swapped with one env var.
 *
 * Chosen model: Llama 3.3 70B Instruct (fp8, fast). It is the strongest
 * general instruction-following model on Workers AI and holds a JSON contract
 * reliably, which is what this pipeline needs. Overridable via WORKERS_AI_MODEL.
 */

import { GlooAnalysisSchema, GlooRewritesSchema, type GlooAnalysis, type GlooRewrites } from '../lib/contracts'
import { analyzeSystemPrompt, rewriteSystemPrompt, userMessage } from './prompts'
import {
  ModelError,
  parseStructured,
  type AnalyzeInput,
  type ReflectionModel,
  type RewriteInput,
} from './model'

export const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

/** The subset of the Workers AI binding this needs. */
export interface WorkersAiBinding {
  run(
    model: string,
    input: {
      messages: Array<{ role: 'system' | 'user'; content: string }>
      temperature?: number
      max_tokens?: number
    },
  ): Promise<unknown>
}

export class WorkersAiModel implements ReflectionModel {
  readonly provider = 'workers-ai' as const

  constructor(
    private readonly ai: WorkersAiBinding,
    private readonly model: string = DEFAULT_WORKERS_AI_MODEL,
  ) {}

  private async complete(system: string, user: string, maxTokens: number): Promise<string> {
    let result: unknown
    try {
      result = await this.ai.run(this.model, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
      })
    } catch (error) {
      throw new ModelError(
        `workers ai call failed: ${(error as Error).message}`,
        this.provider,
      )
    }

    const text = extractText(result)
    if (!text) {
      // Model families differ in response shape, and the binding is typed as
      // any. Name the keys we did get so the next mismatch takes seconds.
      const shape =
        result && typeof result === 'object' ? Object.keys(result).join(',') : typeof result
      throw new ModelError(
        `workers ai returned no text (model ${this.model}, response keys: ${shape})`,
        this.provider,
      )
    }
    return text
  }

  async analyze({ draft, locale, context, receivedMessage, principleHint }: AnalyzeInput): Promise<GlooAnalysis> {
    const raw = await this.complete(
      analyzeSystemPrompt(principleHint),
      userMessage(draft, locale, context, receivedMessage),
      260,
    )
    return parseStructured(raw, GlooAnalysisSchema, 'analysis', this.provider)
  }

  async rewrite({ draft, goal, principle, modes, locale }: RewriteInput): Promise<GlooRewrites> {
    const raw = await this.complete(
      rewriteSystemPrompt(principle, goal, modes),
      userMessage(draft, locale),
      700,
    )
    return parseStructured(raw, GlooRewritesSchema, 'rewrites', this.provider)
  }
}

/**
 * Workers AI has returned several response shapes over time, and the binding's
 * type is `any`. Check the ones actually seen rather than trusting one.
 */
function extractText(result: unknown): string | null {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return null

  const record = result as Record<string, unknown>

  if (typeof record.response === 'string') return record.response

  const choices = record.choices
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as { message?: { content?: unknown }; text?: unknown }
    if (typeof first?.message?.content === 'string') return first.message.content
    if (typeof first?.text === 'string') return first.text
  }

  if (typeof record.result === 'string') return record.result
  return null
}
