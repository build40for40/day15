import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Plugin } from 'vite'

import { LENS_IDS } from '../src/coach/lenses'

const API = '/day15/api'

interface FakeSide {
  project: string
  turns: unknown[]
}

/** Projects live in memory and vanish when Vite restarts. */
const rooms = new Map<string, { agency?: FakeSide; client?: FakeSide }>()

const QUESTIONS: Record<string, string[]> = {
  cfo: [
    'If this ends up costing a fifth more than planned, who finds the money?',
    'Which bit would you cut first if the budget would not stretch?',
  ],
  cto: [
    'What does "done" look like on the day you stop working on this?',
    'What is the one thing that depends on somebody outside the room?',
  ],
  agency: [
    'How many rounds of feedback feel fair before it counts as new work?',
    'Who gets the final say when two people disagree on the creative?',
  ],
  client: [
    'What would make your boss say this was worth every penny?',
    'What would make this feel like a failure even if it shipped on time?',
  ],
  procurement: [
    'Who is allowed to change the scope, and how does that get written down?',
    'If you two fall out over this, who do you ring first?',
  ],
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

async function streamJson(res: ServerResponse, value: unknown) {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  const text = JSON.stringify(value)
  for (let index = 0; index < text.length; index += 12) {
    res.write(text.slice(index, index + 12))
    await wait(30)
  }
  res.end()
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
        if (room && req.method === 'GET' && (action === 'agency' || action === 'client')) {
          const other = action === 'agency' ? 'client' : 'agency'
          return json({ ...(room[action] ?? { project: '', turns: [] }), otherSideStarted: Boolean(room[other]) })
        }

        if (room && req.method === 'POST' && action === 'coach') {
          const body = JSON.parse(await readBody(req)) as { party: 'agency' | 'client'; project: string; turn?: unknown }
          const side = (room[body.party] ??= { project: body.project, turns: [] })
          if (body.turn) side.turns.push(body.turn)
          // The fake brain just takes the hats in turn, counting both sides' answers.
          const asked = (room.agency?.turns.length ?? 0) + (room.client?.turns.length ?? 0)
          const lens = LENS_IDS[asked % LENS_IDS.length]!
          const questions = QUESTIONS[lens]!
          await wait(400)
          return streamJson(res, {
            lens,
            question: `[fake] ${questions[side.turns.length % questions.length]}`,
            why: 'This is the fake coach, so the reason is canned too.',
          })
        }

        res.writeHead(404)
        res.end('Not found')
      })
    },
  }
}
