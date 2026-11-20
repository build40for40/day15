// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { coachTurnOutputSchema } from './schema'

describe('coachTurnOutputSchema', () => {
  it('has no matrix of its own: the coach acts through open questions', () => {
    const fields = Object.keys(z.toJSONSchema(coachTurnOutputSchema).properties ?? {})
    expect(fields).not.toContain('alignment')
    expect(fields).toEqual(expect.arrayContaining(['reprioritise', 'resolved_questions', 'raise_questions', 'privacy']))
  })
})
