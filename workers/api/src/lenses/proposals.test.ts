// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fixtureRoom } from '../testing'
import { MAX_PROPOSED_FACTS, toLensFacts } from './proposals'

describe('toLensFacts', () => {
  it('reads the short ids a lens cites and drops ids the room does not have', async () => {
    const { room, facts } = await fixtureRoom()
    const [fact] = toLensFacts(
      [{ topic: 'legal_ip', statement: 'Estimate: the IP terms clash.', based_on: [`f${facts.engine!.id}`, 'f999', 'nonsense'] }],
      7,
      (await room.read())!,
    )
    expect(fact).toEqual({
      authorKind: 'lens',
      lensRunId: 7,
      basedOn: [facts.engine!.id],
      topic: 'legal_ip',
      statement: 'Estimate: the IP terms clash.',
      supersedes: null,
    })
  })

  it('drops a fact with no basis, or one that repeats a fact that still holds', async () => {
    const { room, facts } = await fixtureRoom()
    const proposals = toLensFacts(
      [
        { topic: 'budget', statement: 'Unfounded.', based_on: ['f999'] },
        { topic: 'audience', statement: '  The game is for KIDS aged 6 to 10. ', based_on: [`f${facts.audience!.id}`] },
      ],
      7,
      (await room.read())!,
    )
    expect(proposals).toEqual([])
  })

  it('only replaces a standing lens fact, never what a person said', async () => {
    const { room, facts } = await fixtureRoom()
    const snapshot = (await room.read())!
    const basedOn = [`f${facts.wholeBudget!.id}`]
    const replacing = (supersedes: string) => toLensFacts([{ topic: 'budget', statement: 'New.', based_on: basedOn, supersedes }], 7, snapshot)
    expect(replacing(`f${facts.budgetGap!.id}`)[0]?.supersedes).toBe(facts.budgetGap!.id)
    expect(replacing(`f${facts.wholeBudget!.id}`)).toEqual([])
    expect(replacing(`f${facts.monthlyBoard!.id}`)).toEqual([])
  })

  it(`keeps at most ${MAX_PROPOSED_FACTS}`, async () => {
    const { room, facts } = await fixtureRoom()
    const many = Array.from({ length: 6 }, (_, index) => ({
      topic: 'other' as const,
      statement: `Thing ${index}`,
      based_on: [`f${facts.audience!.id}`],
    }))
    expect(toLensFacts(many, 7, (await room.read())!)).toHaveLength(MAX_PROPOSED_FACTS)
  })
})
