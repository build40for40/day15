// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { ref } from '@day15/shared/refs'
import { ModelUnavailableError } from '../model'
import { fixtureRoom } from '../testing'
import { FIRST_VISIT } from './first-visit'
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
      next_ask: { ask: 'What does the £60k need to cover?', because: 'Budget gap.', lens: 'procurement', same_as: null, question: null },
    })

    const reply = await runCoachTurn(generate, stub, casey, 'We mean the tone. Fair, we read the budget differently.')

    expect(reply.reply).toBe('Got it: voice means tone.\n\nWhat does the £60k need to cover?')
    expect(reply.noted.map((fact) => fact.supersedes)).toEqual([facts.brandVoice!.id, facts.budgetGap!.id])
    expect(reply.noted.every((fact) => fact.sourceItemId === reply.itemId && fact.participantId === casey.id)).toBe(true)
    expect(reply.closed).toEqual([expect.objectContaining({ id: 1, status: 'answered', answeredBy: reply.itemId })])
    expect(reply.ask).toMatchObject({ addressedTo: casey.id, ask: 'What does the £60k need to cover?', status: 'open', lens: 'procurement' })
    expect(await room.asks({ addressedTo: casey.id, status: 'open' })).toEqual([reply.ask])

    const [roomText, reports, harness] = calls[0]!.instructions.map((part) => part.content)
    expect(roomText).toMatch(/^# The data room for "/)
    expect(reports).toMatch(/^# Where the advisers stand/)
    expect(harness).toMatch(/^# Your two harnesses/)
    expect(harness).toContain('# Mother agent')
    expect(harness).toContain('# Coach harness')
    expect(calls[0]!.prompt).toContain('We mean the tone.')
  })

  it('explains before the ask, and raises its own open question for a signal no adviser raised', async () => {
    const { room, stub, people } = await fixtureRoom()
    const { generate } = fake({
      facts: [],
      answered_asks: [],
      confirmed: [],
      raise_questions: [
        { area: 'dependencies_and_ownership', statement: 'Who runs the app day to day after launch.', ask_side: 'client', priority: 1 },
      ],
      noted: 'Thanks.',
      next_ask: {
        explain: "On projects like this, running costs often sit in nobody's budget.",
        ask: 'Who pays for hosting after launch?',
        because: 'Running cost with no owner.',
        lens: 'procurement',
        same_as: null,
      },
    })

    const reply = await runCoachTurn(generate, stub, people.robin.participant, 'Nothing new from me.')

    expect(reply.reply).toBe(
      "Thanks.\n\nOn projects like this, running costs often sit in nobody's budget.\n\nWho pays for hosting after launch?",
    )
    const raised = (await room.openQuestions()).find((question) => question.lens === null)
    expect(raised).toMatchObject({
      kind: 'gap',
      area: 'dependencies_and_ownership',
      askSide: 'client',
      priority: 1,
      raisedByRun: null,
      raisedByItem: reply.itemId,
    })
  })

  it('keeps a fact private when asked, lets its side release it, and ignores the other side changing it', async () => {
    const { room, stub, people } = await fixtureRoom()
    const note = { topic: 'budget' as const, quote: 'we could stretch to 70k', tentative: false, replaces: null }
    const turn = (privacy: { fact: string; private: boolean }[], facts = [] as (typeof note & { statement: string; private?: boolean })[]) =>
      fake({ facts, answered_asks: [], confirmed: [], privacy, noted: 'Noted.', next_ask: null }).generate

    const first = await runCoachTurn(
      turn([], [{ ...note, statement: 'The client could stretch the budget to £70k.', private: true }]),
      stub,
      people.robin.participant,
      'Between us, we could stretch to 70k.',
    )
    const id = first.noted[0]!.id
    expect(first.noted[0]!.private).toBe(true)

    await runCoachTurn(turn([{ fact: `f${id}`, private: false }]), stub, people.alex.participant, 'Make that public.')
    expect((await room.read())!.facts.find((fact) => fact.id === id)!.private).toBe(true)

    await runCoachTurn(turn([{ fact: `f${id}`, private: false }]), stub, people.robin.participant, 'Fine, share the 70k.')
    expect((await room.read())!.facts.find((fact) => fact.id === id)!.private).toBe(false)
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
      next_ask: { ask: 'Which of the two readings of the £60k is yours?', because: 'b', lens: 'procurement', same_as: null, question: 'q1' },
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

  it('welcomes someone who has not said anything yet with what A-Line is', async () => {
    const { room, stub } = await fixtureRoom()
    const { participant } = await room.addParticipant({ name: 'Sam Newcomer', persona: 'marketing_lead', side: 'client' })
    const { generate } = fake({ reply: 'Hi Sam!', next_ask: { ask: 'What does done look like?', because: 'b', lens: 'client', same_as: null } })

    const brief = await runOpeningBrief(generate, stub, participant)

    expect(brief.reply).toBe(`${FIRST_VISIT}\n\nHi Sam!\n\nWhat does done look like?`)
  })
})
