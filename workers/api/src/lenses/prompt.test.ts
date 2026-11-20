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
    expect(instructions).toContain('They are pricing two different projects.')
  })
})
