import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Plugin } from 'vite'

const API = '/day15/api'

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

        if (req.method === 'POST' && path === `${API}/coach`) {
          const body = JSON.parse(await readBody(req)) as { lens: string; turns: unknown[] }
          const questions = QUESTIONS[body.lens] ?? QUESTIONS.client!
          await wait(400)
          return streamJson(res, {
            question: `[fake] ${questions[body.turns.length % questions.length]}`,
            why: 'This is the fake coach, so the reason is canned too.',
          })
        }

        res.writeHead(404)
        res.end('Not found')
      })
    },
  }
}
