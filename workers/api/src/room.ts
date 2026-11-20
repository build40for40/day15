import { MAX_TURNS, OTHER_SIDE, type BrainReply, type MySide, type Party, type Turn } from '@day15/shared/schema'

/** A question the coach has asked and is waiting on, with the brain's private reasoning. */
export type Pending = Pick<BrainReply, 'lens' | 'question' | 'rationale'>

export interface RoomSide {
  project: string
  turns: (Turn & { rationale?: string })[]
  pending?: Pending
}

/** Everything captured for one project: each side's own description and its answers. */
export interface Room {
  sides: Partial<Record<Party, RoomSide>>
}

export const emptyRoom = (): Room => ({ sides: {} })

/** Adds what a side just said. Its first description sticks, and turns stop at the limit. */
export function record(room: Room, party: Party, project: string, turn?: Turn): Room {
  const { pending, ...side } = room.sides[party] ?? { project, turns: [] }
  if (!turn || side.turns.length >= MAX_TURNS) return { sides: { ...room.sides, [party]: { ...side, pending } } }
  // The answer closes the question that was waiting, and takes its reasoning with it.
  const rationale = pending?.question === turn.question ? pending.rationale : undefined
  return { sides: { ...room.sides, [party]: { ...side, turns: [...side.turns, { ...turn, rationale }] } } }
}

/** Notes the question a side is now looking at. */
export function pend(room: Room, party: Party, pending: Pending): Room {
  const side = room.sides[party]
  return side ? { sides: { ...room.sides, [party]: { ...side, pending } } } : room
}

/** A side's own half, plus only whether the other side has turned up. No reasoning: it can give the other side away. */
export function mySide(room: Room, party: Party): MySide {
  const side = room.sides[party]
  return {
    project: side?.project ?? '',
    turns: (side?.turns ?? []).map(({ lens, question, answer }) => ({ lens, question, answer })),
    otherSideStarted: Boolean(room.sides[OTHER_SIDE[party]]),
  }
}
