import type { AlignmentAreaId } from '@day15/shared/alignment'
import { areaRank, TOPIC_AREA } from '@day15/shared/areas'
import { LENS_IDS, type LensId } from '@day15/shared/lenses'
import {
  OTHER_SIDE,
  SIDES,
  TOPICS,
  type OpenQuestion,
  type Participant,
  type RoomSnapshot,
  type Side,
  type Topic,
} from '@day15/shared/schema'

export type CandidateKind = 'conflict' | 'gap' | 'missing_topic'

/** Something the coach could ask this person next, in the order it should be considered. */
export interface AskCandidate {
  kind: CandidateKind
  /** The open question it comes from, or null for a brief topic nobody has covered. */
  questionId: number | null
  priority: number | null
  severity: OpenQuestion['severity']
  area: AlignmentAreaId
  lens: LensId | null
  topic: string
  /** What the coach needs to learn, for the model to phrase. */
  findOut: string
  because: string
  /** A plain question to fall back on when the model asks nothing. */
  question: string
  /** True when nobody on this person's side speaks for the lens, so it falls to them without being theirs. */
  unowned: boolean
}

type Found = Omit<AskCandidate, 'unowned'>

/** The lens each brief topic matters most to, so a missing topic still has an owner. */
export const TOPIC_LENS: Record<Exclude<Topic, 'other'>, LensId> = {
  background: 'client',
  objective: 'client',
  audience: 'client',
  insight: 'client',
  kpis: 'client',
  budget: 'cfo',
  deliverables: 'cto',
  timeline: 'cto',
  sign_off: 'agency',
  legal_ip: 'procurement',
}

const TOPIC_QUESTIONS: Record<Exclude<Topic, 'other'>, string> = {
  background: 'What led to this project, and why now?',
  objective: 'If this goes brilliantly, what has changed for the business?',
  audience: 'Who is this really for?',
  insight: "What do you know about the audience that the brief hasn't said yet?",
  kpis: 'What number would tell you this worked?',
  budget: 'What do you understand the budget to cover?',
  deliverables: 'What exactly do you expect to have in your hands at the end?',
  timeline: 'Which date matters most here, and how fixed is it?',
  sign_off: 'Who has the final yes on the work?',
  legal_ip: 'Who do you expect to own the work once it is paid for?',
}

const BRIEF_TOPICS = TOPICS.filter((topic): topic is Exclude<Topic, 'other'> => topic !== 'other')

const sentence = (text: string) => text.trim().replace(/[.?!\s]+$/, '')

const lowerFirst = (text: string) => (/^[A-Z][a-z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text)

const askAbout = (findOut: string) => `Could you tell me ${lowerFirst(sentence(findOut))}?`

/** The people on a side whose lenses include this one. */
export function speakersFor(room: RoomSnapshot, lens: LensId, side: Side): Participant[] {
  return room.participants.filter((person) => person.side === side && person.lenses.includes(lens))
}

/** Each side's lenses that nobody on that side speaks for. The other side's own lens is never a gap. */
export function lensGaps(room: RoomSnapshot): Record<Side, LensId[]> {
  const gaps = (side: Side) =>
    LENS_IDS.filter((lens) => lens !== OTHER_SIDE[side] && !speakersFor(room, lens, side).length)
  return Object.fromEntries(SIDES.map((side) => [side, gaps(side)])) as Record<Side, LensId[]>
}

/**
 * A lens's asks go to the people on a side who speak for it, or to anyone on that side when nobody who can be
 * asked does. People with no link can't be asked.
 */
export function routedTo(room: RoomSnapshot, participant: Participant, lens: LensId): boolean {
  return (
    participant.lenses.includes(lens) ||
    !speakersFor(room, lens, participant.side).some((person) => person.hasLink)
  )
}

/** How many asks this person has had from each lens. */
export function heardFrom(room: RoomSnapshot, participant: Participant): Record<LensId, number> {
  const counts = Object.fromEntries(LENS_IDS.map((lens) => [lens, 0])) as Record<LensId, number>
  for (const ask of room.asks) if (ask.addressedTo === participant.id && ask.lens) counts[ask.lens] += 1
  return counts
}

function fromQuestion(question: OpenQuestion): Found {
  const base = {
    questionId: question.id,
    priority: question.priority,
    severity: question.severity,
    area: question.area,
    lens: question.lens,
    topic: question.topic,
  }
  if (question.kind === 'gap') {
    return { ...base, kind: 'gap', findOut: question.statement, because: question.because, question: askAbout(question.statement) }
  }
  const topic = question.topic || 'this'
  return {
    ...base,
    kind: 'conflict',
    findOut: `where they land on "${topic}": the agency said "${question.agencySaid}" and the client said "${question.clientSaid}"`,
    because: question.statement,
    question: `Where do you land on "${sentence(topic)}"?`,
  }
}

/**
 * Open questions for this person's side from lenses routed to them, in the room's order: priority, then the area's
 * rank in the matrix, then conflicts before gaps, then oldest.
 */
function openQuestionsFor(room: RoomSnapshot, participant: Participant): Found[] {
  return room.openQuestions
    .filter(
      (question) =>
        (question.askSide === 'both' || question.askSide === participant.side) &&
        routedTo(room, participant, question.lens),
    )
    .map(fromQuestion)
}

/** Brief topics nobody on this person's side has a standing fact on, in the order of their areas in the matrix. */
function missingTopics(room: RoomSnapshot, participant: Participant): Found[] {
  const covered = new Set(
    room.facts
      .filter((fact) => fact.status !== 'superseded' && fact.side === participant.side)
      .map((fact) => fact.topic),
  )
  return BRIEF_TOPICS.filter((topic) => !covered.has(topic) && routedTo(room, participant, TOPIC_LENS[topic]))
    .sort((a, b) => areaRank(TOPIC_AREA[a]) - areaRank(TOPIC_AREA[b]))
    .map((topic) => ({
      kind: 'missing_topic' as const,
      questionId: null,
      priority: null,
      severity: null,
      area: TOPIC_AREA[topic],
      lens: TOPIC_LENS[topic],
      topic,
      findOut: `their side's view on ${topic.replace('_', ' ')}`,
      because: `Nobody on the ${participant.side} side has said anything about ${topic.replace('_', ' ')} yet.`,
      question: TOPIC_QUESTIONS[topic],
    }))
}

/**
 * What the coach could ask this person next, best first: the open questions for their side, most urgent first (by
 * priority, then the area's rank in the matrix, then conflicts before gaps, then oldest), then brief topics their
 * side has said nothing about, in area order, so a room with no lens reports yet still has something to ask. Only
 * lenses routed to this person count: ones they speak for, and ones nobody on their side speaks for.
 */
export function askCandidates(room: RoomSnapshot, participant: Participant): AskCandidate[] {
  if (LENS_IDS.every((lens) => room.latestRuns[lens]?.report?.done)) return []
  const found: Found[] = [...openQuestionsFor(room, participant), ...missingTopics(room, participant)]
  return found.map((candidate) => ({
    ...candidate,
    unowned: !!candidate.lens && !participant.lenses.includes(candidate.lens),
  }))
}
