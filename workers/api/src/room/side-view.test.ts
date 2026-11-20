// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fixtureRoom } from '../testing'
import { sideView } from './side-view'

const AGENCY_ONLY = [
  'Hosting and app store fees sit outside that.',
  'which we license to clients and keep the rights to',
  '12 weeks from sign off',
  "Signs off the agency's quotes.",
  'The two sides read the £60k differently',
]

async function clientView() {
  const fixture = await fixtureRoom()
  const run = await fixture.room.saveLensRun({ lens: 'cfo', round: 2, watermark: 1, status: 'done', report: null })
  const [ownOnly] = await fixture.room.addFacts([
    {
      authorKind: 'lens',
      lensRunId: run.id,
      basedOn: [fixture.facts.wholeBudget!.id],
      topic: 'budget',
      statement: 'Estimate: hosting will take a slice of the fixed budget.',
    },
  ])
  await fixture.room.addAsk({
    addressedTo: fixture.people.alex.participant.id,
    ask: 'Does the quote cover hosting?',
    because: '',
    lens: 'cfo',
  })
  await fixture.room.addAsk({
    addressedTo: fixture.people.robin.participant.id,
    ask: 'Who holds the cushion?',
    because: '',
    lens: 'cfo',
    questionId: 2,
  })
  const view = sideView((await fixture.room.read())!, 'client')
  return { ...fixture, view, ownOnly: ownOnly! }
}

describe('sideView', () => {
  it("never holds the other side's facts, quotes, notes or a lens fact built on them", async () => {
    const { view } = await clientView()
    const everything = JSON.stringify(view)
    for (const text of AGENCY_ONLY) expect(everything).not.toContain(text)
    expect(view.facts.every((fact) => fact.authorKind === 'lens' || fact.side === 'client')).toBe(true)
  })

  it('keeps its own facts, and a lens fact that rests only on them', async () => {
    const { view, facts, ownOnly } = await clientView()
    const ids = view.facts.map((fact) => fact.id)
    expect(ids).toContain(facts.wholeBudget!.id)
    expect(ids).toContain(ownOnly.id)
    expect(ids).not.toContain(facts.budgetGap!.id)
  })

  it('lists everyone, with notes and lenses only for its own side', async () => {
    const { view } = await clientView()
    expect(view.participants.find((person) => person.name === 'Alex Example')).toMatchObject({
      jobTitle: 'Managing Director',
      notes: '',
      lenses: [],
    })
    expect(view.participants.find((person) => person.name === 'Casey Sample')!.notes).toBe('Reports to the brand board.')
  })

  it("lists only its own side's open asks, most urgent first, and counts every open question", async () => {
    const { view } = await clientView()
    expect(view.asks.map((entry) => [entry.ask.ask, entry.priority])).toEqual([
      ['Who holds the cushion?', 1],
      [expect.stringContaining('Pipsqueak voice'), null],
    ])
    expect(view.questionCounts).toEqual({ 1: 2, 2: 0, 3: 0 })
  })
})
