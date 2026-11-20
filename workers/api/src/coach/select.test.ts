// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { LensReport } from '@day15/shared/schema'
import { LENS_IDS } from '@day15/shared/lenses'
import { fixtureRoom, memoryRoom } from '../testing'
import { askCandidates } from './select'

const report = (overrides: Partial<LensReport> = {}): LensReport => ({
  coverage: [],
  conflicts: [],
  questions: [],
  done: false,
  ...overrides,
})

describe('askCandidates', () => {
  it('puts fundamental conflicts first, then priority 1 gaps for this side', async () => {
    const { room, people } = await fixtureRoom()
    const candidates = askCandidates((await room.read())!, people.robin.participant)
    expect(candidates[0]).toMatchObject({ kind: 'fundamental_conflict', lens: 'cfo', topic: 'What the price covers' })
    expect(candidates[1]).toMatchObject({ kind: 'priority_gap', lens: 'cfo' })
  })

  it('ranks workable conflicts above gaps, and this person’s own lens first within a tier', async () => {
    const { room, people } = await fixtureRoom()
    const workable = { agency_said: 'a', client_said: 'b', severity: 'workable' as const, note: 'n' }
    await room.saveLensRun({
      lens: 'procurement',
      round: 1,
      watermark: 1,
      status: 'done',
      report: report({ conflicts: [{ topic: 'Licences', ...workable }] }),
    })
    await room.saveLensRun({
      lens: 'client',
      round: 1,
      watermark: 1,
      status: 'done',
      report: report({
        conflicts: [{ topic: 'Launch date', ...workable }],
        questions: [{ ask: 'client', find_out: 'the launch date', because: 'b', priority: 1 }],
      }),
    })
    const kinds = askCandidates((await room.read())!, people.casey.participant).map((c) => [c.kind, c.lens])
    expect(kinds.slice(0, 5)).toEqual([
      ['fundamental_conflict', 'cfo'],
      ['workable_conflict', 'client'],
      ['workable_conflict', 'procurement'],
      ['priority_gap', 'client'],
      ['priority_gap', 'cfo'],
    ])
  })

  it('offers the lens this person has heard least from before the others', async () => {
    const { room, people } = await fixtureRoom()
    const casey = people.casey.participant
    await room.saveLensRun({
      lens: 'client',
      round: 1,
      watermark: 1,
      status: 'done',
      report: report({ questions: [{ ask: 'client', find_out: 'the KPI', because: 'b', priority: 2 }] }),
    })
    const leastHeard = askCandidates((await room.read())!, casey).filter((c) => c.kind === 'least_heard')
    expect(leastHeard.map((c) => c.lens)).toEqual(['cfo', 'client'])
  })

  it('falls back to brief topics nobody on this side has covered, own lens topics first', async () => {
    const room = memoryRoom()
    await room.create({ id: 'p', name: 'Empty', ownerId: 'o' })
    const { participant } = await room.addParticipant({ name: 'Fake Person', persona: 'cfo', side: 'client' })
    const candidates = askCandidates((await room.read())!, participant)
    expect(candidates.every((c) => c.kind === 'missing_topic')).toBe(true)
    expect(candidates[0]).toMatchObject({ topic: 'budget', lens: 'cfo', question: 'What do you understand the budget to cover?' })
    expect(candidates).toHaveLength(10)
  })

  it('has nothing to ask once every lens says it is done', async () => {
    const { room, people } = await fixtureRoom()
    for (const lens of LENS_IDS) {
      await room.saveLensRun({ lens, round: 2, watermark: 1, status: 'done', report: report({ done: true }) })
    }
    expect(askCandidates((await room.read())!, people.alex.participant)).toEqual([])
  })
})
