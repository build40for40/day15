// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { renderRoom } from '../room/render'
import { fixtureRoom } from '../testing'
import { PERSONAS } from './personas'
import { lensPrompt } from './prompt'

describe('lensPrompt', () => {
  it('puts the rendered room first and the wrapper with the persona after it', async () => {
    const { room } = await fixtureRoom()
    const snapshot = (await room.read())!
    const prompt = lensPrompt('procurement', snapshot)
    expect(prompt.room).toBe(renderRoom(snapshot))
    expect(prompt.instructions).toContain(PERSONAS.procurement.trim())
    expect(prompt.instructions).toContain('background, objective, audience')
    expect(prompt.instructions).not.toMatch(/\{\{\w+\}\}/)
    expect(prompt.instructions).not.toContain('Pipsqueak')
  })

  it("tells a lens with no report yet that everything is new", async () => {
    const { room } = await fixtureRoom()
    expect(lensPrompt('agency', (await room.read())!).instructions).toContain('None yet: this is your first report')
  })

  it('gives a lens its last report and the facts that arrived after its watermark', async () => {
    const { room, facts } = await fixtureRoom()
    const { instructions } = lensPrompt('cfo', (await room.read())!)
    const since = [facts.ownAll!, facts.fortnightlyBoard!, facts.budgetGap!].map((fact) => `f${fact.id}`).join(', ')
    expect(instructions).toContain(`when the newest fact was f${facts.wholeBudget!.id}.`)
    expect(instructions).toContain(`Facts that arrived since: ${since}.`)
  })

  it('lists this lens its own open questions by id, and leaves them out of its last report', async () => {
    const { room } = await fixtureRoom()
    const snapshot = (await room.read())!
    const cfo = lensPrompt('cfo', snapshot).instructions
    const own = cfo.slice(cfo.indexOf('<open_questions>'), cfo.indexOf('</open_questions>'))
    expect(own).toContain('q1 [high (1) priority] fundamental conflict on "What the price covers"')
    expect(own).toContain('q2 [high (1) priority] gap, for the client side')
    expect(cfo.match(/They are pricing two different projects\./g)).toHaveLength(1)
    expect(lensPrompt('procurement', snapshot).instructions).toMatch(/<open_questions>\nNone\.\n<\/open_questions>/)
  })
})
