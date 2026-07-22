/**
 * Gloo AI Studio provider.
 *
 * This is the provider the competition requires and the primary judged path.
 *
 * Endpoint defaults were confirmed against Gloo's official developer
 * quickstart on 2026-07-20. They remain overridable because available models
 * are organization-specific and credentials still need a live smoke test.
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

const DEFAULT_TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token'
const DEFAULT_API_BASE = 'https://platform.ai.gloo.com/ai/v2'
const DEFAULT_MODEL = 'gloo-google-gemini-2.5-flash-lite'
const TOKEN_TIMEOUT_MS = 5_000
const COMPLETION_TIMEOUT_MS = 12_000

const ANALYSIS_TOOL_NAME = 'select_reviewed_scripture'

/**
 * Gloo V2 tool use makes the moment selection machine-readable before our own
 * schema validation. The tool is deliberately a selection, never a verse
 * lookup: the Worker, not a model, verifies and retrieves Scripture from
 * YouVersion after this call.
 */
const ANALYSIS_TOOL = {
  type: 'function',
  function: {
    name: ANALYSIS_TOOL_NAME,
    description: 'Select one reviewed Scripture principle and ranked reference IDs for a consequential draft.',
    parameters: {
      type: 'object',
      properties: {
        needs_reflection: { type: 'boolean' },
        draft_needs_care: { type: 'boolean' },
        goal: { type: 'string' },
        principle: { type: 'string' },
        candidate_reference_ids: { type: 'array', items: { type: 'string' } },
        why: { type: 'string' },
        question: { type: 'string' },
        safety_flags: { type: 'array', items: { type: 'string' } },
      },
      required: ['needs_reflection', 'goal', 'principle', 'candidate_reference_ids', 'why', 'question', 'safety_flags'],
    },
  },
} as const

export interface GlooConfig {
  clientId: string
  clientSecret: string
  tokenUrl?: string
  apiBase?: string
  model?: string
}

interface CompletionBody {
  choices?: Array<{
    message?: {
      content?: string
      tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>
    }
  }>
}

export class GlooModel implements ReflectionModel {
  readonly provider = 'gloo' as const

  private cachedToken: { value: string; expiresAt: number } | null = null
  private readonly fetchImpl: typeof fetch

  constructor(
    private readonly config: GlooConfig,
    fetchImpl?: typeof fetch,
  ) {
    // See the note in youversion.ts: a bare `fetch` default throws
    // "Illegal invocation" in Workers when called as a method.
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init))
  }

  private get tokenUrl(): string {
    return this.config.tokenUrl ?? DEFAULT_TOKEN_URL
  }

  private get apiBase(): string {
    return this.config.apiBase ?? DEFAULT_API_BASE
  }

  /** Client credentials, cached until shortly before expiry. */
  async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.value
    }

    const basic = btoa(`${this.config.clientId}:${this.config.clientSecret}`)
    let response: Response
    try {
      response = await this.fetchImpl(this.tokenUrl, {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&scope=api/access',
        signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      })
    } catch (error) {
      if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') {
        throw new ModelError('token request timed out', this.provider, 504)
      }
      throw new ModelError('token request failed', this.provider)
    }

    if (!response.ok) {
      throw new ModelError(`token request failed (${response.status})`, this.provider, response.status)
    }

    const body = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!body.access_token) throw new ModelError('token response had no access_token', this.provider)

    this.cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    }
    return this.cachedToken.value
  }

  private async complete(system: string, user: string, maxTokens: number): Promise<string> {
    const body = await this.requestCompletion(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      },
      'completion',
    )
    const content = body.choices?.[0]?.message?.content
    if (!content) throw new ModelError('completion response had no content', this.provider)
    return content
  }

  private async analyzeWithTool(system: string, user: string): Promise<GlooAnalysis> {
    const body = await this.requestCompletion(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: 260,
        tools: [ANALYSIS_TOOL],
        tool_choice: 'required',
      },
      'analysis tool call',
    )
    const calls = body.choices?.[0]?.message?.tool_calls
    const call = calls?.[0]
    if (calls?.length !== 1 || call?.function?.name !== ANALYSIS_TOOL_NAME || !call.function.arguments) {
      throw new ModelError('analysis response did not call the required tool', this.provider)
    }
    return parseStructured(call.function.arguments, GlooAnalysisSchema, 'analysis tool arguments', this.provider)
  }

  /** Shared, bounded transport for both the optional rewrite and required tool path. */
  private async requestCompletion(payload: Record<string, unknown>, operation: string): Promise<CompletionBody> {
    const token = await this.accessToken()
    let response: Response
    try {
      response = await this.fetchImpl(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: this.config.model ?? DEFAULT_MODEL, ...payload }),
        signal: AbortSignal.timeout(COMPLETION_TIMEOUT_MS),
      })
    } catch (error) {
      if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') {
        throw new ModelError(`${operation} timed out`, this.provider, 504)
      }
      throw new ModelError(`${operation} request failed`, this.provider)
    }
    if (!response.ok) throw new ModelError(`${operation} failed (${response.status})`, this.provider, response.status)
    return response.json() as Promise<CompletionBody>
  }

  async analyze({ draft, locale, context, receivedMessage, principleHint }: AnalyzeInput): Promise<GlooAnalysis> {
    return this.analyzeWithTool(
      analyzeSystemPrompt(principleHint, 'tool'),
      userMessage(draft, locale, context, receivedMessage),
    )
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
