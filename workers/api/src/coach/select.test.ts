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
  it('puts the fundamental conflict first, then the priority 1 gap for this side', async () => {
    const { room, people } = await fixtureRoom()
    const candidates = askCandidates((await room.read())!, people.robin.participant)
    expect(candidates[0]).toMatchObject({ kind: 'conflict', questionId: 1, priority: 1, lens: 'cfo', topic: 'What the price covers' })
    expect(candidates[1]).toMatchObject({ kind: 'gap', questionId: 2, priority: 1, lens: 'cfo' })
  })

  it('orders open questions by priority, conflicts before gaps, then oldest, keeping only this side and routed lenses', async () => {
    const { room, people } = await fixtureRoom()
    const gap = (ask: 'agency' | 'client', find_out: string, priority: number) => ({ ask, find_out, because: 'b', priority })
    const lensRun = (lens: 'agency' | 'client' | 'procurement' | 'cto', overrides: Partial<LensReport>) =>
      room.saveLensRun({ lens, round: 1, watermark: 1, status: 'done', report: report(overrides) })
    await lensRun('agency', {
      questions: [gap('agency', 'how many feedback rounds the team can absorb', 2)],
      conflicts: [{ topic: 'Feedback rounds', agency_said: 'a', client_said: 'b', severity: 'workable', note: 'n' }],
    })
    await lensRun('procurement', { questions: [gap('agency', 'the engine licence terms', 1)] })
    await lensRun('client', { questions: [gap('client', 'the launch date', 1)] })
    await lensRun('cto', { questions: [gap('agency', 'the first demo week', 1)] })
    const open = askCandidates((await room.read())!, people.alex.participant).filter((c) => c.kind !== 'missing_topic')
    expect(open.map((c) => [c.kind, c.lens, c.priority])).toEqual([
      ['conflict', 'cfo', 1],
      ['gap', 'procurement', 1],
      ['conflict', 'agency', 2],
      ['gap', 'agency', 2],
    ])
  })

  it('breaks a priority tie by the area rank before conflicts come before gaps', async () => {
    const { room, people } = await fixtureRoom()
    await room.saveLensRun({
      lens: 'cfo',
      round: 2,
      watermark: 1,
      status: 'done',
      report: report({
        questions: [{ ask: 'client', find_out: 'what success looks like a year on', because: 'b', priority: 1, area: 'goal_and_success' }],
      }),
    })
    const open = askCandidates((await room.read())!, people.robin.participant).filter((c) => c.kind !== 'missing_topic')
    expect(open.map((c) => [c.kind, c.area, c.priority])).toEqual([
      ['gap', 'goal_and_success', 1],
      ['conflict', 'budget', 1],
      ['gap', 'budget', 1],
    ])
  })

  it('routes a lens to the people on a side who speak for it, and to anyone there when nobody does', async () => {
    const { room, people } = await fixtureRoom()
    const snapshot = (await room.read())!
    const conflictFor = (person: keyof typeof people) =>
      askCandidates(snapshot, people[person].participant).some((c) => c.kind === 'conflict')
    expect(conflictFor('robin')).toBe(true)
    expect(conflictFor('alex')).toBe(true)
    expect(conflictFor('casey')).toBe(false)
    expect(conflictFor('dana')).toBe(false)

    const delivery = askCandidates(snapshot, people.casey.participant).find((c) => c.lens === 'cto')
    expect(delivery).toMatchObject({ kind: 'missing_topic', unowned: true })
    expect(askCandidates(snapshot, people.robin.participant).find((c) => c.lens === 'cfo')?.unowned).toBe(false)
  })

  it('falls back to brief topics nobody on this side has covered, in the order of their areas', async () => {
    const room = memoryRoom()
    await room.create({ id: 'p', name: 'Empty', ownerId: 'o' })
    const { participant } = await room.addParticipant({ name: 'Fake Person', persona: 'cfo', side: 'client' })
    const candidates = askCandidates((await room.read())!, participant)
    expect(candidates.every((c) => c.kind === 'missing_topic')).toBe(true)
    expect(candidates.map((c) => c.topic)).toEqual([
      'background',
      'objective',
      'audience',
      'insight',
      'kpis',
      'deliverables',
      'budget',
      'timeline',
      'sign_off',
      'legal_ip',
    ])
    expect(candidates[6]).toMatchObject({ lens: 'cfo', question: 'What do you understand the budget to cover?' })
  })

  it('has nothing to ask once every lens says it is done', async () => {
    const { room, people } = await fixtureRoom()
    for (const lens of LENS_IDS) {
      await room.saveLensRun({ lens, round: 2, watermark: 1, status: 'done', report: report({ done: true }) })
    }
    expect(askCandidates((await room.read())!, people.alex.participant)).toEqual([])
  })
})
