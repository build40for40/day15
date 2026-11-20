import type { LensId } from '@day15/shared/lenses'
import {
  MAX_TURNS,
  OTHER_SIDE,
  type BrainReply,
  type MySide,
  type Party,
  type PersonaReport,
  type Turn,
} from '@day15/shared/schema'

/** A question the coach has asked and is waiting on, with the brain's private reasoning. */
export type Pending = Pick<BrainReply, 'lens' | 'question' | 'rationale'>

export interface RoomSide {
  project: string
  turns: (Turn & { rationale?: string })[]
  pending?: Pending
}

/** Everything captured for one project: each side's own description and its answers. */
export type Reports = Partial<Record<LensId, PersonaReport>>

export interface Room {
  sides: Partial<Record<Party, RoomSide>>
  /** The persona harnesses' latest reports, and the state of the room they were written for. */
  reports?: { version: string; byLens: Reports }
}

/** Changes whenever either side says something new, so stale reports are easy to spot. */
export function version(room: Room): string {
  const { agency, client } = room.sides
  return `${agency ? agency.turns.length : '-'}:${client ? client.turns.length : '-'}`
}

export function withReports(room: Room, byLens: Reports): Room {
  return { ...room, reports: { version: version(room), byLens } }
}

/** The reports, if they were written for the room as it is now. */
export const freshReports = (room: Room): Reports | undefined =>
  room.reports?.version === version(room) ? room.reports.byLens : undefined

export const emptyRoom = (): Room => ({ sides: {} })

/** Rooms saved when there were five personas: money, delivery and procurement are now all `ops`. */
const OLD_LENSES: Record<string, LensId> = { cfo: 'ops', cto: 'ops', procurement: 'ops' }
const current = (lens: string) => OLD_LENSES[lens] ?? (lens as LensId)

/** Brings a stored room up to date. Reports from the five-persona days are dropped and get written again. */
export function upgrade(room: Room): Room {
  const sides: Room['sides'] = {}
  for (const [party, side] of Object.entries(room.sides) as [Party, RoomSide][]) {
    sides[party] = {
      ...side,
      turns: side.turns.map((turn) => ({ ...turn, lens: current(turn.lens) })),
      pending: side.pending && { ...side.pending, lens: current(side.pending.lens) },
    }
  }
  const stale = room.reports && Object.keys(room.reports.byLens).some((lens) => lens in OLD_LENSES)
  return { sides, reports: stale ? undefined : room.reports }
}

/** Adds what a side just said. Its first description sticks, and turns stop at the limit. */
export function record(room: Room, party: Party, project: string, turn?: Turn): Room {
  const { pending, ...side } = room.sides[party] ?? { project, turns: [] }
  if (!turn || side.turns.length >= MAX_TURNS) return { ...room, sides: { ...room.sides, [party]: { ...side, pending } } }
  // The answer closes the question that was waiting, and takes its reasoning with it.
  const rationale = pending?.question === turn.question ? pending.rationale : undefined
  return { ...room, sides: { ...room.sides, [party]: { ...side, turns: [...side.turns, { ...turn, rationale }] } } }
}

/** Notes the question a side is now looking at. */
export function pend(room: Room, party: Party, pending: Pending): Room {
  const side = room.sides[party]
  return side ? { ...room, sides: { ...room.sides, [party]: { ...side, pending } } } : room
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
