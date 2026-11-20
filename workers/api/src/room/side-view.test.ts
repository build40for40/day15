// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { AGENCY_PRIVATE, privateAgencyRoom } from '../testing'
import { sideView } from './side-view'

describe('sideView', () => {
  it("hides the other side's private fact, a lens fact built on it and the wording of a question resting on it", async () => {
    const { room, facts } = await privateAgencyRoom()
    const view = sideView((await room.read())!, 'client')
    const everything = JSON.stringify(view)
    for (const text of AGENCY_PRIVATE) expect(everything).not.toContain(text)
    expect(view.facts.map((fact) => fact.id)).not.toContain(facts.budgetGap!.id)
    expect(view.openQuestions.find((question) => question.id === 1)).toMatchObject({ withheld: true, priority: 1, area: 'budget' })
  })

  it("shows the other side's facts that are not private, and everyone's details", async () => {
    const { room, facts } = await privateAgencyRoom()
    const view = sideView((await room.read())!, 'client')
    expect(view.facts.map((fact) => fact.id)).toContain(facts.twelveWeeks!.id)
    expect(view.participants.find((person) => person.name === 'Alex Example')).toMatchObject({
      notes: "Signs off the agency's quotes.",
      lenses: ['cfo', 'agency'],
    })
    expect(view.openQuestions.find((question) => question.id === 2)).toMatchObject({ withheld: false })
  })

  it('shows the side that said it everything, its private fact included', async () => {
    const { room, facts } = await privateAgencyRoom()
    const view = sideView((await room.read())!, 'agency')
    expect(view.facts.map((fact) => fact.id)).toEqual(expect.arrayContaining([facts.quoteCovers!.id, facts.budgetGap!.id]))
    expect(view.openQuestions.find((question) => question.id === 1)).toMatchObject({ withheld: false })
  })
})
