import { z } from 'zod'

import { ALIGNMENT_AREAS, type AlignmentAreaId } from './alignment'
import type { LensId } from './lenses'
import type { Topic } from './schema'

export const alignmentAreaSchema = z.enum(
  ALIGNMENT_AREAS.map((area) => area.id) as [AlignmentAreaId, ...AlignmentAreaId[]],
)

/** 0 for goal and success, the most important area, up to 6 for procurement and contract. */
export const areaRank = (area: AlignmentAreaId) => ALIGNMENT_AREAS.findIndex((entry) => entry.id === area)

export const areaName = (area: AlignmentAreaId) => ALIGNMENT_AREAS[areaRank(area)]!.name

/**
 * The area a fact topic belongs to, for an open question whose lens gave no area. Dependencies and ownership has
 * no topic of its own, so only a lens that says so puts a question there.
 */
export const TOPIC_AREA: Record<Topic, AlignmentAreaId> = {
  background: 'goal_and_success',
  objective: 'goal_and_success',
  audience: 'goal_and_success',
  insight: 'goal_and_success',
  kpis: 'goal_and_success',
  budget: 'budget',
  deliverables: 'scope',
  timeline: 'timeline',
  sign_off: 'ways_of_working',
  legal_ip: 'procurement_and_contract',
  other: 'scope',
}

/** The area a lens mostly speaks to, for when neither the lens nor the facts it cites give one. */
export const LENS_AREA: Record<LensId, AlignmentAreaId> = {
  client: 'goal_and_success',
  agency: 'ways_of_working',
  cto: 'scope',
  cfo: 'budget',
  procurement: 'procurement_and_contract',
}
