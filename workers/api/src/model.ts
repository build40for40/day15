import { createAnthropic } from '@ai-sdk/anthropic'

import type { Env } from './contracts'

export const MODEL_ID = 'claude-sonnet-5-5'

export const PROVIDER_OPTIONS = { anthropic: { effort: 'low', fallbacks: 'default' } } as const

/** Thrown when the Worker has no ANTHROPIC_API_KEY. HTTP routes answer 503, MCP tools a clear tool error. */
export class ModelUnavailableError extends Error {
  override name = 'ModelUnavailableError'
  constructor() {
    super("The coach isn't set up here yet: the Worker has no ANTHROPIC_API_KEY.")
  }
}

/** The one model every agent uses. */
export function anthropicModel(env: Pick<Env, 'ANTHROPIC_API_KEY' | 'ANTHROPIC_WORKSPACE_ID'>) {
  if (!env.ANTHROPIC_API_KEY) throw new ModelUnavailableError()
  const anthropic = createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    headers: env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID } : undefined,
  })
  return anthropic(MODEL_ID)
}

/** Logs only the error's name: the full error holds the request, which holds what people typed. */
export function logModelError(where: string, error: unknown): void {
  console.error(`${where} failed:`, error instanceof Error ? error.name : 'Unknown error')
}
