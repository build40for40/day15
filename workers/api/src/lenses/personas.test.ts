// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { LENS_IDS } from '@day15/shared/lenses'
import { fillSlots, PERSONAS, WRAPPER } from './personas'

describe('persona files', () => {
  it('loads an Actor, Instructions and Mission for every lens', () => {
    for (const lens of LENS_IDS) {
      for (const part of ['## Actor', '## Instructions', '## Mission']) expect(PERSONAS[lens]).toContain(part)
    }
    expect(PERSONAS.procurement).toContain('# Procurement persona harness')
  })

  it('fills the slots it has values for and leaves the rest', () => {
    expect(WRAPPER).toContain('{{persona}}')
    expect(fillSlots('{{a}} and {{b}}', { a: 'one' })).toBe('one and {{b}}')
  })
})
