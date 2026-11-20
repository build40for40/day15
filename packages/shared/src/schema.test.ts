import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { lensReportSchema, openQuestionSchema, upgradeStoredReport } from './schema'

describe('schema', () => {
  it('has one scale: no severity on a lens report or an open question', () => {
    const shapes = JSON.stringify([z.toJSONSchema(lensReportSchema), z.toJSONSchema(openQuestionSchema)])
    expect(shapes).not.toContain('severity')
    expect(shapes).not.toContain('alignment')
  })

  it('reads an old stored report, turning its severity word into a priority', () => {
    const stored = {
      coverage: [],
      conflicts: [{ topic: 'Price', agency_said: 'a', client_said: 'b', severity: 'workable', note: 'n' }],
      questions: [],
      done: false,
    }
    expect(lensReportSchema.parse(upgradeStoredReport(stored)).conflicts[0]).toEqual({
      topic: 'Price',
      agency_said: 'a',
      client_said: 'b',
      priority: 2,
      note: 'n',
    })
  })
})
