// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { ref } from '@day15/shared/refs'
import { ModelUnavailableError } from '../model'
import { fixtureRoom } from '../testing'
import { CoachError, runCoachTurn, runOpeningBrief, type Generate, type ModelCall } from './index'
import type { CoachTurnOutput, OpeningOutput } from './schema'

const fake = (answer: CoachTurnOutput | OpeningOutput | Error) => {
  const calls: ModelCall<unknown>[] = []
  const generate = vi.fn(async (call: ModelCall<unknown>) => {
    calls.push(call)
    if (answer instanceof Error) throw answer
    return answer
  }) as unknown as Generate
  return { generate, calls }
}

describe('runCoachTurn', () => {
  it('notes facts, closes the answered ask, opens one next ask and replies with both', async () => {
    const { room, stub, people, facts } = await fixtureRoom()
    const casey = people.casey.participant
    const { generate, calls } = fake({
      facts: [
        { topic: 'background', statement: 'Voice means the brand tone, not a talking feature.', quote: 'the tone', tentative: false, replaces: ref('fact', facts.brandVoice!.id) },
      ],
      answered_asks: ['a1'],
      confirmed: [{ fact: ref('fact', facts.budgetGap!.id), quote: 'we read the budget differently' }],
      noted: 'Got it: voice means tone.',
      next_ask: { ask: 'What does the £60k need to cover?', because: 'Budget gap.', lens: 'cfo', same_as: null, question: null },
    })

    const reply = await runCoachTurn(generate, stub, casey, 'We mean the tone. Fair, we read the budget differently.')

    expect(reply.reply).toBe('Got it: voice means tone.\n\nWhat does the £60k need to cover?')
    expect(reply.noted.map((fact) => fact.supersedes)).toEqual([facts.brandVoice!.id, facts.budgetGap!.id])
    expect(reply.noted.every((fact) => fact.sourceItemId === reply.itemId && fact.participantId === casey.id)).toBe(true)
    expect(reply.closed).toEqual([expect.objectContaining({ id: 1, status: 'answered', answeredBy: reply.itemId })])
    expect(reply.ask).toMatchObject({ addressedTo: casey.id, ask: 'What does the £60k need to cover?', status: 'open', lens: 'cfo' })
    expect(await room.asks({ addressedTo: casey.id, status: 'open' })).toEqual([reply.ask])

    const [roomText, reports, harness] = calls[0]!.instructions.map((part) => part.content)
    expect(roomText).toMatch(/^# The data room for "/)
    expect(reports).toMatch(/^# Where the five advisers stand/)
    expect(harness).toMatch(/^# Coach harness/)
    expect(calls[0]!.prompt).toContain('We mean the tone.')
  })

  it('adds people the message named with no link, without duplicating anyone already listed', async () => {
    const { room, stub, people } = await fixtureRoom()
    const before = (await room.participants()).length
    const mentioned = { job_title: '', organisation: '', side: null, notes: '' }
    const { generate } = fake({
      facts: [],
      answered_asks: [],
      confirmed: [],
      people_mentioned: [
        { ...mentioned, name: 'robin fakeworth', persona: 'cfo' },
        { ...mentioned, name: 'Sam Pretend', persona: 'procurement', job_title: 'Legal Counsel', notes: 'Reviews every contract.' },
        { ...mentioned, name: 'SAM PRETEND', persona: 'procurement' },
      ],
      noted: 'Noted: Sam reviews contracts.',
      next_ask: null,
    })

    const reply = await runCoachTurn(generate, stub, people.casey.participant, 'Robin and Sam Pretend, our Legal Counsel, see every contract.')

    expect(reply.people).toEqual([
      expect.objectContaining({
        name: 'Sam Pretend',
        side: 'client',
        jobTitle: 'Legal Counsel',
        lenses: ['procurement'],
        notes: 'Reviews every contract.',
        hasLink: false,
        addedBy: 'coach',
      }),
    ])
    expect(await room.participants()).toHaveLength(before + 1)
  })

  it('re-ranks open questions, resolves the ones the answer settles, and links the next ask to its question', async () => {
    const { room, stub, people } = await fixtureRoom()
    const { generate } = fake({
      facts: [],
      answered_asks: [],
      confirmed: [],
      resolved_questions: ['q2'],
      reprioritise: [
        { question: 'q1', priority: 3 },
        { question: 'q2', priority: 1 },
      ],
      noted: 'Noted: the board decides.',
      next_ask: { ask: 'Which of the two readings of the £60k is yours?', because: 'b', lens: 'cfo', same_as: null, question: 'q1' },
    })

    const reply = await runCoachTurn(generate, stub, people.robin.participant, 'If hosting pushes us over, the board decides.')

    expect((await room.openQuestions()).map((question) => [question.id, question.priority])).toEqual([[1, 3]])
    expect((await room.read())!.openQuestions).toHaveLength(1)
    expect(reply.ask).toMatchObject({ questionId: 1 })
  })

  it('keeps what the person said even when the model is not set up', async () => {
    const { room, stub, people } = await fixtureRoom()
    const { generate } = fake(new ModelUnavailableError())
    await expect(runCoachTurn(generate, stub, people.robin.participant, 'Still £60k.')).rejects.toBeInstanceOf(ModelUnavailableError)
    expect((await room.read())!.items.at(-1)).toMatchObject({ text: 'Still £60k.' })
  })

  it('turns a model failure into a safe coach error and logs only its name', async () => {
    const { stub, people } = await fixtureRoom()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = Object.assign(new Error('request held: Still £60k.'), { name: 'APICallError' })
    const { generate } = fake(failure)
    await expect(runCoachTurn(generate, stub, people.robin.participant, 'Still £60k.')).rejects.toBeInstanceOf(CoachError)
    expect(log).toHaveBeenCalledWith('Coach turn failed:', 'APICallError')
    log.mockRestore()
  })
})

describe('runOpeningBrief', () => {
  it('greets the person and keeps their open ask when the coach asks it again', async () => {
    const { room, stub, people } = await fixtureRoom()
    const casey = people.casey.participant
    const { generate, calls } = fake({
      reply: 'Hi Casey! You are the client marketing lead on Orchard Dash.',
      next_ask: { ask: 'Quick one: tone of voice, or a character that talks?', because: 'b', lens: 'client', same_as: 'a1', question: null },
    })

    const brief = await runOpeningBrief(generate, stub, casey)

    expect(brief.reply).toBe(
      'Hi Casey! You are the client marketing lead on Orchard Dash.\n\nQuick one: tone of voice, or a character that talks?',
    )
    expect(brief.ask).toMatchObject({ id: 1, status: 'open' })
    expect(await room.asks({ addressedTo: casey.id })).toHaveLength(1)
    expect(calls[0]!.prompt).toContain('They have just opened the room.')
  })
})
