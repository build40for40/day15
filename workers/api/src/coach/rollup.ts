import { ALIGNMENT_AREAS, health, type AlignmentAreaId, type Health } from '@day15/shared/alignment'
import { TOPIC_AREA } from '@day15/shared/areas'
import { PRIORITY_LABELS, toPriority } from '@day15/shared/priorities'
import { SIDES, type OpenQuestion, type RoomSnapshot } from '@day15/shared/schema'

/** An area's priority label, or `aligned` or `unknown` when nothing is open in it. */
export type AreaStanding = 'high' | 'medium' | 'low' | 'aligned' | 'unknown'

export interface AreaRollup {
  area: AlignmentAreaId
  standing: AreaStanding
  /** Its open questions, most urgent first. */
  questions: OpenQuestion[]
}

export interface Rollup {
  areas: AreaRollup[]
  /** Null until both sides have said something. */
  health: Health | null
}

/**
 * The matrix, worked out from the open questions rather than judged: an area stands at the priority of its most
 * urgent open question, is aligned when nothing is open and both sides have said something in it, and is unknown
 * otherwise. Health uses the matrix weights and rules, counting unknown as low.
 */
export function rollup(room: RoomSnapshot): Rollup {
  const said = (side: (typeof SIDES)[number]) =>
    new Set(
      room.facts
        .filter((fact) => fact.authorKind === 'person' && fact.side === side && fact.status !== 'superseded')
        .map((fact) => TOPIC_AREA[fact.topic]),
    )
  const spokeIn = SIDES.map(said)
  const areas = ALIGNMENT_AREAS.map(({ id }) => {
    const questions = room.openQuestions.filter((question) => question.area === id)
    let standing: AreaStanding
    if (questions.length) standing = PRIORITY_LABELS[toPriority(Math.min(...questions.map((q) => q.priority)))] as AreaStanding
    else standing = spokeIn.every((areas) => areas.has(id)) ? 'aligned' : 'unknown'
    return { area: id, standing, questions }
  })

  const sides = new Map(room.participants.map((person) => [person.id, person.side]))
  const spoken = new Set(room.items.map((item) => sides.get(item.participantId)))
  const ratings = areas.map(({ area, standing }) => ({
    area,
    rating: standing === 'unknown' ? ('low' as const) : standing,
    misalignment: '',
  }))
  return { areas, health: health(ratings, SIDES.every((side) => spoken.has(side))) }
}
