import { ref } from '@day15/shared/refs'
import {
  PERSONA_NAMES,
  TOPICS,
  type Fact,
  type Participant,
  type PersonaReport,
  type RoomSnapshot,
  type Topic,
} from '@day15/shared/schema'

import type { CoachTurn, Env, Identity, OpeningBriefFn, RunLensRounds } from '../contracts'
import { logModelError } from '../model'
import {
  CHECKED_UP_TO,
  COACH_FAILED,
  CONFLICTS_HEADING,
  NOT_CHECKED,
  NO_CONFLICTS,
  NO_FACTS,
  NO_PROJECT,
  OPEN_ROOM_GUIDE,
  PROPOSED,
  TOPIC_LABELS,
} from './text'

export interface McpDeps {
  coachTurn: CoachTurn
  openingBrief: OpeningBriefFn
  runLensRounds: RunLensRounds
}

export interface ToolContext {
  env: Env
  ctx: Pick<ExecutionContext, 'waitUntil'>
  identity: Identity
  deps: McpDeps
}

export interface ToolResult {
  text: string
  isError?: true
}

type Conflict = PersonaReport['conflicts'][number]

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
    return { text: openRoomText(identity.participant, project.name, brief.reply) }
  } catch (error) {
    return failure('open_room', error)
  }
}

export async function tellCoach({ env, ctx, identity, deps }: ToolContext, message: string): Promise<ToolResult> {
  let reply: string
  try {
    reply = (await deps.coachTurn(env, identity.room, identity.participant, message)).reply
  } catch (error) {
    return failure('tell_coach', error)
  }
  ctx.waitUntil(deps.runLensRounds(env, identity.room))
  return { text: reply }
}

export async function readRoom({ identity }: ToolContext, topic?: Topic): Promise<ToolResult> {
  const snapshot = await identity.room.read()
  return snapshot ? { text: renderRoomView(snapshot, topic) } : { text: NO_PROJECT, isError: true }
}

export function openRoomText(participant: Participant, projectName: string, reply: string): string {
  return [
    `You're connected as ${participant.name}, ${PERSONA_NAMES[participant.persona]} on the ${participant.side} side of "${projectName}".`,
    OPEN_ROOM_GUIDE,
    `The coach says:\n\n${reply}`,
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

/** Lens conflicts carry free-text topics, so a conflict belongs to a topic when it names it or quotes one of its facts. */
function conflictOnTopic(conflict: Conflict, topic: Topic, facts: Fact[]): boolean {
  const named = words(conflict.topic)
  if (named.includes(words(TOPIC_LABELS[topic])) || named.includes(words(topic))) return true
  return facts.some(
    (fact) =>
      fact.topic === topic &&
      [conflict.agency_said, conflict.client_said].some((said) =>
        [fact.sourceQuote ?? '', fact.statement].some((text) => overlaps(said, text)),
      ),
  )
}

const SEVERITY_ORDER: Record<Conflict['severity'], number> = { fundamental: 0, workable: 1, minor: 2 }

export function openConflicts(snapshot: RoomSnapshot): Conflict[] {
  const seen = new Set<string>()
  const conflicts: Conflict[] = []
  for (const run of Object.values(snapshot.latestRuns)) {
    for (const conflict of run?.report?.conflicts ?? []) {
      const key = [conflict.topic, conflict.agency_said, conflict.client_said].map(words).join('|')
      if (seen.has(key)) continue
      seen.add(key)
      conflicts.push(conflict)
    }
  }
  return conflicts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

const conflictLine = (conflict: Conflict) =>
  `- ${oneLine(conflict.topic)} (${conflict.severity}). The agency side said: "${oneLine(conflict.agency_said)}" ` +
  `The client side said: "${oneLine(conflict.client_said)}" ${oneLine(conflict.note)}`.trimEnd()

/** What read_room shows: current facts by topic, proposed ones marked, then the conflicts from the latest lens reports. */
export function renderRoomView(snapshot: RoomSnapshot, topic?: Topic): string {
  const people = new Map(snapshot.participants.map((participant) => [participant.id, participant]))
  const current = snapshot.facts.filter((fact) => fact.status !== 'superseded')
  const topics = topic ? [topic] : TOPICS.filter((t) => current.some((fact) => fact.topic === t))

  const sections = topics.map((t) => {
    const lines = current.filter((fact) => fact.topic === t).map((fact) => factLine(fact, people))
    return `## ${TOPIC_LABELS[t]}\n\n${lines.length ? lines.join('\n') : NO_FACTS}`
  })
  if (!sections.length) sections.push(NO_FACTS)

  const conflicts = openConflicts(snapshot).filter((conflict) => !topic || conflictOnTopic(conflict, topic, snapshot.facts))
  const watermarks = Object.values(snapshot.latestRuns).map((run) => run?.watermark ?? 0)
  const checkedUpTo = watermarks.length ? Math.min(...watermarks) : 0
  const stale =
    checkedUpTo >= snapshot.watermark
      ? ''
      : checkedUpTo
        ? `\n\n${CHECKED_UP_TO(ref('fact', checkedUpTo))}`
        : `\n\n${NOT_CHECKED}`

  return [
    `# "${oneLine(snapshot.project.name)}"${topic ? `: ${TOPIC_LABELS[topic]}` : ''}`,
    ...sections,
    `## ${CONFLICTS_HEADING}\n\n${conflicts.length ? conflicts.map(conflictLine).join('\n') : NO_CONFLICTS}${stale}`,
  ].join('\n\n')
}
