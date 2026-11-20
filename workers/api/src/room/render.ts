import { LENS_NAMES } from '@day15/shared/lenses'
import { ref } from '@day15/shared/refs'
import { PERSONA_NAMES, type Ask, type Fact, type Participant, type RoomSnapshot } from '@day15/shared/schema'

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

const person = (participant: Participant) =>
  `${participant.name} (${ref('participant', participant.id)}, ${participant.side} side, ${PERSONA_NAMES[participant.persona]})`

const list = (refs: string[]) =>
  refs.length > 1 ? `${refs.slice(0, -1).join(', ')} and ${refs.at(-1)}` : (refs[0] ?? '')

/** One fact, readable on its own. Built only from what never changes once written, so old lines never move. */
export function renderFact(fact: Fact, people: Map<number, Participant>): string {
  const head = `${ref('fact', fact.id)} [${fact.topic}]`
  const status = fact.status === 'superseded' ? 'confirmed' : fact.status
  let source: string
  if (fact.authorKind === 'person') {
    const who = fact.participantId && people.get(fact.participantId)
    const by = who ? person(who) : ref('participant', fact.participantId ?? 0)
    source = `${status === 'proposed' ? 'proposed, to be confirmed by' : 'said by'} ${by} in ${ref('item', fact.sourceItemId ?? 0)}`
  } else {
    const lens = fact.lens ? `the ${LENS_NAMES[fact.lens]} lens` : 'a lens'
    source = `proposed by ${lens} in ${ref('lensRun', fact.lensRunId ?? 0)}`
  }
  const basedOn = fact.basedOn.length ? `, from ${list(fact.basedOn.map((id) => ref('fact', id)))}` : ''
  const replaces = fact.supersedes ? ` Replaces ${ref('fact', fact.supersedes)}.` : ''
  const quote = fact.sourceQuote ? ` Quote: "${oneLine(fact.sourceQuote)}"` : ''
  return `${head} ${source}${basedOn}: ${oneLine(fact.statement)}${replaces}${quote}`
}

function renderAsk(ask: Ask, people: Map<number, Participant>): string {
  const who = people.get(ask.addressedTo)
  const to = who ? `${ref('participant', who.id)} ${who.name}` : ref('participant', ask.addressedTo)
  const lens = ask.lens ? `, for the ${LENS_NAMES[ask.lens]} lens` : ''
  const because = ask.because ? ` Because: ${oneLine(ask.because)}` : ''
  return `${ref('ask', ask.id)} to ${to}${lens}: ${oneLine(ask.ask)}${because}`
}

/**
 * The whole room as text, the one way any model reads it. The project and the facts come first and only ever
 * grow at the end, so the text before the people and asks stays the same between calls and caches well.
 */
export function renderRoom(room: RoomSnapshot): string {
  const people = new Map(room.participants.map((participant) => [participant.id, participant]))
  const open = room.asks.filter((ask) => ask.status === 'open')
  return [
    `# The data room for "${oneLine(room.project.name)}"`,
    'An agency and a client are agreeing brief, scope and budget before work starts. Everything below is shared ' +
      'by both sides. Ids are short: f is a fact, i something a person said, p a person, a an ask, r a lens run.',
    '## Facts, oldest first',
    'Each line stands alone. When a line replaces an earlier one, the earlier one no longer holds.',
    room.facts.length ? room.facts.map((fact) => renderFact(fact, people)).join('\n') : 'No facts yet.',
    '## People',
    room.participants.length ? room.participants.map((participant) => person(participant)).join('\n') : 'Nobody yet.',
    '## Open asks',
    open.length ? open.map((ask) => renderAsk(ask, people)).join('\n') : 'None.',
  ].join('\n\n')
}
