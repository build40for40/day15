import { describe, expect, it } from 'vitest'

import { ALIGNMENT_AREAS } from './alignment'
import { areaRank, LENS_AREA, TOPIC_AREA } from './areas'
import { TOPICS } from './schema'

describe('areas', () => {
  it('ranks the areas in the matrix order, goal and success first', () => {
    expect(ALIGNMENT_AREAS.map((area) => areaRank(area.id))).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('gives every topic an area, and leaves dependencies and ownership to the lenses', () => {
    expect(TOPICS.map((topic) => TOPIC_AREA[topic])).toEqual([
      'goal_and_success',
      'goal_and_success',
      'goal_and_success',
      'goal_and_success',
      'goal_and_success',
      'budget',
      'scope',
      'timeline',
      'ways_of_working',
      'procurement_and_contract',
      'scope',
    ])
    expect([...Object.values(TOPIC_AREA), ...Object.values(LENS_AREA)]).not.toContain('dependencies_and_ownership')
  })
})
