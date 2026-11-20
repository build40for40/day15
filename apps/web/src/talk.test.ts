import { describe, expect, it } from 'vitest'

import { topicStates, type RoomView } from './circle'
import { changedTopics, fingerprints, sayToCoach } from './talk'

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

describe('changedTopics', () => {
  it('reports nothing on the first read', () => {
    expect(changedTopics(null, topicStates(room([fact('timeline', 'client')])))).toEqual([])
  })

  it('reports nothing when the room has not moved', () => {
    const view = room([fact('timeline', 'client')])
    expect(changedTopics(fingerprints(topicStates(view)), topicStates(view))).toEqual([])
  })

  it('reports only the topics that gained a fact or a question', () => {
    const before = fingerprints(topicStates(room([fact('timeline', 'client')])))
    const after = topicStates(room([fact('timeline', 'client'), fact('timeline', 'agency'), fact('budget', 'client')]))
    expect(changedTopics(before, after).sort()).toEqual(['budget', 'timeline'])
  })

  it('notices a new open question on a topic that had none', () => {
    const facts = [fact('budget', 'client'), fact('budget', 'agency')]
    const before = fingerprints(topicStates(room(facts)))
    expect(changedTopics(before, topicStates(room(facts, [question({})])))).toEqual(['budget'])
  })
})

describe('sayToCoach', () => {
  it('opens the room and leaves the words to the person when no card is open', () => {
    expect(sayToCoach(null)).toContain('Open my A-Line room.')
  })

  it('points at the open card', () => {
    const budget = topicStates(room([fact('budget', 'client')])).find((state) => state.id === 'budget')!
    expect(sayToCoach(budget)).toContain('About Budget')
  })

  it('quotes the question the coach is waiting on', () => {
    const budget = topicStates(room([fact('budget', 'client'), fact('budget', 'agency')], [question({})])).find((state) => state.id === 'budget')!
    expect(sayToCoach(budget)).toContain('The quote and the budget are £20k apart.')
  })
})
