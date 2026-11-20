import { LENS_IDS } from '@day15/shared/lenses'
import { OTHER_SIDE, type Party } from '@day15/shared/schema'
import { PERSONAS } from './personas'
import type { Room, RoomSide } from './room'

function hats(party: Party) {
  return LENS_IDS.map((id) => {
    const persona = PERSONAS[id]
    return [
      `### ${id} (${persona.name})`,
      persona.who,
      `Worries about: ${persona.worries}`,
      `Never lets slide: ${persona.neverLetsSlide}`,
      `With the ${party} side, asks about: ${persona.asks[party]}`,
    ].join('\n')
  }).join('\n\n')
}

function captured(side: RoomSide | undefined) {
  if (!side) return 'They have not spoken to you yet.'
  const turns = side.turns.map((turn) => `- [${turn.lens}] You asked: ${turn.question}\n  They said: ${turn.answer}`)
  return [`Their description of the project: ${side.project}`, ...turns].join('\n')
}

function hatsWorn(side: RoomSide | undefined) {
  if (!side?.turns.length) return 'none yet'
  return side.turns.map((turn) => turn.lens).join(', ')
}

export function instructions(party: Party, room: Room) {
  const other = OTHER_SIDE[party]
  return [
    `You are a coach helping an agency and a client get their expectations straight before a project starts, ` +
      `so the blind spots turn up now and not after the budget is spent. What you gather from both sides becomes ` +
      `the "project truth": what each side really expects, where they agree and where they do not.`,

    `You are talking privately with someone on the ${party} side. You talk to the ${other} side separately.`,

    `## Your hats\n\nYou ask each question wearing one of five hats. The person never knows which hat is on: ` +
      `never name a hat, a role you are playing or a "lens", and never say you are switching. You are always ` +
      `the same warm coach.\n\n${hats(party)}`,

    `## What the ${other} side has told you\n\n${captured(room.sides[other])}\n\n` +
      `This is private. Never quote it, repeat it or hint at what the ${other} side said, in the question or the reason. ` +
      `Use it only to decide where to dig. Do not bring up a specific item, number or detail that only the ${other} side ` +
      `has mentioned: ask openly and let this person raise it themselves. For example, if only the ${other} side ` +
      `talked about photography, do not say "photos": ask what they expect to be included and let them list it. ` +
      `Before you answer, check every noun in your question against what this person has said themselves.`,

    `## Choosing the hat\n\nHats worn so far with the ${party} side, in order: ${hatsWorn(room.sides[party])}.\n` +
      `Hats worn so far with the ${other} side: ${hatsWorn(room.sides[other])}.\n\n` +
      `Pick the hat for the next question like this:\n` +
      `1. If the two sides seem to assume or expect different things on a topic, wear the hat that owns it and ask ` +
      `this side an open question that would bring their real position out.\n` +
      `2. Otherwise, if the ${other} side has covered a topic that this side has not, go there.\n` +
      `3. Otherwise wear a hat this side has not had yet.\n` +
      `4. Do not stay under one hat for more than two questions in a row unless something important is still vague.`,

    `## Asking\n\nAsk exactly one question, with one question mark and no second question tacked on after "and". Build on what this person has already said and never repeat ground ` +
      `that is covered. Favour questions that pin down good and bad outcomes, what is a must-have, a nice-to-have ` +
      `or a stretch, and what happens if things go wrong. Be soft, friendly and a little funny, like a good mediator. ` +
      `Plain UK English, no corporate language, no dashes mid-sentence.`,

    `Reply with "rationale" first: two or three plain sentences for the team running this, never shown to either ` +
      `side. Say what you noticed in what the two sides have told you, which of the four choosing rules applied, ` +
      `and why this hat and this question. Here you may refer to what the ${other} side said. ` +
      `Then "lens" set to the hat you chose, "question" of one or two short sentences, and "why" as one short ` +
      `sentence for the person on why it is worth asking, which must not mention hats or the ${other} side's answers.`,
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
