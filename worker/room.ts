import { MAX_TURNS, OTHER_SIDE, type MySide, type Party, type Side, type Turn } from '../src/coach/schema'

/** Everything captured for one project: each side's own description and its answers. */
export interface Room {
  sides: Partial<Record<Party, Side>>
}

export const emptyRoom = (): Room => ({ sides: {} })

/** Adds what a side just said. Its first description sticks, and turns stop at the limit. */
export function record(room: Room, party: Party, project: string, turn?: Turn): Room {
  const side = room.sides[party] ?? { project, turns: [] }
  const turns = turn && side.turns.length < MAX_TURNS ? [...side.turns, turn] : side.turns
  return { sides: { ...room.sides, [party]: { ...side, turns } } }
}

/** A side's own half, plus only whether the other side has turned up. */
export function mySide(room: Room, party: Party): MySide {
  const side = room.sides[party] ?? { project: '', turns: [] }
  return { ...side, otherSideStarted: Boolean(room.sides[OTHER_SIDE[party]]) }
}
