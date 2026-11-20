import { createAnthropic } from '@ai-sdk/anthropic'
import { createTextStreamResponse, Output, streamText, toTextStream } from 'ai'

import { coachReplySchema, coachRequestSchema, partySchema } from '../src/coach/schema'
import type { ProjectRoom } from './project-room'
import { instructions, messages } from './prompt'
import { mySide } from './room'

export { ProjectRoom } from './project-room'

interface Env {
  ANTHROPIC_API_KEY?: string
  ROOMS: DurableObjectNamespace<ProjectRoom>
}

const API = '/day15/api'
const MODEL = 'claude-sonnet-5-5'
const PROJECT_ID = /^[0-9a-f-]{36}$/

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (!pathname.startsWith(`${API}/projects`)) return new Response('Not found', { status: 404 })
    const [id, action, ...rest] = pathname.slice(`${API}/projects`.length).split('/').filter(Boolean)

    if (request.method === 'POST' && !id) {
      const created = crypto.randomUUID()
      await env.ROOMS.getByName(created).create()
      return Response.json({ id: created })
    }
    if (!id || !PROJECT_ID.test(id) || !action || rest.length) return new Response('Not found', { status: 404 })

    const room = env.ROOMS.getByName(id)
    if (request.method === 'POST' && action === 'coach') return coach(request, env, room)
    if (request.method === 'GET') {
      const party = partySchema.safeParse(action)
      const state = party.success ? await room.read() : null
      return state && party.success ? Response.json(mySide(state, party.data)) : noProject()
    }
    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>

const noProject = () => new Response("That project link doesn't lead anywhere.", { status: 404 })

async function coach(request: Request, env: Env, room: DurableObjectStub<ProjectRoom>) {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response("The coach isn't set up here yet: the Worker has no ANTHROPIC_API_KEY.", { status: 503 })
  }
  const parsed = coachRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return new Response('That could not be read.', { status: 400 })

  const { party, project, turn } = parsed.data
  const state = await room.record(party, project, turn)
  const side = state?.sides[party]
  if (!state || !side) return noProject()

  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const result = streamText({
    model: anthropic(MODEL),
    instructions: instructions(party, state),
    messages: messages(side),
    output: Output.object({ schema: coachReplySchema, name: 'question' }),
    providerOptions: { anthropic: { effort: 'low', fallbacks: 'default' } },
    // The default handler logs the whole request, which holds what people typed.
    onError: ({ error }) => console.error('Coach failed:', error instanceof Error ? error.name : 'Unknown error'),
  })

  return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) })
}
