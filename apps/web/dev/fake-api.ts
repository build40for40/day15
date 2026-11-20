import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

import type { Plugin } from 'vite'

import { LENS_IDS } from '@day15/shared/lenses'

const API = '/day15/api'

interface FakeSide {
  project: string
  turns: Record<string, unknown>[]
  pending?: { lens: string; question: string; rationale: string }
}

/** Projects live in memory and vanish when Vite restarts. */
const rooms = new Map<string, { agency?: FakeSide; client?: FakeSide }>()

const QUESTIONS: Record<string, string[]> = {
  client: [
    'What would make your boss say this was worth every penny?',
    'What would make this feel like a failure even if it shipped on time?',
  ],
  agency: [
    'How many rounds of feedback feel fair before it counts as new work?',
    'Who gets the final say when two people disagree on the creative?',
  ],
  ops: [
    'If this ends up costing a fifth more than planned, who finds the money?',
    'What does "done" look like on the day you stop working on this?',
    'Who is allowed to change the scope, and how does that get written down?',
  ],
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/** `npm run fake`: stands in for the Worker so the page clicks through with no key and no wrangler. */
export function fakeApi(): Plugin {
  return {
    name: 'day15-fake-api',
    apply: (_config, { command, mode }) => command === 'serve' && mode === 'fake',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        if (!path?.startsWith(API)) return next()

        const [id, action] = path.slice(`${API}/projects`.length).split('/').filter(Boolean)
        const json = (value: unknown) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(value))
        }

        if (req.method === 'POST' && !id) {
          const created = randomUUID()
          rooms.set(created, {})
          return json({ id: created })
        }

        const room = id ? rooms.get(id) : undefined
        if (room && req.method === 'GET' && action === 'brain') return json(room)

        if (room && req.method === 'GET' && (action === 'agency' || action === 'client')) {
          const other = action === 'agency' ? 'client' : 'agency'
          const side = room[action]
          return json({
            project: side?.project ?? '',
            turns: (side?.turns ?? []).map(({ lens, question, answer }) => ({ lens, question, answer })),
            otherSideStarted: Boolean(room[other]),
          })
        }

        if (room && req.method === 'POST' && action === 'coach') {
          const body = JSON.parse(await readBody(req)) as {
            party: 'agency' | 'client'
            project: string
            turn?: Record<string, unknown>
          }
          const side = (room[body.party] ??= { project: body.project, turns: [] })
          if (body.turn) side.turns.push({ ...body.turn, rationale: side.pending?.rationale })
          // The fake brain just takes the hats in turn, counting both sides' answers.
          const asked = (room.agency?.turns.length ?? 0) + (room.client?.turns.length ?? 0)
          const lens = LENS_IDS[asked % LENS_IDS.length]!
          const questions = QUESTIONS[lens]!
          const question = `[fake] ${questions[side.turns.length % questions.length]}`
          side.pending = { lens, question, rationale: `[fake] It was the ${lens} hat's turn. A real brain would explain itself here.` }
          await wait(400)
          return json({ lens, note: '', question, why: 'This is the fake coach, so the reason is canned too.' })
        }

        res.writeHead(404)
        res.end('Not found')
      })
    },
  }
}
