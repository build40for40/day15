// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CoachError } from '../coach'
import type { Env } from '../contracts'
import { ModelUnavailableError } from '../model'
import { FIXTURE_PROJECT } from '../room/fixture'
import { asStub, fixtureRoom, memoryRoom } from '../testing'
import { COACH_FAILED, NO_OPEN_QUESTIONS, NO_PROJECT, NOT_CHECKED, OPEN_QUESTIONS_HEADING, OPEN_ROOM_GUIDE } from './text'
import { openRoom, readRoom, tellCoach, type McpDeps } from './tools'

const COACH_REPLY = { reply: 'Noted: launch in July.\n\nWhat does done look like for the board?', itemId: 1, noted: [], people: [], closed: [], ask: null }

async function setup(deps: Partial<McpDeps> = {}) {
  const fixture = await fixtureRoom()
  const env = {} as Env
  const scheduleLensRounds = vi.fn(async () => true)
  const room = Object.assign(fixture.stub, { scheduleLensRounds })
  const full: McpDeps = {
    coachTurn: vi.fn(async () => COACH_REPLY),
    openingBrief: vi.fn(async () => ({ reply: 'Welcome, Casey. One thing first: what does "voice" mean to you?', ask: null })),
    ...deps,
  }
  const identity = { projectId: FIXTURE_PROJECT.id, room, participant: fixture.people.casey.participant }
  return { ...fixture, env, scheduleLensRounds, deps: full, context: { env, identity, deps: full } }
}

afterEach(() => vi.restoreAllMocks())

describe('open_room', () => {
  it('says who you are, shows the coach opening as written, then what is still open, most urgent first', async () => {
    const { context, deps, people, room } = await setup()
    await room.setQuestionPriorities([{ id: 1, priority: 3 }])
    const result = await openRoom(context)
    expect(result.isError).toBeUndefined()
    expect(result.text).toContain(`You're connected as Casey Sample, Marketing lead on the client side of "${FIXTURE_PROJECT.name}".`)
    expect(result.text).toContain(OPEN_ROOM_GUIDE)
    expect(result.text).toContain('The coach says:\n\nWelcome, Casey. One thing first: what does "voice" mean to you?\n\n')
    const open = result.text.slice(result.text.indexOf(OPEN_QUESTIONS_HEADING))
    expect(open).toContain('high (1) for "ask this next"')
    expect(open.split('\n').filter((line) => line.startsWith('- ')).map((line) => line.slice(0, line.indexOf(':')))).toEqual([
      '- q2, high (1) priority',
      '- q1, low (3) priority',
    ])
    expect(open).not.toMatch(/lens|CFO/i)
    expect(deps.openingBrief).toHaveBeenCalledWith(context.env, context.identity.room, people.casey.participant)
  })

  it('passes on a missing API key as a clear tool error', async () => {
    const { context } = await setup({ openingBrief: async () => Promise.reject(new ModelUnavailableError()) })
    expect(await openRoom(context)).toEqual({ text: new ModelUnavailableError().message, isError: true })
  })
})

describe('tell_coach', () => {
  it('hands the words over unchanged, returns the reply as written and has the room schedule lens rounds', async () => {
    const { context, deps, scheduleLensRounds, people } = await setup()
    const message = 'Launch is July.\n\nPasted brief:\nObjective: get kids drinking water.'
    expect(await tellCoach(context, message)).toEqual({ text: COACH_REPLY.reply })
    expect(deps.coachTurn).toHaveBeenCalledWith(context.env, context.identity.room, people.casey.participant, message)
    expect(scheduleLensRounds).toHaveBeenCalledOnce()
  })

  it('logs only the error name when the coach fails, and schedules no lens rounds', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { context, scheduleLensRounds } = await setup({ coachTurn: async () => Promise.reject(new TypeError('the request held: Launch is July')) })
    expect(await tellCoach(context, 'Launch is July.')).toEqual({ text: COACH_FAILED, isError: true })
    expect(scheduleLensRounds).not.toHaveBeenCalled()
    expect(JSON.stringify(log.mock.calls)).not.toContain('Launch')
  })

  it('still returns the reply when the room cannot schedule lens rounds', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { context, scheduleLensRounds } = await setup()
    scheduleLensRounds.mockRejectedValueOnce(new Error('Durable Object reset'))
    expect(await tellCoach(context, 'Launch is July.')).toEqual({ text: COACH_REPLY.reply })
  })

  it("passes on the coach's own failure message, which says the words were kept", async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new CoachError('The coach lost its thread. What you said is saved, so try again in a moment.')
    const { context } = await setup({ coachTurn: async () => Promise.reject(error) })
    expect(await tellCoach(context, 'Launch is July.')).toEqual({ text: error.message, isError: true })
    expect(log).not.toHaveBeenCalled()
  })
})

