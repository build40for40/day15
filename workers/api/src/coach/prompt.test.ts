// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { renderRoom } from '../room/render'
import { fixtureRoom } from '../testing'
import { coachInstructions, openingPrompt, renderReports, turnPrompt } from './prompt'
import { askCandidates } from './select'

describe('coachInstructions', () => {
  it('puts the rendered room first, then the lens reports, then the coach harness', async () => {
    const { room } = await fixtureRoom()
    const snapshot = (await room.read())!
    const [first, second, third] = coachInstructions(snapshot)
    expect(first!.content).toBe(renderRoom(snapshot))
    expect(first!.providerOptions).toEqual({ anthropic: { cacheControl: { type: 'ephemeral' } } })
    expect(second!.content).toBe(renderReports(snapshot))
    expect(third!.content).toMatch(/^# Coach harness/)
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

describe('turnPrompt', () => {
  it('names the person, their open asks, the ranked candidates and the message last', async () => {
    const { room, people } = await fixtureRoom()
    const casey = people.casey.participant
    const item = await room.addItem(casey.id, 'We mean the tone, not a talking character.')
    const snapshot = (await room.read())!
    const text = turnPrompt(snapshot, casey, item, askCandidates(snapshot, casey))
    expect(text).toContain('You are talking with Casey Sample (p3), on the client side as Marketing lead.')
    expect(text).toContain('## Their open asks\n- a1 [Client], open: When you say the Pipsqueak voice')
    expect(text).toContain('Client 1, Procurement 0.')
    expect(text).toContain('1. [fundamental conflict, cfo] Find out where they land on "What the price covers"')
    expect(text.indexOf('<message>')).toBeGreaterThan(text.indexOf('## Candidates'))
    expect(text).toContain(`(i${item.id})\n<message>\nWe mean the tone, not a talking character.\n</message>`)
  })

  it('tells the coach to ask nothing new when there are no candidates', async () => {
    const { room, people } = await fixtureRoom()
    const text = openingPrompt((await room.read())!, people.alex.participant, [])
    expect(text).toContain('None: every adviser is done.')
    expect(text).toContain('They have just opened the room.')
  })
})
