// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fixtureRoom } from '../testing'
import { renderRoom } from './render'

describe('renderRoom', () => {
  it('puts one fact on each line, in id order, readable alone', async () => {
    const { room, facts, items } = await fixtureRoom()
    const text = renderRoom((await room.read())!)
    const lines = text.split('\n').filter((line) => /^f\d+ /.test(line))
    expect(lines.map((line) => Number(line.match(/^f(\d+)/)![1]))).toEqual(
      Object.values(facts)
        .map((fact) => fact.id)
        .sort((a, b) => a - b),
    )
    expect(lines[0]).toBe(
      `f1 [budget] said by Alex Example (p1, agency side, Agency lead) in i${items[0]!.id}: The agency's £60k quote ` +
        'covers building the app only. Hosting and app store fees are extra. Quote: "Hosting and app store fees sit outside that."',
    )
  })

  it('says which fact a fact replaces, and who proposed a lens fact from what', async () => {
    const { room, facts } = await fixtureRoom()
    const text = renderRoom((await room.read())!)
    expect(text).toContain(`Replaces f${facts.monthlyBoard!.id}.`)
    expect(text).toContain(
      `f${facts.budgetGap!.id} [budget] proposed by the CFO lens in r1, from f${facts.quoteCovers!.id} and f${facts.wholeBudget!.id}:`,
    )
  })

  it('only grows at the end of the facts, so the prefix stays the same for caching', async () => {
    const { room, people, items } = await fixtureRoom()
    const before = renderRoom((await room.read())!)
    await room.addAsk({ addressedTo: people.robin.participant.id, ask: 'Is VAT in that?', because: '', lens: 'cfo' })
    await room.addFacts([
      {
        authorKind: 'person',
        participantId: people.robin.participant.id,
        sourceItemId: items[3]!.id,
        sourceQuote: 'fixed',
        status: 'proposed',
        topic: 'budget',
        statement: 'The budget\nincludes   VAT.',
      },
    ])
    const after = renderRoom((await room.read())!)
    const factsEnd = before.indexOf('\n\n## People')
    expect(after.startsWith(before.slice(0, factsEnd))).toBe(true)
    expect(after).toContain('proposed, to be confirmed by Robin Fakeworth (p4, client side, CFO) in i4: The budget includes VAT.')
    expect(after).toContain('to p4 Robin Fakeworth, for the CFO lens: Is VAT in that?')
  })

  it('renders an empty room', async () => {
    const { room } = await fixtureRoom()
    const snapshot = (await room.read())!
    const text = renderRoom({ ...snapshot, participants: [], facts: [], asks: [] })
    expect(text).toContain('No facts yet.')
    expect(text).toContain('Nobody yet.')
    expect(text).toContain('## Open asks\n\nNone.')
  })
})
