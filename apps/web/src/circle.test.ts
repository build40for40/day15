import { describe, expect, it } from 'vitest'

import { overall, statusLine, topicStates, type RoomView } from './circle'

let nextId = 0

const fact = (topic: string, side: 'agency' | 'client', overrides: Record<string, unknown> = {}) => ({
  id: ++nextId,
  topic,
  statement: `${side} on ${topic}`,
  status: 'confirmed',
  authorKind: 'person',
  side,
  basedOn: [],
  private: false,
  ...overrides,
})

const question = (overrides: Record<string, unknown>) => ({
  id: ++nextId,
  kind: 'conflict',
  topic: 'budget',
  area: 'budget',
  statement: 'The quote and the budget are £20k apart.',
  because: '',
  askSide: 'both',
  priority: 1,
  basedOn: [],
  withheld: false,
  ...overrides,
})

const room = (facts: unknown[], openQuestions: unknown[] = []) => ({ facts, openQuestions, asks: [] }) as unknown as RoomView

const topic = (view: RoomView, id: string) => topicStates(view).find((state) => state.id === id)!

describe('topicStates', () => {
  it('leaves a topic open until both sides have spoken, then calls it decided', () => {
    const oneSide = topic(room([fact('timeline', 'client')]), 'timeline')
    expect(oneSide).toMatchObject({ bucket: 'open', coverage: { agency: 'missing', client: 'settled' } })
    expect(statusLine(oneSide)).toBe('Still open. Waiting on the agency.')

    const both = topic(room([fact('timeline', 'client'), fact('timeline', 'agency')]), 'timeline')
    expect(both).toMatchObject({ bucket: 'decided', score: 1 })
  })

  it('breaks the spoke on a high priority question and only loosens it on a medium one', () => {
    const facts = [fact('budget', 'client'), fact('budget', 'agency')]
    const broken = topic(room(facts, [question({})]), 'budget')
    expect(broken).toMatchObject({ bucket: 'crack', score: 0.3 })
    expect(statusLine(broken)).toBe('Deal-breaker. The quote and the budget are £20k apart.')

    const loose = topic(room(facts, [question({ priority: 2, kind: 'gap', askSide: 'client' })]), 'budget')
    expect(loose).toMatchObject({ bucket: 'talked', coverage: { agency: 'settled', client: 'thin' } })
  })

  it('ignores a replaced fact when working out who has spoken', () => {
    const state = topic(room([fact('audience', 'agency', { status: 'superseded' })]), 'audience')
    expect(state.coverage.agency).toBe('missing')
    expect(state.facts).toHaveLength(1)
  })

  it('files a question with a free-text topic under its facts, and a withheld one under its area', () => {
    const cited = fact('deliverables', 'agency')
    const view = room(
      [cited],
      [
        question({ topic: 'What the price covers', basedOn: [cited.id], priority: 2 }),
        question({ topic: '', statement: '', area: 'procurement_and_contract', withheld: true }),
      ],
    )
    expect(topic(view, 'deliverables').questions).toHaveLength(1)
    expect(statusLine(topic(view, 'legal_ip'))).toBe('Deal-breaker. It rests on something the client asked to keep private.')
  })
})

describe('overall', () => {
  it('says nothing has started on an empty room and counts deal-breakers once there is enough to go on', () => {
    expect(overall(topicStates(room([])))).toMatchObject({ word: 'Not started', open: 11 })

    const topics = ['background', 'objective', 'audience', 'budget', 'timeline']
    const facts = topics.flatMap((id) => [fact(id, 'agency'), fact(id, 'client')])
    expect(overall(topicStates(room(facts, [question({})])))).toMatchObject({ word: 'One deal-breaker to sort', crack: 1, decided: 4 })
  })
})
