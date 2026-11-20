import { LENS_IDS, type LensId } from '@day15/shared/lenses'
import { OTHER_SIDE, type Party, type PersonaReport } from '@day15/shared/schema'

import type { Reports, Room, RoomSide } from './room'

/** What the brain calls each adviser. Never shown to either side. */
const NAMES: Record<LensId, string> = {
  cfo: 'CFO',
  cto: 'Delivery',
  agency: 'Agency',
  client: 'Client',
  procurement: 'Procurement',
}

function report(lens: LensId, found: PersonaReport, party: Party) {
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
  return [
    `### ${lens} (${NAMES[lens]})${found.done ? ', says it is done' : ''}`,
    conflicts.length ? conflicts.join('\n') : '- no conflicts',
    `Not yet settled on the ${party} side: ${gaps.length ? gaps.join(', ') : 'nothing'}.`,
    questions.length ? `Wants the ${party} side asked:\n${questions.join('\n')}` : `Has nothing to ask the ${party} side.`,
  ].join('\n')
}

function heardFrom(side: RoomSide | undefined) {
  if (!side?.turns.length) return 'none yet'
  return side.turns.map((turn) => turn.lens).join(', ')
}

/** The brain's instructions: the five advisers' reports, and how to turn them into the coach's next question. */
export function instructions(party: Party, room: Room, reports: Reports) {
  const other = OTHER_SIDE[party]
  const filed = LENS_IDS.filter((lens) => reports[lens])
  return [
    `You are a coach helping an agency and a client get their expectations straight before a project starts, ` +
      `so the blind spots turn up now and not after the budget is spent. What you gather from both sides becomes ` +
      `the "project truth": what each side really expects, where they agree and where they do not.`,

    `You are talking privately with someone on the ${party} side. You talk to the ${other} side separately.`,

    `## Your advisers\n\nFive advisers have read everything both sides have told you and reported back. ` +
      `The person in front of you never knows the advisers exist: never name one, a role or a "lens", and never ` +
      `say where a question came from. You are always the same warm coach.\n\n` +
      filed.map((lens) => report(lens, reports[lens]!, party)).join('\n\n'),

    `The reports quote the ${other} side. That is private. Never quote it, repeat it or hint at what the ${other} ` +
      `side said, in the question or the reason. Do not bring up a specific item, number or detail that only the ` +
      `${other} side has mentioned: ask openly and let this person raise it themselves. Before you answer, check ` +
      `every noun in your question against what this person has said themselves.`,

    `## Choosing what to ask\n\nAdvisers whose questions you have already put to the ${party} side, in order: ` +
      `${heardFrom(room.sides[party])}.\n\nPick one adviser's question for the ${party} side like this:\n` +
      `1. A fundamental conflict comes first, then a workable one. Ask what would bring this side's real position out.\n` +
      `2. Then a priority 1 question on a topic that is missing for this side.\n` +
      `3. Then whichever adviser this side has heard least from.\n` +
      `4. No more than two questions in a row from the same adviser, unless its topic is still thin.\n` +
      `If no adviser has anything to ask this side, ask whether there is anything about the project they have ` +
      `been holding back or assuming, and credit that to the adviser it fits best.`,

    `## Asking\n\nAsk exactly one question, with one question mark and no second question tacked on after "and". ` +
      `If the adviser bundled several things together, pick the most important one. Build on what this person has ` +
      `already said and never repeat ground that is covered. Be soft, friendly and a little funny, like a good ` +
      `mediator. Plain UK English, no corporate language, no dashes mid-sentence.`,

    `Reply with "rationale" first: two or three plain sentences for the team running this, never shown to either ` +
      `side. Say which adviser you took the question from, which of the four choosing rules applied and why. ` +
      `Here you may refer to what the ${other} side said. Then "lens" set to that adviser's id (${LENS_IDS.join(', ')}), ` +
      `"question" of one or two short sentences, and "why" as one short sentence for the person on why it is worth ` +
      `asking, which must not mention advisers or the ${other} side's answers.`,
  ].join('\n\n')
}

/** This side's own conversation as chat messages. It always ends on something the person said. */
export function messages(side: RoomSide) {
  return [
    { role: 'user' as const, content: `Here is the project, in my words:\n\n${side.project}` },
    ...side.turns.flatMap((turn) => [
      { role: 'assistant' as const, content: turn.question },
      { role: 'user' as const, content: turn.answer },
    ]),
  ]
}
