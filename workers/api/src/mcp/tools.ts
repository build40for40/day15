import { PRIORITY_MEANINGS, priorityLabel } from '@day15/shared/priorities'
import { ref } from '@day15/shared/refs'
import {
  PERSONA_NAMES,
  TOPICS,
  type Fact,
  type OpenQuestion,
  type Participant,
  type RoomSnapshot,
  type Topic,
} from '@day15/shared/schema'

import type { CoachTurn, Env, Identity, OpeningBriefFn } from '../contracts'
import { logModelError } from '../model'
import {
  CHECKED_UP_TO,
  COACH_FAILED,
  NOT_CHECKED,
  NO_FACTS,
  NO_OPEN_QUESTIONS,
  NO_PROJECT,
  OPEN_QUESTIONS_HEADING,
  OPEN_ROOM_GUIDE,
  PROPOSED,
  TOPIC_LABELS,
} from './text'

export interface McpDeps {
  coachTurn: CoachTurn
  openingBrief: OpeningBriefFn
}

export interface ToolContext {
  env: Env
  identity: Identity
  deps: McpDeps
}

export interface ToolResult {
  text: string
  isError?: true
}

const SAFE_ERRORS = new Set(['CoachError', 'ModelUnavailableError', 'RoomError'])

function failure(where: string, error: unknown): ToolResult {
  if (error instanceof Error && SAFE_ERRORS.has(error.name)) return { text: error.message, isError: true }
  logModelError(where, error)
  return { text: COACH_FAILED, isError: true }
}

export async function openRoom({ env, identity, deps }: ToolContext): Promise<ToolResult> {
  try {
    const project = await identity.room.project()
    if (!project) return { text: NO_PROJECT, isError: true }
    const brief = await deps.openingBrief(env, identity.room, identity.participant)
    const questions = await identity.room.openQuestions()
    return { text: openRoomText(identity.participant, project.name, brief.reply, questions) }
  } catch (error) {
    return failure('open_room', error)
  }
}

export async function tellCoach({ env, identity, deps }: ToolContext, message: string): Promise<ToolResult> {
  let reply: string
  try {
    reply = (await deps.coachTurn(env, identity.room, identity.participant, message)).reply
  } catch (error) {
    return failure('tell_coach', error)
  }
  try {
    await identity.room.scheduleLensRounds()
  } catch (error) {
    logModelError('Scheduling lens rounds', error)
  }
  return { text: reply }
}

export interface ReadRoomFilter {
  topic?: Topic
  onlyOpenQuestions?: boolean
}

export async function readRoom({ identity }: ToolContext, filter: ReadRoomFilter = {}): Promise<ToolResult> {
  const snapshot = await identity.room.read()
  return snapshot ? { text: renderRoomView(snapshot, filter) } : { text: NO_PROJECT, isError: true }
}

export function openRoomText(participant: Participant, projectName: string, reply: string, questions: OpenQuestion[]): string {
  return [
    `You're connected as ${participant.name}, ${PERSONA_NAMES[participant.persona]} on the ${participant.side} side of "${projectName}".`,
    OPEN_ROOM_GUIDE,
    `The coach says:\n\n${reply}`,
    ...(questions.length
      ? [`${OPEN_QUESTIONS_HEADING}. ${PRIORITY_MEANINGS}\n\n${questions.map(questionLine).join('\n')}`]
      : []),
  ].join('\n\n')
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

const list = (refs: string[]) => (refs.length > 1 ? `${refs.slice(0, -1).join(', ')} and ${refs.at(-1)}` : (refs[0] ?? ''))

/** Lens names stay out: people never learn which lens a finding came from. */
function factLine(fact: Fact, people: Map<number, Participant>): string {
  let source: string
  if (fact.authorKind === 'lens') {
    source = `worked out by the coach from ${list(fact.basedOn.map((id) => ref('fact', id)))}`
  } else {
    const who = fact.participantId ? people.get(fact.participantId) : undefined
    source = who ? `from ${who.name}, ${who.side} side` : 'from someone no longer on the project'
  }
  const proposed = fact.status === 'proposed' ? `${PROPOSED} ` : ''
  const replaces = fact.supersedes ? ` Replaces ${ref('fact', fact.supersedes)}.` : ''
  return `- ${ref('fact', fact.id)} ${proposed}${oneLine(fact.statement)}${replaces} (${source})`
}

const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9£$€]+/g, ' ').trim()

