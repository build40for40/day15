// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { ref } from '@day15/shared/refs'
import { fixtureRoom } from '../testing'
import { composeReply, planAnswered, planFacts, planNextAsk, planTurn, sourceQuote } from './plan'
import type { CoachTurnOutput } from './schema'
import { askCandidates } from './select'

const MESSAGE = 'Honestly we mean the tone of voice, not a talking character. And yes, the £60k reads differently on each side.'

const output = (overrides: Partial<CoachTurnOutput> = {}): CoachTurnOutput => ({
  facts: [],
  answered_asks: [],
  confirmed: [],
  noted: 'Noted.',
  next_ask: null,
  ...overrides,
})

async function setup(person: 'casey' | 'robin' = 'casey') {
  const fixture = await fixtureRoom()
  const participant = fixture.people[person].participant
  const item = await fixture.room.addItem(participant.id, MESSAGE)
  const room = (await fixture.room.read())!
  return { ...fixture, participant, item, room, candidates: askCandidates(room, participant) }
}

const note = { topic: 'background' as const, statement: 'Voice means brand tone.', quote: 'the tone of voice', tentative: false, replaces: null }

describe('sourceQuote', () => {
  it('keeps a quote that is really in the message, ignoring case, spacing and curly quotes', () => {
    expect(sourceQuote('The  TONE of voice', MESSAGE)).toBe('The  TONE of voice')
    expect(sourceQuote('‘honestly we mean’', "'Honestly we mean' it")).toBe('‘honestly we mean’')
  })

  it('falls back to the whole message when the model paraphrased', () => {
    expect(sourceQuote('brand tone only', MESSAGE)).toBe(MESSAGE)
  })
})

describe('planFacts', () => {
  it('writes person facts sourced to the item, tentative ones as proposed', async () => {
    const context = await setup()
    const facts = planFacts(output({ facts: [note, { ...note, statement: 'Maybe a jingle.', tentative: true }] }), context)
    expect(facts).toEqual([
      {
        authorKind: 'person',
        participantId: context.participant.id,
        sourceItemId: context.item.id,
        topic: 'background',
        statement: 'Voice means brand tone.',
        sourceQuote: 'the tone of voice',
        status: 'confirmed',
      },
      expect.objectContaining({ statement: 'Maybe a jingle.', status: 'proposed' }),
    ])
  })

  it('lets a person replace only their own facts, and each fact only once', async () => {
    const context = await setup()
    const own = ref('fact', context.facts.brandVoice!.id)
    const someoneElses = ref('fact', context.facts.voiceCharacter!.id)
    const facts = planFacts(
      output({
        facts: [
          { ...note, replaces: own },
          { ...note, replaces: own },
          { ...note, replaces: someoneElses },
          { ...note, replaces: ref('fact', context.facts.monthlyBoard!.id) },
        ],
      }),
      context,
    )
    expect(facts.map((fact) => fact.supersedes)).toEqual([context.facts.brandVoice!.id, undefined, undefined, undefined])
  })

  it('confirms a lens proposal as the person’s own fact that replaces it', async () => {
    const context = await setup()
    const gap = context.facts.budgetGap!
    const facts = planFacts(
      output({
        confirmed: [
          { fact: ref('fact', gap.id), quote: 'the £60k reads differently on each side' },
          { fact: ref('fact', gap.id), quote: 'again' },
          { fact: ref('fact', context.facts.audience!.id), quote: 'not a proposal' },
        ],
      }),
      context,
    )
    expect(facts).toEqual([
      expect.objectContaining({
        topic: 'budget',
        statement: gap.statement,
        status: 'confirmed',
        supersedes: gap.id,
        basedOn: gap.basedOn,
        sourceQuote: 'the £60k reads differently on each side',
      }),
    ])
  })
})

describe('planAnswered', () => {
  it('keeps only asks that exist and are still open, once each', async () => {
    const { room } = await setup()
    expect(planAnswered(output({ answered_asks: ['a1', 'A1', '1', 'a99', 'nonsense'] }), room)).toEqual([1])
  })
})

describe('planNextAsk', () => {
  it('adds the model’s ask and drops the person’s other open asks', async () => {
    const context = await setup()
    const plan = planNextAsk({ ask: 'Who signs off?', because: 'b', lens: 'agency', same_as: null, question: null }, { ...context, answered: [] })
    expect(plan).toEqual({
      keep: null,
      ask: { addressedTo: context.participant.id, ask: 'Who signs off?', because: 'b', lens: 'agency', questionId: null },
      dropped: [1],
      text: 'Who signs off?',
    })
  })

  it('keeps an open ask the model is asking again, in its new words', async () => {
    const context = await setup()
    const plan = planNextAsk({ ask: 'Voice: tone or talking?', because: 'b', lens: 'client', same_as: 'a1', question: null }, { ...context, answered: [] })
    expect(plan).toEqual({ keep: 1, ask: null, dropped: [], text: 'Voice: tone or talking?' })
  })

  it('falls back to the oldest open ask, then to the best candidate, when the model asks nothing', async () => {
    const context = await setup()
    expect(planNextAsk(null, { ...context, answered: [] })).toMatchObject({ keep: 1, ask: null })

    const plan = planNextAsk(null, { ...context, answered: [1] })
    expect(plan.keep).toBeNull()
    expect(plan.ask).toMatchObject({ addressedTo: context.participant.id, lens: 'client' })
    expect(plan.text).toBe(context.candidates[0]!.question)
    expect(plan.text).toBe('If this goes brilliantly, what has changed for the business?')
  })

  it('asks nothing when there is nothing left to ask', async () => {
    const context = await setup()
    expect(planNextAsk(null, { ...context, candidates: [], answered: [1] })).toEqual({ keep: null, ask: null, dropped: [], text: null })
  })
})

describe('planTurn', () => {
  it('does not drop an ask the same message answered', async () => {
    const context = await setup()
    const plan = planTurn(
      output({ answered_asks: ['a1'], next_ask: { ask: 'Next?', because: 'b', lens: null, same_as: 'a1', question: null } }),
      context,
    )
    expect(plan.answered).toEqual([1])
    expect(plan.dropped).toEqual([])
    expect(plan.ask).toMatchObject({ ask: 'Next?' })
  })
})

describe('composeReply', () => {
  it('puts what was noted before the one question', () => {
    expect(composeReply('Noted the tone. ', 'Who signs off?')).toBe('Noted the tone.\n\nWho signs off?')
    expect(composeReply('', null)).toBe('Got it, thanks.')
  })
})
