import { LENS_IDS, type LensId } from '@day15/shared/lenses'
import { OTHER_SIDE, type Party, type PersonaReport } from '@day15/shared/schema'

import motherAgent from '../../../persona-harnesses/mother-agent.md'
import type { Reports, Room, RoomSide } from './room'

/** What the brain calls each adviser. Never shown to either side. */
const NAMES: Record<LensId, string> = {
  client: 'Client',
  agency: 'Agency',
  ops: 'Delivery, procurement and finance',
}

function report(lens: LensId, found: PersonaReport, party: Party) {
  const requirements = found.requirements.map((item) => `- (${item.from}) ${item.requirement}`)
  const conflicts = found.conflicts.map(
    (conflict) =>
      `- ${conflict.severity} conflict on "${conflict.topic}": the agency said "${conflict.agency_said}", ` +
      `the client said "${conflict.client_said}". ${conflict.note}`,
  )
  const gaps = found.coverage
    .filter((topic) => topic[party] !== 'settled')
    .map((topic) => `${topic.topic} (${topic[party]})`)
  const questions = found.questions
    .filter((question) => question.ask === party)
    .sort((a, b) => a.priority - b.priority)
    .map((question) => `- priority ${question.priority}: find out ${question.find_out} Because: ${question.because}`)
  const education = found.education
    .filter((item) => item.for === party)
    .map(
      (item) =>
        `- ${item.topic}: ${item.why_it_matters} Arguments they could use: ${item.arguments.join(' | ')}`,
    )
  return [
    `### ${lens} (${NAMES[lens]})${found.done ? ', says it is done' : ''}`,
    requirements.length ? `Requirements picked up so far:\n${requirements.join('\n')}` : 'No requirements picked up yet.',
    conflicts.length ? conflicts.join('\n') : '- no conflicts',
    `Not yet settled on the ${party} side: ${gaps.length ? gaps.join(', ') : 'nothing'}.`,
    questions.length ? `Wants the ${party} side asked:\n${questions.join('\n')}` : `Has nothing to ask the ${party} side.`,
    education.length ? `Thinks the ${party} side could do with understanding:\n${education.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function heardFrom(side: RoomSide | undefined) {
  if (!side?.turns.length) return 'none yet'
  return side.turns.map((turn) => turn.lens).join(', ')
}

/**
 * The mother agent's instructions: its Actor, Instructions and Mission from `persona-harnesses/mother-agent.md`,
 * then where things stand right now and the shape of the reply.
 */
export function instructions(party: Party, room: Room, reports: Reports) {
  const other = OTHER_SIDE[party]
  const filed = LENS_IDS.filter((lens) => reports[lens])
  return [
    motherAgent.trim(),

    `## Right now\n\nYou are talking privately with someone on the ${party} side. "The other side" is the ${other} side, ` +
      `which you talk to separately.\n\nPersona agents whose questions you have already put to the ${party} side, ` +
      `in order: ${heardFrom(room.sides[party])}.`,

    `## The persona agents' reports\n\n` + filed.map((lens) => report(lens, reports[lens]!, party)).join('\n\n'),

    `## Your reply\n\nReply with "rationale" first: two or three plain sentences for the team running this, never ` +
      `shown to either side. Say which persona agent you took the question from, which choosing rule applied and why. ` +
      `Here you may refer to what the ${other} side said. Then "lens" set to that persona agent's id ` +
      `(${LENS_IDS.join(', ')}), "note" (what you explain before asking, or an empty string when you are only asking), ` +
      `"question", and "why" as your one short reason for the person.`,
  ].join('\n\n')
}

/** This side's own conversation as chat messages. It always ends on something the person said. */
export function messages(side: RoomSide) {
  return [
    { role: 'user' as const, content: `Here is the project, in my words:\n\n${side.project}` },
    ...side.turns.flatMap((turn) => [
      { role: 'assistant' as const, content: turn.note ? `${turn.note}\n\n${turn.question}` : turn.question },
      { role: 'user' as const, content: turn.answer },
    ]),
  ]
}
