/**
 * Gloo AI Studio provider.
 *
 * This is the provider the competition requires and the one the submission
 * runs on. It is written and wired but **unverified**: Gloo AI Studio requires
 * payment details even on its free tier, and every card tried was declined, so
 * no credentials exist yet to test against.
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
const DEFAULT_MODEL = 'gloo-openai-gpt-5-mini'

export interface GlooConfig {
  clientId: string
  clientSecret: string
  tokenUrl?: string
  apiBase?: string
  model?: string
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
    const response = await this.fetchImpl(this.tokenUrl, {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=api/access',
    })

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
    const token = await this.accessToken()
    const response = await this.fetchImpl(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model ?? DEFAULT_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      throw new ModelError(`completion failed (${response.status})`, this.provider, response.status)
    }

    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = body.choices?.[0]?.message?.content
    if (!content) throw new ModelError('completion response had no content', this.provider)
    return content
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
