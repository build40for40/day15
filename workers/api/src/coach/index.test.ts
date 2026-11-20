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
      next_ask: { ask: 'What does the £60k need to cover?', because: 'Budget gap.', lens: 'cfo', same_as: null },
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
    expect(reports).toMatch(/^# What the five advisers reported/)
    expect(harness).toMatch(/^# Your two harnesses/)
    expect(harness).toContain('# Mother agent')
    expect(harness).toContain('# Coach harness')
    expect(calls[0]!.prompt).toContain('We mean the tone.')
  })

  it("keeps the mother agent's matrix and health reading, away from every view of the room", async () => {
    const { room, stub, people } = await fixtureRoom()
    const casey = people.casey.participant
    const { generate, calls } = fake({
      facts: [],
      answered_asks: [],
      confirmed: [],
      alignment: [
        { area: 'scope', rating: 'high', misalignment: 'The two sides list different things as included.' },
        { area: 'budget', rating: 'medium', misalignment: 'Whether VAT is in the figure.' },
      ],
      noted: 'Thanks.',
      next_ask: {
        explain: 'On projects like this, running costs often sit in nobody\'s budget.',
        ask: 'Who pays for hosting after launch?',
        because: 'Running cost with no owner.',
        lens: 'cfo',
        same_as: null,
      },
    })

    const reply = await runCoachTurn(generate, stub, casey, 'Nothing new from me.')

    expect(reply.reply).toBe(
      "Thanks.\n\nOn projects like this, running costs often sit in nobody's budget.\n\nWho pays for hosting after launch?",
    )
    expect(reply.ask!.ask).toBe('Who pays for hosting after launch?')

    const kept = await room.assessment()
    expect(kept!.itemId).toBe(reply.itemId)
    expect(kept!.areas).toHaveLength(7)
    expect(kept!.areas[1]).toMatchObject({ area: 'scope', rating: 'high' })
    expect(kept!.areas[0]).toMatchObject({ area: 'goal_and_success', rating: 'low' })
    expect(kept!.health!.band).toBe('red')
    expect(JSON.stringify(await room.read())).not.toContain('The two sides list different things as included.')

    expect(calls[0]!.prompt).toContain('You have not rated this project yet.')
    const again = fake({ facts: [], answered_asks: [], confirmed: [], noted: 'Ok.', next_ask: null })
    await runCoachTurn(again.generate, stub, casey, 'Still nothing.')
    expect(again.calls[0]!.prompt).toContain('- Scope (scope): high. The two sides list different things as included.')
    expect((await room.assessment())!.itemId).toBe(reply.itemId)
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
      next_ask: { ask: 'Quick one: tone of voice, or a character that talks?', because: 'b', lens: 'client', same_as: 'a1' },
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
