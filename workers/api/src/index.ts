import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText, Output } from 'ai'

import { LENS_IDS } from '@day15/shared/lenses'
import {
  brainReplySchema,
  coachRequestSchema,
  partySchema,
  personaReportSchema,
  type CoachReply,
} from '@day15/shared/schema'
import { harnessPrompt } from './harness'
import type { ProjectRoom } from './project-room'
import { instructions, messages } from './prompt'
import { freshReports, mySide, version, type Reports, type Room } from './room'

export { ProjectRoom } from './project-room'

interface Env {
  ANTHROPIC_API_KEY?: string
  /** Only for keys that aren't scoped to a workspace. */
  ANTHROPIC_WORKSPACE_ID?: string
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
    if (request.method === 'GET' && action === 'brain') {
      const state = await room.read()
      return state ? Response.json({ ...state.sides, reports: state.reports?.byLens }) : noProject()
    }
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

  const anthropic = createAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    headers: env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID } : undefined,
  })
  try {
    const model = anthropic(MODEL)
    const providerOptions = { anthropic: { effort: 'low', fallbacks: 'default' } } as const

    // The five persona harnesses each read both sides and report. A reload reuses the reports it already has.
    let reports = freshReports(state)
    if (!reports) {
      reports = await runHarnesses(state, (prompt) =>
        generateText({
          model,
          prompt,
          output: Output.object({ schema: personaReportSchema, name: 'report' }),
          providerOptions,
        }).then((result) => result.output),
      )
      await room.saveReports(version(state), reports)
    }

    // Not streamed: the brain's reasoning can mention the other side, so it never leaves the Worker.
    const { output } = await generateText({
      model,
      instructions: instructions(party, state, reports),
      messages: messages(side),
      output: Output.object({ schema: brainReplySchema, name: 'question' }),
      providerOptions,
    })
    const { lens, question, why, rationale } = output
    await room.pend(party, { lens, question, rationale })
    return Response.json({ lens, question, why } satisfies CoachReply)
  } catch (error) {
    // Only the name: the full error holds the request, which holds what people typed.
    console.error('Coach failed:', error instanceof Error ? error.name : 'Unknown error')
    return new Response('The coach lost its thread. Try that again.', { status: 502 })
  }
}

/** Runs all five harnesses at once. One failing is survivable; all five failing is not. */
async function runHarnesses(state: Room, run: (prompt: string) => Promise<Reports[keyof Reports]>): Promise<Reports> {
  const settled = await Promise.allSettled(LENS_IDS.map((lens) => run(harnessPrompt(lens, state))))
  const reports: Reports = {}
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') reports[LENS_IDS[index]!] = result.value
    else console.error('Harness failed:', LENS_IDS[index], result.reason instanceof Error ? result.reason.name : 'Unknown error')
  })
  if (!Object.keys(reports).length) throw new Error('Every persona harness failed')
  return reports
}
