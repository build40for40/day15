import { createAnthropic } from '@ai-sdk/anthropic'
import { createTextStreamResponse, Output, streamText, toTextStream } from 'ai'

import { coachReplySchema, coachRequestSchema } from '../src/coach/schema'
import { instructions, messages } from './prompt'

interface Env {
  ANTHROPIC_API_KEY?: string
}

const API = '/day15/api'
const MODEL = 'claude-sonnet-5-5'
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)

    if (request.method === 'POST' && pathname === `${API}/coach`) return coach(request, env)
    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>

async function coach(request: Request, env: Env) {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response("The coach isn't set up here yet: the Worker has no ANTHROPIC_API_KEY.", { status: 503 })
  }
  const parsed = coachRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return new Response('That could not be read.', { status: 400 })

  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const result = streamText({
    model: anthropic(MODEL),
    instructions: instructions(parsed.data),
    messages: messages(parsed.data),
    output: Output.object({ schema: coachReplySchema, name: 'question' }),
    providerOptions: { anthropic: { effort: 'low', fallbacks: 'default' } },
    // The default handler logs the whole request, which holds what the person typed.
    onError: ({ error }) => console.error('Coach failed:', error instanceof Error ? error.name : 'Unknown error'),
  })

  return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) })
}
