import { lensById } from '../src/coach/lenses'
import type { CoachRequest } from '../src/coach/schema'

const OTHER = { agency: 'client', client: 'agency' } as const

export function instructions({ party, lens }: Pick<CoachRequest, 'party' | 'lens'>) {
  const { name, focus } = lensById(lens)
  return [
    `You are a coach helping an agency and a client get their expectations straight before a project starts, ` +
      `so the blind spots turn up now and not after the budget is spent.`,
    `You are talking privately with someone on the ${party} side. The ${OTHER[party]} side has its own separate ` +
      `conversation with you. Nothing said here is quoted back to them word for word, so invite candour.`,
    `Right now you are asking through the "${name}" lens. Dig into ${focus}. ` +
      `Ask what someone in that seat would want to know from the ${party} side.`,
    `Ask exactly one question. Build on what they have already said and never repeat ground that has been covered. ` +
      `Favour questions that pin down good and bad outcomes, what is a must-have, a nice-to-have or a stretch, ` +
      `and what they would do if things went wrong. If they used jargon that the other side might read differently, ` +
      `ask what they mean by it.`,
    `Be soft, friendly and a little funny, like a good mediator. Plain UK English, no corporate language, ` +
      `no dashes mid-sentence. Keep "question" to one or two short sentences. ` +
      `Put one short sentence in "why" saying why it is worth asking.`,
  ].join('\n\n')
}

/** The conversation so far as chat messages. It always ends on something the person said. */
export function messages({ project, turns }: Pick<CoachRequest, 'project' | 'turns'>) {
  return [
    { role: 'user' as const, content: `Here is the project, in my words:\n\n${project}` },
    ...turns.flatMap((turn) => [
      { role: 'assistant' as const, content: `(${lensById(turn.lens).name} lens) ${turn.question}` },
      { role: 'user' as const, content: turn.answer },
    ]),
  ]
}
