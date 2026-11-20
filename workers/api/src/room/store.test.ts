// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fixtureRoom, memoryRoom } from '../testing'
import { FIXTURE_PROJECT } from './fixture'

describe('RoomStore', () => {
  it('hands out a secret once and knows the person by it afterwards', async () => {
    const room = memoryRoom()
    await room.create({ id: 'project-1', name: 'Fake', ownerId: 'user_fake' })
    const { participant, secret } = await room.addParticipant({ name: 'Alex Example', persona: 'cfo', side: 'agency' })
    expect(await room.identify(secret)).toEqual(participant)
    expect(await room.identify(`${secret}x`)).toBeNull()
    expect(JSON.stringify(await room.read())).not.toContain(secret)

    const reset = await room.resetKey(participant.id)
    expect(await room.identify(secret)).toBeNull()
    expect(await room.identify(reset!.secret)).toEqual(participant)
  })

  it('refuses people and items until the project exists, and knows nobody', async () => {
    const room = memoryRoom()
    await expect(room.addParticipant({ name: 'Alex Example', persona: 'cfo', side: 'agency' })).rejects.toThrow('no project')
    expect(await room.identify('anything')).toBeNull()
    expect(await room.read()).toBeNull()
  })

  it('keeps none of a batch of facts when one is bad', async () => {
    const { room, people, items } = await fixtureRoom()
    const before = (await room.read())!.facts.length
    const good = {
      authorKind: 'person' as const,
      participantId: people.casey.participant.id,
      sourceItemId: items[0]!.id,
      sourceQuote: 'five levels',
      status: 'confirmed' as const,
      topic: 'deliverables' as const,
      statement: 'Five levels.',
    }
    await expect(room.addFacts([good, { ...good, sourceItemId: 999 }])).rejects.toThrow('i999')
    expect((await room.read())!.facts).toHaveLength(before)
  })

  it('loads the fixture with its misalignments', async () => {
    const { room, facts } = await fixtureRoom()
    const snapshot = (await room.read())!
    expect(snapshot.project.id).toBe(FIXTURE_PROJECT.id)
    expect(snapshot.participants.map((person) => person.side)).toEqual(['agency', 'agency', 'client', 'client', 'client'])
    expect(facts.monthlyBoard!.id).toBe(facts.fortnightlyBoard!.supersedes)
    expect(snapshot.facts.find((fact) => fact.id === facts.monthlyBoard!.id)!.status).toBe('superseded')
    expect(snapshot.facts.at(-1)).toMatchObject({ authorKind: 'lens', lens: 'cfo', topic: 'budget' })
    expect(snapshot.watermark).toBe(facts.budgetGap!.id)
    expect(snapshot.latestRuns.cfo!.report!.conflicts[0]!.severity).toBe('fundamental')
    expect(snapshot.asks.filter((ask) => ask.status === 'open')).toHaveLength(1)
  })
})
