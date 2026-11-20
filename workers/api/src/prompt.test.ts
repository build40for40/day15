// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { instructions, messages } from './prompt'
import { emptyRoom, mySide, pend, record } from './room'

const turn = { lens: 'cto' as const, question: 'What does done look like?', answer: 'It is live by March.' }

describe('coach prompt', () => {
  it('describes every hat for the side in the chair and keeps the hat secret', () => {
    const text = instructions('client', record(emptyRoom(), 'client', 'A fictional biscuit site.'))
    expect(text).toContain('someone on the client side')
    for (const hat of ['### cfo', '### cto', '### agency', '### client', '### procurement']) expect(text).toContain(hat)
    expect(text).toContain('With the client side, asks about')
    expect(text).toContain('never name a hat')
    expect(text).toContain('They have not spoken to you yet.')
  })

  it("gives the brain the other side's answers and which hats each side has had", () => {
    let room = record(emptyRoom(), 'agency', 'Agency view of the biscuit site.', turn)
    room = record(room, 'client', 'Client view of the biscuit site.')
    const text = instructions('client', room)
    expect(text).toContain('Agency view of the biscuit site.')
    expect(text).toContain('They said: It is live by March.')
    expect(text).toContain('Hats worn so far with the agency side: cto.')
    expect(text).toContain('Hats worn so far with the client side, in order: none yet.')
    expect(text).toContain('Never quote it')
    expect(text).toContain('Reply with "rationale" first')
  })

  it("sends only this side's own conversation as messages, ending on their last answer", () => {
    const room = record(emptyRoom(), 'agency', 'A fictional biscuit site.', turn)
    const result = messages(room.sides.agency!)
    expect(result.map((message) => message.role)).toEqual(['user', 'assistant', 'user'])
    expect(result[1]!.content).toBe('What does done look like?')
    expect(result[2]!.content).toBe('It is live by March.')
  })
})

describe('room', () => {
  it("keeps a side's first description and adds its turns", () => {
    let room = record(emptyRoom(), 'client', 'First words.')
    room = record(room, 'client', 'Different words.', turn)
    expect(room.sides.client).toEqual({ project: 'First words.', turns: [{ ...turn, rationale: undefined }] })
  })

  it("never hands one side the other's words", () => {
    const room = record(emptyRoom(), 'agency', 'Agency secrets.', turn)
    expect(mySide(room, 'client')).toEqual({ project: '', turns: [], otherSideStarted: true })
    expect(mySide(room, 'agency').otherSideStarted).toBe(false)
  })

  it("files the brain's reasoning with the answer and keeps it away from both sides", () => {
    let room = record(emptyRoom(), 'agency', 'A fictional biscuit site.')
    room = pend(room, 'agency', { lens: 'cto', question: turn.question, rationale: 'The client expects more.' })
    expect(room.sides.agency!.pending!.rationale).toBe('The client expects more.')

    room = record(room, 'agency', 'A fictional biscuit site.', turn)
    expect(room.sides.agency!.pending).toBeUndefined()
    expect(room.sides.agency!.turns[0]!.rationale).toBe('The client expects more.')
    expect(JSON.stringify(mySide(room, 'agency'))).not.toContain('The client expects more.')
  })

  it('keeps the waiting question when a side only reloads', () => {
    let room = record(emptyRoom(), 'client', 'A fictional app.')
    room = pend(room, 'client', { lens: 'cfo', question: 'Who pays?', rationale: 'Nobody said.' })
    expect(record(room, 'client', 'A fictional app.').sides.client!.pending!.question).toBe('Who pays?')
  })
})
