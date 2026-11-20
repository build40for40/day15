import { describe, expect, it } from 'vitest'

import { currentLens, currentLenses, storedIds } from './lenses'

describe('lenses', () => {
  it('reads the retired CFO and delivery ids as the procurement lens', () => {
    expect(['cfo', 'cto', 'procurement', 'client', 'agency', 'coach'].map(currentLens)).toEqual([
      'procurement',
      'procurement',
      'procurement',
      'client',
      'agency',
      null,
    ])
  })

  it('folds an old list into the three lenses, each once', () => {
    expect(currentLenses(['cfo', 'agency', 'cto', 'procurement'])).toEqual(['agency', 'procurement'])
  })

  it('knows every id a lens may have stored', () => {
    expect(storedIds('procurement')).toEqual(['procurement', 'cfo', 'cto'])
    expect(storedIds('client')).toEqual(['client'])
  })
})
