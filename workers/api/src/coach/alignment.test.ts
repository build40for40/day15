// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fullMatrix, health, type AreaRating } from '@day15/shared/alignment'

const biscuitShop: AreaRating[] = [
  { area: 'goal_and_success', rating: 'medium', misalignment: 'Orders against a site.' },
  { area: 'scope', rating: 'high', misalignment: 'Photos and copy.' },
  { area: 'budget', rating: 'high', misalignment: 'What 60k covers.' },
  { area: 'timeline', rating: 'low', misalignment: '' },
  { area: 'ways_of_working', rating: 'high', misalignment: 'Feedback rounds.' },
]

describe('alignment', () => {
  it('rates an area nobody mentioned as low, and keeps the priority order', () => {
    const matrix = fullMatrix(biscuitShop)
    expect(matrix.map((row) => row.area)[2]).toBe('dependencies_and_ownership')
    expect(matrix[2]!.rating).toBe('low')
    expect(matrix).toHaveLength(7)
  })

  it('scores the made-up biscuit shop at 37, red', () => {
    expect(health(biscuitShop, true)).toEqual({ score: 37, band: 'red' })
  })

  it('gives no reading until both sides have spoken', () => {
    expect(health(biscuitShop, false)).toBeNull()
    expect(health([], false)).toBeNull()
  })

  it('is red whenever goal or scope is high, whatever the number', () => {
    const onlyScope: AreaRating[] = [
      { area: 'scope', rating: 'high', misalignment: 'Different lists.' },
      ...(['goal_and_success', 'dependencies_and_ownership', 'budget', 'timeline', 'ways_of_working', 'procurement_and_contract'] as const).map(
        (area) => ({ area, rating: 'aligned' as const, misalignment: '' }),
      ),
    ]
    expect(health(onlyScope, true)).toEqual({ score: 81, band: 'red' })
  })

  it('reads amber and green from the score otherwise', () => {
    const all = (rating: AreaRating['rating']) => fullMatrix([]).map((row) => ({ ...row, rating }))
    expect(health(all('aligned'), true)).toEqual({ score: 100, band: 'green' })
    expect(health(all('low'), true)).toEqual({ score: 80, band: 'green' })
    expect(health(all('medium'), true)).toEqual({ score: 50, band: 'amber' })
  })
})
