// Runs the three persona agents and the mother agent against project stories, and scores the result.
//
//   pnpm dev                                                    (in another terminal: the real Worker)
//   node --env-file=workers/api/.dev.vars evals/run.mjs         (all stories in evals/stories.json)
//   node --env-file=workers/api/.dev.vars evals/run.mjs 1 9     (only stories 1 and 9)
//
// For each story Claude plays the agency and the client, each knowing only its own private expectation.
// Both talk to the real coach. A judge then reads the story, both conversations and the persona agents'
// reports, and says whether the hidden gap was found.
//
// evals/stories.json and evals/results/ are ignored by git: some stories are real. The shape of a story
// is in evals/stories.example.json.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const HERE = new URL('.', import.meta.url)
const APP = process.env.EVAL_APP ?? 'http://localhost:5173/day15/api'
const MODEL = 'claude-sonnet-5-5'
/** Questions the coach gets to ask each side. Each side answers all but the last. */
const QUESTIONS_PER_SIDE = 3
const AT_ONCE = 4
const SIDES = ['agency', 'client']

const key = process.env.ANTHROPIC_API_KEY
if (!key) {
  console.error('No ANTHROPIC_API_KEY. Run with: node --env-file=workers/api/.dev.vars evals/run.mjs')
  process.exit(2)
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Fetches with a few patient retries, for rate limits and the odd wobble. */
async function patiently(what, url, init) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, init).catch(() => null)
    if (response?.ok) return response
    const status = response?.status ?? 'no answer'
    const retry = !response || [429, 500, 502, 503, 529].includes(response.status)
    if (!retry || attempt === 4) throw new Error(`${what} failed: ${status}`)
    await wait(attempt * 5000)
  }
}

// The limits are generous on purpose: a reply cut off halfway is a failed run, and the prompts ask for short answers.
async function claude(system, messages, maxTokens = 2000) {
  const response = await patiently('Claude', 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      ...(process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : {}),
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  })
  const body = await response.json()
  const text = body.content.map((block) => block.text ?? '').join('').trim()
  if (!text) throw new Error(`Claude said nothing (stop reason: ${body.stop_reason})`)
  return text
}

async function app(path, body) {
  const response = await patiently(`The app (${path})`, `${APP}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return response.json()
}

/** The person Claude plays on one side of a story. */
function character(story, side) {
  return [
    `You are playing the ${side} side of a project, to test a coaching tool. Stay in character as one busy person.`,
    `The project: ${story.context}`,
    `What is agreed on paper: ${story.agreed}`,
    `What you privately expect, which is your honest view: ${story[`${side}_private`]}`,
    `Something neither side has thought through: ${story.unknowns} You have not thought about it either. ` +
      `Do not bring it up yourself. If a question leads you straight to it, answer honestly, including saying you had not considered it.`,
    `You do not know what the other side privately expects.`,
    `Answer in one to three plain sentences. Be honest and direct about what you were asked. ` +
      `Do not volunteer anything you were not asked. Never mention that this is a test or a role play.`,
  ].join('\n\n')
}

async function runStory(story) {
  const { id: projectId } = await app('/projects', {})
  const sides = {}

  for (const side of SIDES) {
    const project = await claude(character(story, side), [
      {
        role: 'user',
        content:
          'Describe the project in one or two sentences, the way you would at the start of a first conversation. ' +
          'Use what is agreed on paper in your own everyday words. Do not spell out your private expectation.',
      },
    ])
    const reply = await app(`/projects/${projectId}/coach`, { party: side, project })
    sides[side] = { project, chat: [], waiting: reply }
  }

  // The two sides take turns, as they would over a few days.
  for (let round = 1; round < QUESTIONS_PER_SIDE; round++) {
    for (const side of SIDES) {
      const state = sides[side]
      const { lens, question } = state.waiting
      const answer = await claude(character(story, side), [
        { role: 'user', content: `Here is how you described the project: ${state.project}` },
        { role: 'assistant', content: 'Understood.' },
        ...state.chat.flatMap((turn) => [
          { role: 'user', content: turn.question },
          { role: 'assistant', content: turn.answer },
        ]),
        { role: 'user', content: question },
      ])
      state.chat.push({ question, answer })
      state.waiting = await app(`/projects/${projectId}/coach`, {
        party: side,
        project: state.project,
        turn: { lens, question, answer },
      })
    }
  }

  const room = await app(`/projects/${projectId}/brain`)
  return { projectId, room, verdict: await judge(story, room) }
}

function transcript(room, side) {
  const half = room[side]
  const asked = [...half.turns, ...(half.pending ? [half.pending] : [])]
  return [
    `Their description: ${half.project}`,
    ...asked.map(
      (turn, index) =>
        `Question ${index + 1} (from the ${turn.lens} persona agent): ${turn.question}\n` +
        (turn.answer ? `Answer: ${turn.answer}` : 'Not answered yet.'),
    ),
  ].join('\n')
}

function reports(room) {
  return Object.entries(room.reports ?? {})
    .map(([lens, report]) =>
      [
        `### ${lens}`,
        ...report.conflicts.map(
          (conflict) =>
            `Conflict (${conflict.severity}) on ${conflict.topic}: agency "${conflict.agency_said}" / client "${conflict.client_said}". ${conflict.note}`,
        ),
        ...report.questions.map((question) => `Still wants to ask the ${question.ask}: ${question.find_out}`),
        ...report.requirements.map((item) => `Requirement (${item.from}): ${item.requirement}`),
      ].join('\n'),
    )
    .join('\n\n')
}

