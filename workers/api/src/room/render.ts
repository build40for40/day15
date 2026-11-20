import { areaName } from '@day15/shared/areas'
import { LENS_NAMES } from '@day15/shared/lenses'
import { PRIORITY_MEANINGS, priorityLabel } from '@day15/shared/priorities'
import { ref } from '@day15/shared/refs'
import { PERSONA_NAMES, type Ask, type Fact, type OpenQuestion, type Participant, type RoomSnapshot } from '@day15/shared/schema'

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? '')

/**
 * One fact, readable on its own. Built only from what never changes once written, so old lines never move: the
 * person is named by id and the side stored on the fact, since names and roles can be edited in the people list.
 */
export function renderFact(fact: Fact): string {
  const head = `${ref('fact', fact.id)} [${fact.topic}]`
  let source: string
  if (fact.authorKind === 'person') {
    const by = `${ref('participant', fact.participantId ?? 0)}${fact.side ? ` (${fact.side} side)` : ''}`
    source = `${fact.statedAs === 'proposed' ? 'proposed, to be confirmed by' : 'said by'} ${by} in ${ref('item', fact.sourceItemId ?? 0)}`
  } else {
    const lens = fact.lens ? `the ${LENS_NAMES[fact.lens]} lens` : 'a lens'
    source = `proposed by ${lens} in ${ref('lensRun', fact.lensRunId ?? 0)}`
  }
  const basedOn = fact.basedOn.length ? `, from ${list(fact.basedOn.map((id) => ref('fact', id)))}` : ''
  const replaces = fact.supersedes ? ` Replaces ${ref('fact', fact.supersedes)}.` : ''
  const quote = fact.sourceQuote ? ` Quote: "${oneLine(fact.sourceQuote)}"` : ''
  return `${head} ${source}${basedOn}: ${oneLine(fact.statement)}${replaces}${quote}`
}

function link(person: Participant): string {
  if (person.hasLink) return 'Has a link.'
  return person.addedBy === 'coach' ? 'No link: mentioned in conversation.' : 'No link yet.'
}

/** One person on one line: who they are, their side and seat, the lenses that speak for them, and their link. */
export function renderPerson(person: Participant): string {
  const role = [person.jobTitle, person.organisation].map(oneLine).filter(Boolean).join(' at ')
  const lenses = person.lenses.length
    ? `Speaks for the ${list(person.lenses.map((lens) => LENS_NAMES[lens]))} ${person.lenses.length > 1 ? 'lenses' : 'lens'}.`
    : 'Speaks for no lens.'
  const notes = oneLine(person.notes) ? ` Notes: ${oneLine(person.notes)}` : ''
  return (
    `${ref('participant', person.id)} ${oneLine(person.name)}${role ? `, ${role}` : ''}. ` +
    `${person.side === 'agency' ? 'Agency' : 'Client'} side, ${PERSONA_NAMES[person.persona]}. ${lenses} ${link(person)}${notes}`
  )
}

function raisedBy(question: OpenQuestion): string {
  if (question.lens) return `the ${LENS_NAMES[question.lens]} lens in ${ref('lensRun', question.raisedByRun ?? 0)}`
  return `the coach after ${ref('item', question.raisedByItem ?? 0)}`
}

/** One open question on one line, with who raised it, for the coach and the lenses. */
export function renderQuestion(question: OpenQuestion): string {
  const topic = oneLine(question.topic) ? ` on "${oneLine(question.topic)}"` : ''
  const side = question.askSide === 'both' ? 'both sides' : `the ${question.askSide} side`
  const restsOnPrivate = question.restsOnPrivate ? ', resting on private material' : ''
  const head =
    `${ref('question', question.id)} [${priorityLabel(question.priority)} priority] ${question.kind}${topic} in ` +
    `${areaName(question.area)}, for ${side}, raised by ${raisedBy(question)}${restsOnPrivate}`
  const body =
    question.kind === 'conflict'
      ? `the agency said "${oneLine(question.agencySaid ?? '')}", the client said "${oneLine(question.clientSaid ?? '')}". ${oneLine(question.statement)}`
      : `find out ${oneLine(question.statement)}.${question.because ? ` Because: ${oneLine(question.because)}` : ''}`
  return `${head}: ${body}`.trimEnd()
}

function renderAsk(ask: Ask, people: Map<number, Participant>): string {
  const who = people.get(ask.addressedTo)
  const to = who ? `${ref('participant', who.id)} ${who.name}` : ref('participant', ask.addressedTo)
  const lens = ask.lens ? `, for the ${LENS_NAMES[ask.lens]} lens` : ''
  const chasing = ask.questionId ? `, chasing ${ref('question', ask.questionId)}` : ''
  const because = ask.because ? ` Because: ${oneLine(ask.because)}` : ''
  return `${ref('ask', ask.id)} to ${to}${lens}${chasing}: ${oneLine(ask.ask)}${because}`
}

/**
 * The whole room as text, the one way any model reads it. The project and the facts come first and only ever
 * grow at the end, so the text before the people, open questions and asks stays the same between calls and caches
 * well.
 */
export function renderRoom(room: RoomSnapshot): string {
  const people = new Map(room.participants.map((participant) => [participant.id, participant]))
  const open = room.asks.filter((ask) => ask.status === 'open')
  const privateFacts = room.facts.filter((fact) => fact.private && fact.status !== 'superseded')
  return [
    `# The data room for "${oneLine(room.project.name)}"`,
    'An agency and a client are agreeing brief, scope and budget before work starts. Both sides can see what is ' +
      'below, except the private facts, which only the side that said them can see. Ids are short: f is a fact, i ' +
      'something a person said, p a person, a an ask, r a lens run, q an open question.',
    '## Facts, oldest first',
    'Each line stands alone. When a line replaces an earlier one, the earlier one no longer holds. Who said what ' +
      'is given by person id: the people list below says who each one is.',
    room.facts.length ? room.facts.map(renderFact).join('\n') : 'No facts yet.',
    '## Private facts',
    'Seen only by the side of the person who said them, and by the coach and the lenses. Never repeat, quote or ' +
      'hint at one to the other side.',
    privateFacts.length ? privateFacts.map((fact) => ref('fact', fact.id)).join(', ') : 'None.',
    '## People',
    room.participants.length ? room.participants.map(renderPerson).join('\n') : 'Nobody yet.',
    '## Open questions, most urgent first',
    `What the lenses and the coach found still unresolved. ${PRIORITY_MEANINGS}`,
    room.openQuestions.length ? room.openQuestions.map(renderQuestion).join('\n') : 'None.',
    '## Open asks',
    open.length ? open.map((ask) => renderAsk(ask, people)).join('\n') : 'None.',
  ].join('\n\n')
}
