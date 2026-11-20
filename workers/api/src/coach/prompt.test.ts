// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { renderRoom } from '../room/render'
import { fixtureRoom } from '../testing'
import { coachInstructions, openingPrompt, renderAssessment, renderCoverage, renderReports, turnPrompt } from './prompt'
import { askCandidates } from './select'

describe('coachInstructions', () => {
  it('puts the rendered room first, then the lens reports, then the coach harness', async () => {
    const { room } = await fixtureRoom()
    const snapshot = (await room.read())!
    const [first, second, third] = coachInstructions(snapshot)
    expect(first!.content).toBe(renderRoom(snapshot))
    expect(first!.providerOptions).toEqual({ anthropic: { cacheControl: { type: 'ephemeral' } } })
    expect(second!.content).toBe(renderReports(snapshot))
    expect(third!.content).toMatch(/^# Your two harnesses/)
    // The mother agent comes first and decides what to ask; the coach harness keeps the room.
    const text = String(third!.content)
    expect(text.indexOf('# Mother agent')).toBeGreaterThan(0)
    expect(text.indexOf('# Coach harness')).toBeGreaterThan(text.indexOf('# Mother agent'))
    for (const part of ['### The four phases', '### Signals to listen for', '### Your priority matrix', '### Educating']) {
      expect(text).toContain(part)
    }
    expect(third!.content).toContain('<reference>')
    expect(third!.content).toContain('# Coach reference pack')
  })
})

describe('renderReports', () => {
  it('shows each lens report, flags one that has not seen the newest facts, and notes lenses with none', async () => {
    const { room } = await fixtureRoom()
    const text = renderReports((await room.read())!)
    expect(text).toContain('### CFO adviser (r1, read up to f11, newer facts not seen yet)')
    expect(text).toContain('- fundamental conflict on "What the price covers"')
    expect(text).toContain('Contingency (agency missing, client missing)')
    expect(text).toContain('- from the client side, priority 1: what happens if hosting pushes the total past £60k.')
    expect(text).toContain('### Procurement adviser\nNo report yet.')
  })
})

describe('renderCoverage', () => {
  it('lists who speaks for each adviser and tells an agency person about the gaps without inventing an owner', async () => {
    const { room, people } = await fixtureRoom()
    const text = renderCoverage((await room.read())!, people.dana.participant)
    expect(text).toContain('- Agency side. CFO: p1 Alex Example; Delivery: p2 Dana Placeholder; Agency: p1 Alex Example; ')
    expect(text).toContain('Client: p3 Casey Sample, p6 Morgan Madeup (no link);')
    expect(text).toContain('Gaps: the agency side has nobody for Procurement; the client side has nobody for Delivery.')
    expect(text).toContain('suggest they add someone.')
    expect(text).toContain('Never treat anyone as owning a gap.')
  })

  it('tells a client person that a gap may fall to them without making it theirs', async () => {
    const { room, people } = await fixtureRoom()
    const text = renderCoverage((await room.read())!, people.robin.participant)
    expect(text).toContain('never treat them as owning it')
    expect(text).not.toContain('suggest they add someone')
  })
})

describe('turnPrompt', () => {
  it('names the person, their open asks, the ranked candidates and the message last', async () => {
    const { room, people } = await fixtureRoom()
    const casey = people.casey.participant
    const item = await room.addItem(casey.id, 'We mean the tone, not a talking character.')
    const snapshot = (await room.read())!
    const text = turnPrompt(snapshot, casey, item, askCandidates(snapshot, casey))
    expect(text).toContain(
      'You are talking with Casey Sample (p3), Brand Manager at Pipsqueak Juice, on the client side as Marketing lead. ' +
        'They speak for what the Client adviser cares about.',
    )
    expect(text).toContain('## Their open asks\n- a1 [Client], open: When you say the Pipsqueak voice')
    expect(text).toContain('Client 1, Procurement 0.')
    expect(text).toContain("1. [nothing said yet, client] Find out their side's view on objective.")
    expect(text).toContain('[nothing said yet, cto, nobody on their side speaks for this]')
    expect(text.indexOf('<message>')).toBeGreaterThan(text.indexOf('## Candidates'))
    expect(text).toContain(`(i${item.id})\n<message>\nWe mean the tone, not a talking character.\n</message>`)
  })

  it('tells the coach to ask nothing new when there are no candidates', async () => {
    const { room, people } = await fixtureRoom()
    const text = openingPrompt((await room.read())!, people.alex.participant, [])
    expect(text).toContain('None for this person: the advisers are done, or what they need is for someone else.')
    expect(text).toContain('They have just opened the room.')
  })
})

describe('renderAssessment', () => {
  it('lists the areas when the project has not been rated yet', () => {
    const text = renderAssessment(null)
    expect(text).toContain('You have not rated this project yet.')
    expect(text).toContain('goal_and_success, scope, dependencies_and_ownership')
  })

  it("gives the mother agent its own last matrix and reading back, and says nobody else sees it", () => {
    const text = renderAssessment({
      itemId: 4,
      areas: [{ area: 'scope', rating: 'high', misalignment: 'Different lists of what is included.', cause: 'knowledge_gap' }],
      health: { score: 37, band: 'red' },
    })
    expect(text).toContain('as you left it after i4')
    expect(text).toContain('- Scope (scope): high. Different lists of what is included. Cause: a gap in knowledge.')
    expect(text).toContain('Health was 37 out of 100, red.')
    expect(text).toContain('Nobody on either side sees any of this.')
  })

  it('says so when there was no reading yet', () => {
    expect(renderAssessment({ itemId: 1, areas: [], health: null })).toContain('There was no health reading yet')
  })
})
