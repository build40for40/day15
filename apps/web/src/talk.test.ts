import { describe, expect, it } from 'vitest'

import { topicStates, type RoomView } from './circle'
import { changedTopics, fingerprints, messageForCoach, messageForOwnAi } from './talk'

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

describe('what is said to the coach', () => {
  const budget = () => topicStates(room([fact('budget', 'client'), fact('budget', 'agency')], [question({})])).find((state) => state.id === 'budget')!

  it('is just the words when no card is open', () => {
    expect(messageForCoach(null, 'The date moved.')).toBe('The date moved.')
  })

  it('names the card the words are about', () => {
    expect(messageForCoach(budget(), 'It is now 150k.')).toBe('About Budget: It is now 150k.')
  })

  it('says which question is being answered', () => {
    const state = budget()
    expect(messageForCoach(state, '150k.', state.questions[0])).toBe('About Budget (the coach asked: "The quote and the budget are £20k apart."): 150k.')
  })

  it('adds how to open the room when it is for their own AI', () => {
    expect(messageForOwnAi(budget(), 'It is now 150k.')).toBe('Open my A-Line room. About Budget: It is now 150k.')
  })

  it('does not treat the coach reordering questions as a change', () => {
    const facts = [fact('budget', 'client'), fact('budget', 'agency')]
    const before = fingerprints(topicStates(room(facts, [question({ id: 901 }), question({ id: 902 })])))
    expect(changedTopics(before, topicStates(room(facts, [question({ id: 902 }), question({ id: 901 })])))).toEqual([])
  })
})