const MIN_OVERLAP = 12

function overlaps(a: string, b: string): boolean {
  const [x, y] = [words(a), words(b)]
  return x.length >= MIN_OVERLAP && y.length >= MIN_OVERLAP && (x.includes(y) || y.includes(x))
}

/** Open questions carry free-text topics, so one belongs to a topic when it names it or quotes one of its facts. */
function questionOnTopic(question: OpenQuestion, topic: Topic, facts: Fact[]): boolean {
  const named = words(question.topic)
  if (named.includes(words(TOPIC_LABELS[topic])) || named.includes(words(topic))) return true
  if (facts.some((fact) => fact.topic === topic && question.basedOn.includes(fact.id))) return true
  const said = [question.agencySaid, question.clientSaid, question.statement].filter((text): text is string => !!text)
  return facts.some(
    (fact) => fact.topic === topic && said.some((text) => [fact.sourceQuote ?? '', fact.statement].some((other) => overlaps(text, other))),
  )
}

/** Lens names stay out: people never learn which lens raised a question. */
export function questionLine(question: OpenQuestion): string {
  const head = `- ${ref('question', question.id)}, ${priorityLabel(question.priority)} priority: `
  const topic = oneLine(question.topic)
  if (question.kind === 'conflict') {
    return (
      `${head}${topic || 'A disagreement'} (${question.severity}). The agency side said: "${oneLine(question.agencySaid ?? '')}" ` +
      `The client side said: "${oneLine(question.clientSaid ?? '')}" ${oneLine(question.statement)}`.trimEnd()
    )
  }
  const side = question.askSide === 'both' ? 'both sides' : `the ${question.askSide} side`
  return `${head}${topic ? `${topic}. ` : ''}Still to hear from ${side}: ${oneLine(question.statement)}`
}

/**
 * What read_room shows: current facts by topic, proposed ones marked, then every open question, most urgent first.
 * With `onlyOpenQuestions`, just the open questions.
 */
export function renderRoomView(snapshot: RoomSnapshot, { topic, onlyOpenQuestions }: ReadRoomFilter = {}): string {
  const people = new Map(snapshot.participants.map((participant) => [participant.id, participant]))
  const current = snapshot.facts.filter((fact) => fact.status !== 'superseded')
  const topics = topic ? [topic] : TOPICS.filter((t) => current.some((fact) => fact.topic === t))

  const sections = topics.map((t) => {
    const lines = current.filter((fact) => fact.topic === t).map((fact) => factLine(fact, people))
    return `## ${TOPIC_LABELS[t]}\n\n${lines.length ? lines.join('\n') : NO_FACTS}`
  })
  if (!sections.length) sections.push(NO_FACTS)

  const questions = snapshot.openQuestions.filter((question) => !topic || questionOnTopic(question, topic, snapshot.facts))
  const watermarks = Object.values(snapshot.latestRuns).map((run) => run?.watermark ?? 0)
  const checkedUpTo = watermarks.length ? Math.min(...watermarks) : 0
  const stale =
    checkedUpTo >= snapshot.watermark
      ? ''
      : checkedUpTo
        ? `\n\n${CHECKED_UP_TO(ref('fact', checkedUpTo))}`
        : `\n\n${NOT_CHECKED}`
  const list = questions.length ? `${PRIORITY_MEANINGS}\n\n${questions.map(questionLine).join('\n')}` : NO_OPEN_QUESTIONS
  const open = `## ${OPEN_QUESTIONS_HEADING}\n\n${list}${stale}`

  return [
    `# "${oneLine(snapshot.project.name)}"${topic ? `: ${TOPIC_LABELS[topic]}` : ''}`,
    ...(onlyOpenQuestions ? [] : sections),
    open,
  ].join('\n\n')
}