describe('read_room', () => {
  it('shows current facts by topic, marks proposed ones, and lists open questions without naming a lens', async () => {
    const { context, facts } = await setup()
    const { text } = await readRoom(context)
    expect(text.indexOf('## Background')).toBeLessThan(text.indexOf('## Budget'))
    expect(text).toContain(`f${facts.fortnightlyBoard!.id} The brand board signs off every creative change and meets every two weeks. Replaces f${facts.monthlyBoard!.id}. (from Casey Sample, client side)`)
    expect(text).not.toContain('meets once a month')
    expect(text).toContain(`f${facts.budgetGap!.id} Proposed, not confirmed yet: The two sides read the £60k differently`)
    expect(text).toContain(`worked out by the coach from f${facts.quoteCovers!.id} and f${facts.wholeBudget!.id}`)
    expect(text).toContain('- q1, high (1) priority: What the price covers (fundamental). The agency side said: "Hosting and app store fees sit outside that."')
    expect(text).toContain('- q2, high (1) priority: Still to hear from the client side: what happens if hosting pushes the total past £60k')
    expect(text.indexOf('- q1')).toBeLessThan(text.indexOf('- q2'))
    expect(text).not.toMatch(/lens|CFO/i)
  })

  it('lists only the open questions when asked, most urgent first', async () => {
    const { context, room } = await setup()
    await room.setQuestionPriorities([{ id: 1, priority: 3 }])
    const { text } = await readRoom(context, { onlyOpenQuestions: true })
    expect(text).not.toContain('## Budget')
    expect(text.indexOf('- q2, high (1) priority')).toBeLessThan(text.indexOf('- q1, low (3) priority'))
  })

  it('narrows to one topic, with the open questions that quote its facts', async () => {
    const { context } = await setup()
    const budget = (await readRoom(context, { topic: 'budget' })).text
    expect(budget).toContain('## Budget')
    expect(budget).not.toContain('## Timeline')
    expect(budget).toContain('What the price covers')

    const audience = (await readRoom(context, { topic: 'audience' })).text
    expect(audience).toContain('The game is for kids aged 6 to 10.')
    expect(audience).toContain(NO_OPEN_QUESTIONS)
  })

  it('says when the newest facts have not been checked yet', async () => {
    const { context } = await setup()
    expect((await readRoom(context)).text).toMatch(/Checked up to f\d+\. Anything newer is still being checked\./)

    const room = memoryRoom()
    await room.create({ ...FIXTURE_PROJECT, name: 'Unchecked' })
    const { participant } = await room.addParticipant({ name: 'Sam Madeup', persona: 'cfo', side: 'client' })
    const item = await room.addItem(participant.id, 'Budget is £10k.')
    await room.addFacts([
      { authorKind: 'person', participantId: participant.id, sourceItemId: item.id, sourceQuote: '£10k', status: 'confirmed', topic: 'budget', statement: 'The budget is £10k.' },
    ])
    const { text } = await readRoom({ ...context, identity: { ...context.identity, room: asStub(room), participant } })
    expect(text).toContain(NOT_CHECKED)
  })

  it('says so when the room has no project', async () => {
    const { context } = await setup()
    const result = await readRoom({ ...context, identity: { ...context.identity, room: asStub(memoryRoom()) } })
    expect(result).toEqual({ text: NO_PROJECT, isError: true })
  })
})
