import { toPriority } from '@day15/shared/priorities'
import { parseRef } from '@day15/shared/refs'
import {
  MAX_JOB_TITLE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_ORGANISATION_LENGTH,
  MAX_QUOTE_LENGTH,
  MAX_STATEMENT_LENGTH,
  type Ask,
  type Fact,
  type Item,
  type NewAsk,
  type NewParticipant,
  type NewPersonFact,
  type Participant,
  type RoomSnapshot,
} from '@day15/shared/schema'
import type { CoachTurnOutput, NextAskOutput } from './schema'
import type { AskCandidate } from './select'

/** Everything one coach call wants written to the room. */
export interface NextAskPlan {
  /** An open ask of this person's that stays as their next ask. */
  keep: number | null
  /** A new ask to add for this person. */
  ask: NewAsk | null
  /** Their other open asks, closed because the next ask replaces them. */
  dropped: number[]
  /** The question the person reads. */
  text: string | null
}

export interface TurnPlan extends NextAskPlan {
  facts: NewPersonFact[]
  answered: number[]
  /** Open questions this message settles. */
  resolvedQuestions: number[]
  /** Open questions the coach moved to a new priority. */
  priorities: { id: number; priority: number }[]
  /** People named in the message, to add with no link. The room skips anyone already listed. */
  people: NewParticipant[]
  noted: string
}

interface PlanContext {
  room: RoomSnapshot
  participant: Participant
  candidates: AskCandidate[]
}

export function clip(text: string, max: number): string {
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed
}

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'.,]+|[\s"'.,]+$/g, '')

/** The model's quote when it really is in the message, otherwise the message itself, so every fact keeps real words. */
export function sourceQuote(quote: string, message: string): string {
  const wanted = normalise(quote)
  return wanted && normalise(message).includes(wanted) ? clip(quote, MAX_QUOTE_LENGTH) : clip(message, MAX_QUOTE_LENGTH)
}

/** A person may replace or confirm only their own facts or a lens's proposals, and each fact only once. */
function replaceable(fact: Fact | undefined, participant: Participant, taken: Set<number>): fact is Fact {
  return (
    !!fact &&
    fact.status !== 'superseded' &&
    !taken.has(fact.id) &&
    (fact.authorKind === 'lens' || fact.participantId === participant.id)
  )
}

/** The facts to write from one message: new ones, corrections and confirmations of proposals. */
export function planFacts(output: CoachTurnOutput, context: PlanContext & { item: Item }): NewPersonFact[] {
  const { room, participant, item } = context
  const byId = new Map(room.facts.map((fact) => [fact.id, fact]))
  const taken = new Set<number>()
  const facts: NewPersonFact[] = []
  const base = { authorKind: 'person' as const, participantId: participant.id, sourceItemId: item.id }

  for (const note of output.facts) {
    const statement = clip(note.statement, MAX_STATEMENT_LENGTH)
    if (!statement) continue
    const replacesId = note.replaces ? parseRef('fact', note.replaces) : null
    const target = replacesId ? byId.get(replacesId) : undefined
    const supersedes = replaceable(target, participant, taken) ? target.id : undefined
    if (supersedes) taken.add(supersedes)
    facts.push({
      ...base,
      topic: note.topic,
      statement,
      sourceQuote: sourceQuote(note.quote, item.text),
      status: note.tentative ? 'proposed' : 'confirmed',
      ...(supersedes ? { supersedes } : {}),
    })
  }

  for (const confirmation of output.confirmed) {
    const id = parseRef('fact', confirmation.fact)
    const target = id ? byId.get(id) : undefined
    if (!replaceable(target, participant, taken) || target.status !== 'proposed') continue
    taken.add(target.id)
    facts.push({
      ...base,
      topic: target.topic,
      statement: target.statement,
      sourceQuote: sourceQuote(confirmation.quote, item.text),
      status: 'confirmed',
      supersedes: target.id,
      ...(target.basedOn.length ? { basedOn: target.basedOn } : {}),
    })
  }
  return facts
}

/** People the message named, cleaned up, on the speaker's side unless the model was sure of the other. */
export function planPeople(output: CoachTurnOutput, participant: Participant): NewParticipant[] {
  return (output.people_mentioned ?? []).flatMap((person) => {
    const name = clip(person.name, MAX_NAME_LENGTH)
    if (!name) return []
    return [
      {
        name,
        persona: person.persona,
        side: person.side ?? participant.side,
        jobTitle: clip(person.job_title, MAX_JOB_TITLE_LENGTH),
        organisation: clip(person.organisation, MAX_ORGANISATION_LENGTH),
        notes: clip(person.notes, MAX_NOTES_LENGTH),
      },
    ]
  })
}

