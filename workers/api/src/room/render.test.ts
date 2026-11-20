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
      `f1 [budget] said by p1 (agency side) in i${items[0]!.id}: The agency's £60k quote ` +
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
    expect(after).toContain('proposed, to be confirmed by p4 (client side) in i4: The budget includes VAT.')
    expect(after).toContain('to p4 Robin Fakeworth, for the CFO lens: Is VAT in that?')
  })

  it('keeps a proposed fact\'s line as it was once a later fact replaces it', async () => {
    const { room, people, items } = await fixtureRoom()
    const pat = people.pat.participant.id
    const said = { authorKind: 'person', participantId: pat, sourceItemId: items[3]!.id, sourceQuote: 'fixed' } as const
    const [tentative] = await room.addFacts([{ ...said, status: 'proposed', topic: 'budget', statement: 'Probably about £40k.' }])
    const line = async () => renderRoom((await room.read())!).split('\n').find((text) => text.startsWith(`f${tentative!.id} `))
    const before = await line()
    await room.addFacts([{ ...said, status: 'confirmed', topic: 'budget', statement: 'It is £40k.', supersedes: tentative!.id }])
    expect(await line()).toBe(before)
    expect(before).toContain('proposed, to be confirmed by p5 (client side)')
  })

  it('shows each current person on one line after the facts, with role, seat, lenses, link and notes', async () => {
    const { room } = await fixtureRoom()
    const text = renderRoom((await room.read())!)
    const people = text.slice(text.indexOf('## People'), text.indexOf('## Open asks'))
    expect(people).toContain(
      "p1 Alex Example, Managing Director at Make-Believe Studio. Agency side, Agency lead. Speaks for the CFO and " +
        "Agency lenses. Has a link. Notes: Signs off the agency's quotes.\n",
    )
    expect(people).toContain(
      'p6 Morgan Madeup, Chair of the brand board at Pipsqueak Juice. Client side, Marketing lead. Speaks for the ' +
        'Client lens. No link: mentioned in conversation. Notes: Chairs the brand board that signs off every creative change.',
    )
    expect(text.indexOf('## People')).toBeGreaterThan(text.indexOf('## Facts'))
  })

  it('keeps the facts the same when people are edited or removed, and drops removed people from the list', async () => {
    const { room, people } = await fixtureRoom()
    const before = renderRoom((await room.read())!)
    await room.updateParticipant(people.alex.participant.id, { name: 'Alex Renamed', persona: 'cfo', side: 'client' })
    await room.removeParticipant(people.pat.participant.id)
    const after = renderRoom((await room.read())!)
    const facts = (text: string) => text.slice(0, text.indexOf('## People'))
    expect(facts(after)).toBe(facts(before))
    expect(after).toContain('p1 Alex Renamed,')
    expect(after).not.toContain('Pat Notreal')
  })

  it('renders an empty room', async () => {
    const { room } = await fixtureRoom()
    const snapshot = (await room.read())!
    const text = renderRoom({ ...snapshot, participants: [], facts: [], asks: [] })
    expect(text).toContain('No facts yet.')
    expect(text).toContain('Nobody yet.')
    expect(text).toContain('## Open asks\n\nNone.')
  })

  it('lists open questions most urgent first after the people, outside the fact prefix', async () => {
    const { room } = await fixtureRoom()
    await room.setQuestionPriorities([{ id: 1, priority: 2 }])
    const text = renderRoom((await room.read())!)
    const open = text.slice(text.indexOf('## Open questions'), text.indexOf('## Open asks'))
    expect(text.indexOf('## Open questions')).toBeGreaterThan(text.indexOf('## People'))
    expect(open.indexOf('q2 [high (1) priority] gap in Budget, for the client side, raised by the CFO lens in r1')).toBeGreaterThan(0)
    expect(open.indexOf('q2 ')).toBeLessThan(open.indexOf('q1 [medium (2) priority] fundamental conflict on "What the price covers"'))
  })
})
