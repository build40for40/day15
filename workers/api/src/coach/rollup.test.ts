// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fixtureRoom, memoryRoom } from '../testing'
import { rollup } from './rollup'

describe('rollup', () => {
  it('stands each area at its most urgent open question, aligned or unknown when nothing is open', async () => {
    const { room } = await fixtureRoom()
    await room.setQuestionPriorities([{ id: 1, priority: 2 }])
    const { areas } = rollup((await room.read())!)
    expect(Object.fromEntries(areas.map(({ area, standing }) => [area, standing]))).toEqual({
      goal_and_success: 'unknown',
      scope: 'unknown',
      dependencies_and_ownership: 'unknown',
      budget: 'high',
      timeline: 'aligned',
      ways_of_working: 'aligned',
      procurement_and_contract: 'aligned',
    })
    expect(areas[3]!.questions.map((question) => question.id)).toEqual([2, 1])
  })

  it('works out health from the rollup with the matrix weights, red while scope or goal is high', async () => {
    const { room } = await fixtureRoom()
    expect(rollup((await room.read())!).health).toEqual({ score: 74, band: 'amber' })
    await room.raiseQuestions([{ area: 'scope', statement: 'What done means.', askSide: 'both', priority: 1 }], 1)
    expect(rollup((await room.read())!).health!.band).toBe('red')
  })

  it('has no health reading until both sides have said something', async () => {
    const room = memoryRoom()
    await room.create({ id: 'p', name: 'Quiet', ownerId: 'o' })
    const { participant } = await room.addParticipant({ name: 'Fake Person', persona: 'cfo', side: 'client' })
    await room.addItem(participant.id, 'Budget is £10k.')
    expect(rollup((await room.read())!).health).toBeNull()
  })
})