const JUDGE = `You are grading a coaching tool that helps an agency and a client line up their expectations before a project starts.
Three persona agents (client, agency, and ops, which is delivery, procurement and finance) read what both sides say and report. A mother agent then asks each side one question at a time, in private.

You are given a story with a known hidden gap, both private conversations, and the persona agents' final reports. Grade strictly from the evidence. Reply with only a JSON object:

{
  "gap": "the hidden gap in one sentence",
  "personas_spotted_gap": true or false,          // a persona agent reported a conflict or an open question that is really about this gap
  "spotted_by": ["client" | "agency" | "ops"],
  "mother_asked_gap_question": true or false,     // a question put to either side would bring this gap into the open, in the spirit of the story's intervention question
  "gap_question": "the question that did it, or empty",
  "asked_of": "agency" | "client" | "both" | "nobody",
  "first_question_number": number or null,        // which question to that side it was, 1 is the first
  "double_questions": number,                     // questions that really ask two separate things
  "leaks": number,                                // questions that reveal or strongly hint at something only the OTHER side said
  "leak_example": "the worst one, or empty",
  "false_alarm": true or false,                   // a fundamental conflict was reported that the story does not support
  "verdict": "caught" | "partly" | "missed",
  "note": "one sentence on why"
}

Verdict for a story where a gap is expected: "caught" if the gap was both spotted by a persona agent and asked about by the mother agent; "partly" if only one of those; "missed" if neither.
Verdict for a story marked as aligned: "caught" if the tool reported no fundamental conflict about the topic the two sides agree on; "partly" if it raised only a workable or minor one; "missed" if it invented a fundamental conflict.`

async function judge(story, room) {
  const text = await claude(
    JUDGE,
    [
      {
        role: 'user',
        content: [
          `## The story\n\nFailure type: ${story.failure_type}\nWhat is expected: ${story.expect === 'aligned' ? 'the two sides are ALIGNED, there is no hidden gap' : 'a hidden gap'}`,
          `Context: ${story.context}\nAgreed on paper: ${story.agreed}`,
          `Client privately expects: ${story.client_private}\nAgency privately expects: ${story.agency_private}`,
          `Unknowns: ${story.unknowns}`,
          `The intervention that would have helped: ${story.intervention_question}\nThe signal: ${story.signal}`,
          `## The agency's conversation\n\n${transcript(room, 'agency')}`,
          `## The client's conversation\n\n${transcript(room, 'client')}`,
          `## The persona agents' final reports\n\n${reports(room)}`,
        ].join('\n\n'),
      },
    ],
    6000,
  )
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  } catch {
    throw new Error(`The judge did not answer in JSON: ${text.slice(0, 200) || '(nothing)'}`)
  }
}

const all = JSON.parse(await readFile(new URL('stories.json', HERE), 'utf8'))
const wanted = process.argv.slice(2).map(Number)
const stories = wanted.length ? all.filter((story) => wanted.includes(story.id)) : all

const results = []
const queue = [...stories]
await Promise.all(
  Array.from({ length: AT_ONCE }, async () => {
    for (let story = queue.shift(); story; story = queue.shift()) {
      const started = Date.now()
      try {
        const outcome = await runStory(story)
        results.push({ story, ...outcome })
        console.error(`Story ${story.id}: ${outcome.verdict.verdict} (${Math.round((Date.now() - started) / 1000)}s)`)
      } catch (error) {
        results.push({ story, error: String(error) })
        if (process.env.EVAL_DEBUG) console.error(error)
        console.error(`Story ${story.id}: did not finish. ${error}`)
      }
    }
  }),
)
results.sort((a, b) => a.story.id - b.story.id)

await mkdir(new URL('results/', HERE), { recursive: true })
const file = new URL(`results/${new Date().toISOString().replace(/[:.]/g, '-')}.json`, HERE)
await writeFile(file, JSON.stringify(results, null, 2))

const yes = (value) => (value ? 'yes' : 'no')
console.log('| # | Story | Type | Verdict | Personas spotted it | Mother asked it | Double questions | Leaks |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |')
for (const { story, verdict, error } of results) {
  if (error) {
    console.log(`| ${story.id} | ${story.title} | ${story.failure_type} | did not finish | | | | |`)
    continue
  }
  const spotted = verdict.personas_spotted_gap ? `yes (${verdict.spotted_by.join(', ')})` : 'no'
  const asked = verdict.mother_asked_gap_question
    ? `yes (${verdict.asked_of}, question ${verdict.first_question_number})`
    : 'no'
  console.log(
    `| ${story.id} | ${story.title} | ${story.failure_type} | ${verdict.verdict} | ${story.expect === 'aligned' ? `aligned, false alarm: ${yes(verdict.false_alarm)}` : spotted} | ${asked} | ${verdict.double_questions} | ${verdict.leaks} |`,
  )
}
const done = results.filter((result) => result.verdict)
const count = (verdict) => done.filter((result) => result.verdict.verdict === verdict).length
console.log(`\nCaught ${count('caught')}, partly ${count('partly')}, missed ${count('missed')}, of ${done.length} finished.`)
console.log(`Full results: ${fileURLToPath(file)}`)
