// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fixtureRoom, memoryRoom, memorySql } from '../testing'
import { FIXTURE_PROJECT } from './fixture'
import { RoomStore } from './store'

describe('RoomStore', () => {
  it('hands out a secret once and knows the person by it afterwards', async () => {
    const room = memoryRoom()
    await room.create({ id: 'project-1', name: 'Fake', ownerId: 'user_fake' })
    const { participant, secret } = await room.addParticipant({ name: 'Alex Example', persona: 'cfo', side: 'agency' })
    expect(await room.identify(secret!)).toEqual(participant)
    expect(await room.identify(`${secret}x`)).toBeNull()
    expect(JSON.stringify(await room.read())).not.toContain(secret)

    const reset = await room.resetKey(participant.id)
    expect(await room.identify(secret!)).toBeNull()
    expect(await room.identify(reset!.secret)).toEqual(participant)
  })

  it('refuses people and items until the project exists, knows nobody, and writes no tables meanwhile', async () => {
    const sql = memorySql()
    const room = new RoomStore(sql)
    await expect(room.addParticipant({ name: 'Alex Example', persona: 'cfo', side: 'agency' })).rejects.toThrow('no project')
    expect(await room.identify('anything')).toBeNull()
    expect(await room.read()).toBeNull()
    expect(sql.exec('SELECT name FROM sqlite_master').toArray()).toEqual([])
  })

  it("gives a person their persona's lens unless told otherwise, in the usual lens order", async () => {
    const room = memoryRoom()
    await room.create({ id: 'project-1', name: 'Fake', ownerId: 'user_fake' })
    const add = (lenses?: ('cfo' | 'procurement' | 'agency')[]) =>
      room.addParticipant({ name: 'Fake Person', persona: 'delivery_lead', side: 'agency', lenses })
    expect((await add()).participant.lenses).toEqual(['cto'])
    expect((await add(['procurement', 'cfo', 'procurement'])).participant.lenses).toEqual(['cfo', 'procurement'])
    expect((await add([])).participant.lenses).toEqual([])
  })

  it('edits a person in place, changing only what it is given', async () => {
    const { room, people } = await fixtureRoom()
    const casey = people.casey.participant
    const edited = await room.updateParticipant(casey.id, { jobTitle: 'Head of Brand', lenses: ['client', 'cfo'] })
    expect(edited).toEqual({ ...casey, jobTitle: 'Head of Brand', lenses: ['cfo', 'client'] })
    expect(await room.identify(people.casey.secret)).toEqual(edited)
  })

  it('removes a person softly: their key dies, they leave the list and their asks, and their facts stay', async () => {
    const { room, people, facts } = await fixtureRoom()
    const casey = people.casey
    const removed = await room.removeParticipant(casey.participant.id)

    expect(removed).toMatchObject({ id: casey.participant.id, hasLink: false, removedAt: expect.any(String) })
    expect(await room.identify(casey.secret)).toBeNull()
    const snapshot = (await room.read())!
    expect(snapshot.participants.map((person) => person.id)).not.toContain(casey.participant.id)
    expect(snapshot.facts.find((fact) => fact.id === facts.audience!.id)).toMatchObject({ participantId: casey.participant.id })
    expect(snapshot.asks.find((ask) => ask.addressedTo === casey.participant.id)).toMatchObject({ status: 'dropped' })
    expect(await room.updateParticipant(casey.participant.id, { name: 'Back again' })).toBeNull()
    expect(await room.resetKey(casey.participant.id)).toBeNull()
    expect(await room.removeParticipant(casey.participant.id)).toBeNull()
  })

  it('adds people the coach heard about with no link, skipping anyone already listed on that side', async () => {
    const { room, people } = await fixtureRoom()
    const added = await room.addMentioned([
      { name: '  casey SAMPLE ', persona: 'marketing_lead', side: 'client' },
      { name: 'Casey Sample', persona: 'agency_lead', side: 'agency' },
      { name: 'Jo Notaperson', persona: 'cfo', side: 'agency', jobTitle: 'Finance Director' },
      { name: 'jo notaperson', persona: 'cfo', side: 'agency' },
    ])
    expect(added.map((person) => [person.name, person.side])).toEqual([
      ['Casey Sample', 'agency'],
      ['Jo Notaperson', 'agency'],
    ])
    expect(added.every((person) => !person.hasLink && person.addedBy === 'coach')).toBe(true)
    expect((await room.participants()).filter((person) => person.name.toLowerCase().includes('casey'))).toHaveLength(2)
    expect(await room.identify(people.casey.secret)).toMatchObject({ side: 'client' })
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
    expect(snapshot.participants.map((person) => person.side)).toEqual(['agency', 'agency', 'client', 'client', 'client', 'client'])
    expect(snapshot.participants.find((person) => person.lenses.length > 1)).toMatchObject({ name: 'Alex Example', lenses: ['cfo', 'agency'] })
    expect(snapshot.participants.at(-1)).toMatchObject({ name: 'Morgan Madeup', hasLink: false, addedBy: 'coach' })
    expect(facts.monthlyBoard!.id).toBe(facts.fortnightlyBoard!.supersedes)
    expect(snapshot.facts.find((fact) => fact.id === facts.monthlyBoard!.id)!.status).toBe('superseded')
    expect(snapshot.facts.at(-1)).toMatchObject({ authorKind: 'lens', lens: 'cfo', topic: 'budget' })
    expect(snapshot.watermark).toBe(facts.budgetGap!.id)
    expect(snapshot.latestRuns.cfo!.report!.conflicts[0]!.priority).toBe(1)
    expect(snapshot.asks.filter((ask) => ask.status === 'open')).toHaveLength(1)
  })
})
