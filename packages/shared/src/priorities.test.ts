import { describe, expect, it } from 'vitest'

import { priorityLabel, toPriority } from './priorities'

describe('priorities', () => {
  it('maps 1, 2 and 3 to high, medium and low, with the number', () => {
    expect([1, 2, 3].map(priorityLabel)).toEqual(['high (1)', 'medium (2)', 'low (3)'])
  })

  it('lands any other number on the nearest level', () => {
    expect([0, -2, 2.4, 4, 9, Number.NaN].map(toPriority)).toEqual([1, 1, 2, 3, 3, 3])
  })
})
