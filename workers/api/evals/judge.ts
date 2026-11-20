import { z } from 'zod'

import type { Ask, Fact, Participant, RoomSnapshot } from '@day15/shared/schema'
import { PERSONA_NAMES } from '@day15/shared/schema'
import type { CoachReply } from '../src/contracts'
import { renderReports } from '../src/coach/prompt'
import type { Generate } from '../src/coach/index'
import { renderRoom } from '../src/room/render'

export const CRITERIA = ['faithful', 'one_ask', 'right_person', 'no_repeat', 'urgent_first', 'no_invention'] as const
export type Criterion = (typeof CRITERIA)[number]

const verdict = z.object({
  verdict: z.enum(['pass', 'fail', 'na']).describe('na only when the criterion cannot apply to this case.'),
  reason: z.string().describe('One short sentence.'),
})

export const judgeSchema = z.object(Object.fromEntries(CRITERIA.map((name) => [name, verdict])) as Record<Criterion, typeof verdict>)
export type Judgement = z.infer<typeof judgeSchema>

const RUBRIC = `You grade one turn of a coach that talks to people about a project brief. You see the room before the turn, the adviser reports, who spoke and what they said, and everything the coach did. Grade strictly against the evidence.

Criteria:
- faithful: every fact recorded matches what the person said, in their meaning and numbers, with a quote that is really in their message. A correction must replace the earlier fact. A hedge must stay a hedge (tentative). Facts the message supports but the coach missed also fail this. If the message holds no facts, pass when none were recorded.
- one_ask: the person is left with exactly one next ask, a single question about a single thing. Two questions joined by "and", or a list, fails.
- right_person: the ask suits this person's persona and side. It must be something they can answer from their role, not something only the other side or another persona would know.
- no_repeat: the coach does not ask again for something this person already said in this message or earlier (including asks marked answered in the room).
- urgent_first: where adviser reports hold conflicts, the ask goes to the most severe conflict this person can speak to, before minor or merely thin items. na when the reports hold no conflicts relevant to this person.
- no_invention: nothing is made up: no facts, numbers, names, dates or decisions that the person or the room did not supply. The reply text must not claim things nobody said.

Mark fail only for a clear miss. The case notes say what a good turn looks like.`

const describeAsk = (ask: Ask | null, people: Map<number, Participant>) =>
  ask ? `${ask.ask} (to ${people.get(ask.addressedTo)?.name}, because: ${ask.because})` : 'none'

export function judgeInstructions() {
  return [{ role: 'system' as const, content: RUBRIC }]
}

export function judgePrompt(args: {
  before: RoomSnapshot
  speaker: Participant
  message: string
  expect: string
  reply: CoachReply
  after: RoomSnapshot
}): string {
  const { before, speaker, message, expect, reply, after } = args
  const people = new Map(before.participants.map((person) => [person.id, person]))
  const noted = reply.noted.map((fact: Fact) => `- [${fact.status}] ${fact.statement} | quote: "${fact.sourceQuote}"${fact.supersedes ? ` | replaces f${fact.supersedes}` : ''}`)
  const openAsks = after.asks.filter((ask) => ask.addressedTo === speaker.id && ask.status === 'open')
  return [
    `# Case notes\n${expect}`,
    `# Room before the turn\n${renderRoom(before)}`,
    `${renderReports(before)}`,
    `# Asks already answered\n${before.asks.filter((ask) => ask.status === 'answered').map((ask) => `- ${describeAsk(ask, people)}`).join('\n') || 'none'}`,
    `# Open asks before the turn for ${speaker.name}\n${before.asks.filter((ask) => ask.addressedTo === speaker.id && ask.status === 'open').map((ask) => `- a${ask.id}: ${ask.ask}`).join('\n') || 'none'}`,
    `# Who spoke\n${speaker.name}, ${PERSONA_NAMES[speaker.persona]}, ${speaker.side} side.\n\n# What they said\n${message}`,
    `# What the coach did\nFacts recorded:\n${noted.join('\n') || 'none'}\nAsks closed as answered: ${reply.closed.map((ask) => `a${ask.id}`).join(', ') || 'none'}\nReply shown to the person:\n${reply.reply}\nNext ask stored: ${describeAsk(reply.ask, people)}\nOpen asks for the person after the turn: ${openAsks.length}`,
  ].join('\n\n')
}

export async function judge(generate: Generate, input: Parameters<typeof judgePrompt>[0]): Promise<Judgement> {
  return generate({ instructions: judgeInstructions(), prompt: judgePrompt(input), schema: judgeSchema, name: 'coach_judgement' })
}
