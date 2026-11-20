import { areaName, TOPIC_AREA } from '@day15/shared/areas'
import { PRIORITY_MEANINGS, priorityLabel } from '@day15/shared/priorities'
import { ref } from '@day15/shared/refs'
import { PERSONA_NAMES, TOPICS, type Fact, type Participant, type Topic } from '@day15/shared/schema'

import type { CoachTurn, Env, Identity, OpeningBriefFn } from '../contracts'
import { logModelError } from '../model'
import { sideView, type SideQuestion, type SideView } from '../room/side-view'
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
  WITHHELD,
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
    const snapshot = await identity.room.read()
    if (!snapshot) return { text: NO_PROJECT, isError: true }
    return { text: openRoomText(identity.participant, sideView(snapshot, identity.participant.side), brief.reply) }
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
  if (!snapshot) return { text: NO_PROJECT, isError: true }
  return { text: renderRoomView(sideView(snapshot, identity.participant.side), filter) }
}

export function openRoomText(participant: Participant, view: SideView, reply: string): string {
  const questions = view.openQuestions
  return [
    `You're connected as ${participant.name}, ${PERSONA_NAMES[participant.persona]} on the ${participant.side} side of "${view.project.name}".`,
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

/** Lens names stay out: people never learn which lens raised a question. */
export function questionLine(question: SideQuestion): string {
  const head = `- ${ref('question', question.id)}, ${priorityLabel(question.priority)} priority: `
  if (question.withheld) return `${head}${areaName(question.area)}. ${WITHHELD}`
  const topic = oneLine(question.topic)
  if (question.kind === 'conflict') {
    return (
      `${head}${topic || 'A disagreement'}. The agency side said: "${oneLine(question.agencySaid ?? '')}" ` +
      `The client side said: "${oneLine(question.clientSaid ?? '')}" ${oneLine(question.statement)}`.trimEnd()
    )
  }
  const side = question.askSide === 'both' ? 'both sides' : `the ${question.askSide} side`
  return `${head}${topic ? `${topic}. ` : ''}Still to hear from ${side}: ${oneLine(question.statement)}`
}

/**
 * What read_room shows one side: the current facts it can see by topic, proposed ones marked, then every open
 * question, most urgent first. With `onlyOpenQuestions`, just the open questions. With a topic, the open questions
 * in that topic's area.
 */
export function renderRoomView(view: SideView, { topic, onlyOpenQuestions }: ReadRoomFilter = {}): string {
  const people = new Map(view.participants.map((participant) => [participant.id, participant]))
  const current = view.facts.filter((fact) => fact.status !== 'superseded')
  const topics = topic ? [topic] : TOPICS.filter((t) => current.some((fact) => fact.topic === t))

  const sections = topics.map((t) => {
    const lines = current.filter((fact) => fact.topic === t).map((fact) => factLine(fact, people))
    return `## ${TOPIC_LABELS[t]}\n\n${lines.length ? lines.join('\n') : NO_FACTS}`
  })
  if (!sections.length) sections.push(NO_FACTS)

  const questions = view.openQuestions.filter((question) => !topic || question.area === TOPIC_AREA[topic])
  const newest = current.at(-1)?.id ?? 0
  const stale =
    view.checkedUpTo >= newest
      ? ''
      : view.checkedUpTo
        ? `\n\n${CHECKED_UP_TO(ref('fact', view.checkedUpTo))}`
        : `\n\n${NOT_CHECKED}`
  const list = questions.length ? `${PRIORITY_MEANINGS}\n\n${questions.map(questionLine).join('\n')}` : NO_OPEN_QUESTIONS
  const open = `## ${OPEN_QUESTIONS_HEADING}\n\n${list}${stale}`

  return [
    `# "${oneLine(view.project.name)}"${topic ? `: ${TOPIC_LABELS[topic]}` : ''}`,
    ...(onlyOpenQuestions ? [] : sections),
    open,
  ].join('\n\n')
}
