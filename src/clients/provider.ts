/**
 * Provider selection.
 *
 * One env var decides which model reads the draft. Everything downstream is
 * identical: same interface, same prompts, same schema, same allow-lists.
 *
 *   LLM_PROVIDER=gloo        the competition requires this, and the
 *                            submission runs on it
 *   LLM_PROVIDER=workers-ai  development stand-in while Gloo AI Studio is
 *                            unreachable (its free tier requires payment
 *                            details; the cards available were declined)
 *   LLM_PROVIDER=fake        deterministic, for tests. Never in the demo.
 */

import { GlooModel } from './gloo'
import { FakeModel } from './fake'
import { ModelError, type ReflectionModel } from './model'
import { RestWorkersAiBinding, WorkersAiModel, type WorkersAiBinding } from './workers-ai'

export interface ProviderEnv {
  LLM_PROVIDER?: string
  GLOO_CLIENT_ID?: string
  GLOO_CLIENT_SECRET?: string
  GLOO_TOKEN_URL?: string
  GLOO_API_BASE?: string
  GLOO_MODEL?: string
  WORKERS_AI_MODEL?: string
  AI?: WorkersAiBinding
  /**
   * A Cloudflare account to run Workers AI on over REST, when it should not be
   * the account hosting this Worker. Both must be set to take effect.
   */
  CF_ACCOUNT_ID?: string
  CF_WORKERS_AI_TOKEN?: string
}

export function createReflectionModel(env: ProviderEnv): ReflectionModel {
  const provider = env.LLM_PROVIDER ?? 'gloo'

  if (provider === 'fake') return new FakeModel()

  if (provider === 'workers-ai') {
    // Prefer a named account over REST when configured, so the neurons bill to
    // it rather than to whatever account happens to host this Worker.
    if (env.CF_ACCOUNT_ID && env.CF_WORKERS_AI_TOKEN) {
      return new WorkersAiModel(
        new RestWorkersAiBinding(env.CF_ACCOUNT_ID, env.CF_WORKERS_AI_TOKEN),
        env.WORKERS_AI_MODEL,
      )
    }
    if (!env.AI) {
      throw new ModelError(
        'Workers AI is not configured. Set CF_ACCOUNT_ID and CF_WORKERS_AI_TOKEN, ' +
          'or add [ai] binding = "AI" to wrangler.toml.',
        'workers-ai',
      )
    }
    return new WorkersAiModel(env.AI, env.WORKERS_AI_MODEL)
  }

  if (provider === 'gloo') {
    if (!env.GLOO_CLIENT_ID || !env.GLOO_CLIENT_SECRET) {
      throw new ModelError(
        'Gloo credentials are missing. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET, ' +
          'or set LLM_PROVIDER=workers-ai while they are unavailable.',
        'gloo',
      )
    }
    return new GlooModel({
      clientId: env.GLOO_CLIENT_ID,
      clientSecret: env.GLOO_CLIENT_SECRET,
      tokenUrl: env.GLOO_TOKEN_URL,
      apiBase: env.GLOO_API_BASE,
      model: env.GLOO_MODEL,
    })
  }

  throw new ModelError(`unknown LLM_PROVIDER: ${provider}`, provider)
}