/** Open asks anywhere in the room that this message answered. */
export function planAnswered(output: CoachTurnOutput, room: RoomSnapshot): number[] {
  const open = new Set(room.asks.filter((ask) => ask.status === 'open').map((ask) => ask.id))
  const answered = output.answered_asks.map((value) => parseRef('ask', value)).filter((id) => id !== null && open.has(id))
  return [...new Set(answered as number[])]
}

const openQuestionIds = (room: RoomSnapshot) => new Set(room.openQuestions.map((question) => question.id))

/** Open questions the model says this message settles. */
export function planResolvedQuestions(output: CoachTurnOutput, room: RoomSnapshot): number[] {
  const open = openQuestionIds(room)
  const ids = (output.resolved_questions ?? []).map((value) => parseRef('question', value))
  return [...new Set(ids)].filter((id): id is number => id !== null && open.has(id))
}

/** New priorities for open questions, one per question, the last one winning. */
export function planPriorities(output: CoachTurnOutput, room: RoomSnapshot, resolved: number[]): { id: number; priority: number }[] {
  const open = openQuestionIds(room)
  const changes = new Map<number, number>()
  for (const change of output.reprioritise ?? []) {
    const id = parseRef('question', change.question)
    if (id !== null && open.has(id) && !resolved.includes(id)) changes.set(id, toPriority(change.priority))
  }
  return [...changes].map(([id, priority]) => ({ id, priority }))
}

/**
 * Leaves this person exactly one open ask: the one the model chose, or one of theirs it asked again. When the model
 * asks nothing, their oldest open ask stays, and failing that the best candidate becomes the ask.
 */
export function planNextAsk(next: NextAskOutput | null, context: PlanContext & { answered: number[] }): NextAskPlan {
  const { room, participant, candidates, answered } = context
  const chasing = next?.question ? parseRef('question', next.question) : null
  const questionId = chasing !== null && openQuestionIds(room).has(chasing) ? chasing : null
  const open: Ask[] = room.asks.filter(
    (ask) => ask.addressedTo === participant.id && ask.status === 'open' && !answered.includes(ask.id),
  )
  const others = (keep: number | null) => open.filter((ask) => ask.id !== keep).map((ask) => ask.id)
  const text = next ? clip(next.ask, MAX_STATEMENT_LENGTH) : ''

  if (next && text) {
    const sameId = next.same_as ? parseRef('ask', next.same_as) : null
    const same = open.find((ask) => ask.id === sameId)
    if (same) return { keep: same.id, ask: null, dropped: others(same.id), text }
    return {
      keep: null,
      ask: {
        addressedTo: participant.id,
        ask: text,
        because: clip(next.because, MAX_STATEMENT_LENGTH),
        lens: next.lens,
        questionId,
      },
      dropped: others(null),
      text,
    }
  }

  const oldest = open[0]
  if (oldest) return { keep: oldest.id, ask: null, dropped: others(oldest.id), text: oldest.ask }

  const best = candidates[0]
  if (!best) return { keep: null, ask: null, dropped: [], text: null }
  return {
    keep: null,
    ask: {
      addressedTo: participant.id,
      ask: clip(best.question, MAX_STATEMENT_LENGTH),
      because: clip(best.because, MAX_STATEMENT_LENGTH),
      lens: best.lens,
      questionId: best.questionId,
    },
    dropped: [],
    text: best.question,
  }
}

/** Everything one coach turn writes, worked out before anything is written. */
export function planTurn(output: CoachTurnOutput, context: PlanContext & { item: Item }): TurnPlan {
  const answered = planAnswered(output, context.room)
  const resolvedQuestions = planResolvedQuestions(output, context.room)
  return {
    facts: planFacts(output, context),
    answered,
    resolvedQuestions,
    priorities: planPriorities(output, context.room, resolvedQuestions),
    people: planPeople(output, context.participant),
    noted: output.noted.trim(),
    ...planNextAsk(output.next_ask, { ...context, answered }),
  }
}

/** What the person reads: what was noted, then the one question. */
export function composeReply(lead: string, question: string | null): string {
  return [lead.trim() || 'Got it, thanks.', question?.trim()].filter(Boolean).join('\n\n')
}
