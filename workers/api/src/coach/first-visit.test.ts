// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { fixtureRoom } from '../testing'
import { FIRST_VISIT, withFirstVisit } from './first-visit'

describe('withFirstVisit', () => {
  it('says what A-Line is and what to do next before the greeting for someone who has said nothing yet', async () => {
    const { room } = await fixtureRoom()
    const { participant } = await room.addParticipant({ name: 'Sam Newcomer', persona: 'marketing_lead', side: 'client' })
    const reply = withFirstVisit((await room.read())!, participant, 'Hi Sam!')
    expect(reply).toBe(`${FIRST_VISIT}\n\nHi Sam!`)
    expect(FIRST_VISIT).toMatch(/^Welcome to A-Line!/)
    expect(FIRST_VISIT).toContain('paste in the brief')
  })

  it('leaves the reply alone for someone who has already talked to the coach', async () => {
    const { room, people } = await fixtureRoom()
    expect(withFirstVisit((await room.read())!, people.casey.participant, 'Hi Casey!')).toBe('Hi Casey!')
  })
})
