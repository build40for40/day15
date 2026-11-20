import type { AlignmentAreaId } from '@day15/shared/alignment'
import { areaRank } from '@day15/shared/areas'
import { QUESTION_PRIORITIES, type QuestionPriority } from '@day15/shared/priorities'
import type { Ask, Fact, Participant, Project, RoomSnapshot, Side } from '@day15/shared/schema'

/** An open ask to someone on this side, with how urgent the open question it chases is. */
export interface SideAsk {
  ask: Ask
  to: Participant
  priority: QuestionPriority | null
  area: AlignmentAreaId | null
}

/** Everything one side may see of a room, under `canSee`. Not wired into the MCP tools yet. */
export interface SideView {
  project: Project
  side: Side
  /** Everyone, with notes and lenses only for people `canSee` allows. */
  participants: Participant[]
  /** Facts from people `canSee` allows, and lens facts that rest only on those. */
  facts: Fact[]
  /** The coach's open asks to people `canSee` allows, most urgent first. */
  asks: SideAsk[]
  /** How many open questions the whole project has at each priority. */
  questionCounts: Record<QuestionPriority, number>
  /** The newest of this side's facts that every lens has read, or 0 when none has. */
  checkedUpTo: number
}

/**
 * The one rule for who sees whose words: what someone on `origin` said, as a viewer on `viewer`. Swap it to change
 * what every side sees.
 */
export const canSee = (origin: Side, viewer: Side) => origin === viewer

/** A person fact is visible when its side is. A lens fact is visible when everything it rests on is. */
function visibleFacts(facts: Fact[], side: Side): Fact[] {
  const byId = new Map(facts.map((fact) => [fact.id, fact]))
  const memo = new Map<number, boolean>()
  const visible = (id: number): boolean => {
    const known = memo.get(id)
    if (known !== undefined) return known
    memo.set(id, false)
    const fact = byId.get(id)
    const result =
      fact?.authorKind === 'person'
        ? !!fact.side && canSee(fact.side, side)
        : !!fact && fact.basedOn.length > 0 && fact.basedOn.every(visible)
    memo.set(id, result)
    return result
  }
  return facts.filter((fact) => visible(fact.id))
}

const urgency = (entry: SideAsk) => [
  entry.priority ?? QUESTION_PRIORITIES.length + 1,
  entry.area ? areaRank(entry.area) : 99,
  entry.ask.id,
]

function byUrgency(a: SideAsk, b: SideAsk): number {
  const [x, y] = [urgency(a), urgency(b)]
  return x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]!
}

/**
 * One side's view of the room. The coach and the lenses read the full snapshot. Under the current rule the other
 * side's quotes, facts, notes, lenses and asks, and the lenses' own wording, are all left out.
 */
export function sideView(room: RoomSnapshot, side: Side): SideView {
  const participants = room.participants.map((person) =>
    canSee(person.side, side) ? person : { ...person, notes: '', lenses: [] },
  )
  const ours = new Map(
    room.participants.filter((person) => canSee(person.side, side)).map((person) => [person.id, person]),
  )
  const questions = new Map(room.openQuestions.map((question) => [question.id, question]))
  const asks = room.asks
    .filter((ask) => ask.status === 'open' && ours.has(ask.addressedTo))
    .map((ask) => {
      const question = ask.questionId ? questions.get(ask.questionId) : undefined
      return {
        ask,
        to: ours.get(ask.addressedTo)!,
        priority: (question?.priority as QuestionPriority | undefined) ?? null,
        area: question?.area ?? null,
      }
    })
    .sort(byUrgency)

  const questionCounts = Object.fromEntries(QUESTION_PRIORITIES.map((priority) => [priority, 0])) as Record<
    QuestionPriority,
    number
  >
  for (const question of room.openQuestions) questionCounts[question.priority as QuestionPriority] += 1

  const facts = visibleFacts(room.facts, side)
  const watermarks = Object.values(room.latestRuns).map((run) => run?.watermark ?? 0)
  const read = watermarks.length ? Math.min(...watermarks) : 0
  const checkedUpTo = facts.filter((fact) => fact.id <= read).at(-1)?.id ?? 0

  return { project: room.project, side, participants, facts, asks, questionCounts, checkedUpTo }
}
