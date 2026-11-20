import { generateText, Output, type SystemModelMessage } from 'ai'
import type { z } from 'zod'

import { fullMatrix, health, type AreaRating } from '@day15/shared/alignment'
import {
  SIDES,
  type Ask,
  type Fact,
  type NewParticipant,
  type NewPersonFact,
  type Participant,
  type RoomSnapshot,
} from '@day15/shared/schema'
import type { CoachReply, CoachTurn, Env, OpeningBrief, OpeningBriefFn, RoomStub } from '../contracts'
import { anthropicModel, logModelError, ModelUnavailableError, PROVIDER_OPTIONS } from '../model'
import { withFirstVisit } from './first-visit'
import { composeReply, planNextAsk, planTurn, type NextAskPlan } from './plan'
import { coachInstructions, openingPrompt, turnPrompt } from './prompt'
import { coachTurnOutputSchema, openingOutputSchema } from './schema'
import { askCandidates } from './select'

/** A coach call that went wrong. The message is safe to show. */
export class CoachError extends Error {
  override name = 'CoachError'
}

export interface ModelCall<T> {
  instructions: SystemModelMessage[]
  prompt: string
  schema: z.ZodType<T>
  name: string
}

/** One structured model call. Injected so tests run without a key. */
export type Generate = <T>(call: ModelCall<T>) => Promise<T>

export function anthropicGenerate(env: Env): Generate {
  return async <T>(call: ModelCall<T>) => {
    const { output } = await generateText({
      model: anthropicModel(env),
      instructions: call.instructions,
      prompt: call.prompt,
      output: Output.object({ schema: call.schema, name: call.name }),
      providerOptions: PROVIDER_OPTIONS,
    })
    return output as T
  }
}

async function ask<T>(generate: Generate, where: string, call: ModelCall<T>, failure: string): Promise<T> {
  try {
    return await generate(call)
  } catch (error) {
    if (error instanceof ModelUnavailableError) throw error
    logModelError(where, error)
    throw new CoachError(failure)
  }
}

async function readRoom(room: RoomStub): Promise<RoomSnapshot> {
  const snapshot = await room.read()
  if (!snapshot) throw new CoachError('There is no project here.')
  return snapshot
}

/** Writes the batch in one go, or one by one when the room refuses it, so one bad fact doesn't lose the rest. */
async function writeFacts(room: RoomStub, facts: NewPersonFact[]): Promise<Fact[]> {
  if (!facts.length) return []
  try {
    return await room.addFacts(facts)
  } catch {
    const written: Fact[] = []
    for (const fact of facts) {
      try {
        written.push(...(await room.addFacts([fact])))
      } catch (error) {
        console.error('Coach fact write failed:', error instanceof Error ? error.name : 'Unknown error')
      }
    }
    return written
  }
}

/** A person the room refuses is not worth losing the turn over. */
async function writePeople(room: RoomStub, people: NewParticipant[]): Promise<Participant[]> {
  if (!people.length) return []
  try {
    return await room.addMentioned(people)
  } catch (error) {
    console.error('Coach people write failed:', error instanceof Error ? error.name : 'Unknown error')
    return []
  }
}

async function writeNextAsk(room: RoomStub, participant: Participant, plan: NextAskPlan) {
  const closed: Ask[] = []
  for (const id of plan.dropped) {
    const dropped = await room.closeAsk(id, { status: 'dropped' })
    if (dropped?.status === 'dropped') closed.push(dropped)
  }
  let next: Ask | null = null
  if (plan.ask) next = await room.addAsk(plan.ask)
  else if (plan.keep) {
    next = (await room.asks({ addressedTo: participant.id, status: 'open' })).find((ask) => ask.id === plan.keep) ?? null
  }
  return { closed, next }
}

/** Keeps the mother agent's matrix and works out the health reading. Losing it never loses the turn. */
async function saveAssessment(room: RoomStub, snapshot: RoomSnapshot, itemId: number, ratings: AreaRating[] | undefined) {
  if (!ratings?.length) return
  const spoken = new Set(
    snapshot.items.map((item) => snapshot.participants.find((person) => person.id === item.participantId)?.side),
  )
  const areas = fullMatrix(ratings)
  try {
    await room.saveAssessment({ itemId, areas, health: health(areas, SIDES.every((side) => spoken.has(side))) })
  } catch (error) {
    console.error('Coach assessment write failed:', error instanceof Error ? error.name : 'Unknown error')
  }
}

export async function runCoachTurn(
  generate: Generate,
  room: RoomStub,
  participant: Participant,
  message: string,
): Promise<CoachReply> {
  const item = await room.addItem(participant.id, message)
  const snapshot = await readRoom(room)
  const candidates = askCandidates(snapshot, participant)
  const previous = await room.assessment()

  const output = await ask(
    generate,
    'Coach turn',
    {
      instructions: coachInstructions(snapshot),
      prompt: turnPrompt(snapshot, participant, item, candidates, previous),
      schema: coachTurnOutputSchema,
      name: 'coach_turn',
    },
    'The coach lost its thread. What you said is saved, so try again in a moment.',
  )

  const plan = planTurn(output, { room: snapshot, participant, item, candidates })
  const noted = await writeFacts(room, plan.facts)
  const people = await writePeople(room, plan.people)
  const closed: Ask[] = []
  for (const id of plan.answered) {
    const answered = await room.closeAsk(id, { status: 'answered', answeredBy: item.id })
    if (answered?.answeredBy === item.id) closed.push(answered)
  }
  const next = await writeNextAsk(room, participant, plan)
  await saveAssessment(room, snapshot, item.id, output.alignment)

  return {
    reply: composeReply(plan.noted, plan.text, plan.explain),
    itemId: item.id,
    noted,
    people,
    closed: [...closed, ...next.closed],
    ask: next.next,
  }
}

export async function runOpeningBrief(generate: Generate, room: RoomStub, participant: Participant): Promise<OpeningBrief> {
  const snapshot = await readRoom(room)
  const candidates = askCandidates(snapshot, participant)

  const output = await ask(
    generate,
    'Coach opening',
    {
      instructions: coachInstructions(snapshot),
      prompt: openingPrompt(snapshot, participant, candidates),
      schema: openingOutputSchema,
      name: 'coach_opening',
    },
    'The coach lost its thread. Try opening the room again in a moment.',
  )

  const plan = planNextAsk(output.next_ask, { room: snapshot, participant, candidates, answered: [] })
  const { next } = await writeNextAsk(room, participant, plan)
  return { reply: withFirstVisit(snapshot, participant, composeReply(output.reply, plan.text, plan.explain)), ask: next }
}

export const coachTurn: CoachTurn = (env, room, participant, message) =>
  runCoachTurn(anthropicGenerate(env), room, participant, message)

export const openingBrief: OpeningBriefFn = (env, room, participant) =>
  runOpeningBrief(anthropicGenerate(env), room, participant)
