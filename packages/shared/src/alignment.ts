import { z } from 'zod'

/**
 * The mother agent's priority matrix, from `persona-harnesses/mother-agent.md`: the areas two sides need to be
 * aligned on, most important first, with how much each weighs in the health reading.
 */
export const ALIGNMENT_AREAS = [
  { id: 'goal_and_success', name: 'Goal and success', weight: 5 },
  { id: 'scope', name: 'Scope', weight: 5 },
  { id: 'dependencies_and_ownership', name: 'Dependencies and ownership', weight: 4 },
  { id: 'budget', name: 'Budget', weight: 4 },
  { id: 'timeline', name: 'Timeline', weight: 3 },
  { id: 'ways_of_working', name: 'Ways of working', weight: 3 },
  { id: 'procurement_and_contract', name: 'Procurement and contract', weight: 2 },
] as const

export type AlignmentAreaId = (typeof ALIGNMENT_AREAS)[number]['id']
const AREA_IDS = ALIGNMENT_AREAS.map((area) => area.id) as [AlignmentAreaId, ...AlignmentAreaId[]]

export const ALIGNMENT_RATINGS = ['high', 'medium', 'low', 'aligned'] as const
export type AlignmentRating = (typeof ALIGNMENT_RATINGS)[number]

/** What a rating costs, as a share of the area's weight. An area nobody has spoken about is rated low. */
const COST: Record<AlignmentRating, number> = { high: 1, medium: 0.5, low: 0.2, aligned: 0 }

/** Areas where a high rating makes the project red whatever the number says. */
const DECISIVE: AlignmentAreaId[] = ['goal_and_success', 'scope']

export const areaRatingSchema = z.object({
  area: z.enum(AREA_IDS),
  rating: z.enum(ALIGNMENT_RATINGS),
  misalignment: z.string(),
})
export type AreaRating = z.infer<typeof areaRatingSchema>

export const healthSchema = z.object({
  score: z.number().int().min(0).max(100),
  band: z.enum(['green', 'amber', 'red']),
})
export type Health = z.infer<typeof healthSchema>

/** One full matrix: a rating for every area, in priority order. Areas the model left out count as low. */
export function fullMatrix(ratings: AreaRating[]): AreaRating[] {
  return ALIGNMENT_AREAS.map(
    (area) =>
      ratings.find((rating) => rating.area === area.id) ?? { area: area.id, rating: 'low', misalignment: '' },
  )
}

/**
 * The overall health reading, or null when there is none yet: until both sides have said something, a project is
 * unread, not healthy.
 */
export function health(ratings: AreaRating[], bothSidesHaveSpoken: boolean): Health | null {
  if (!bothSidesHaveSpoken) return null
  const matrix = fullMatrix(ratings)
  const total = ALIGNMENT_AREAS.reduce((sum, area) => sum + area.weight, 0)
  const cost = ALIGNMENT_AREAS.reduce((sum, area, index) => sum + area.weight * COST[matrix[index]!.rating], 0)
  const score = Math.round(100 * (1 - cost / total))
  const decisive = matrix.some((rating) => rating.rating === 'high' && DECISIVE.includes(rating.area))
  return { score, band: decisive || score < 50 ? 'red' : score < 75 ? 'amber' : 'green' }
}

/** The mother agent's internal view after a turn. It is never shown to either side. */
export const assessmentSchema = z.object({
  /** The item (what a person said) this was made after. */
  itemId: z.number().int(),
  areas: z.array(areaRatingSchema),
  health: healthSchema.nullable(),
})
export type Assessment = z.infer<typeof assessmentSchema>
