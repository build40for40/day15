// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CoachError } from '../coach'
import type { Env } from '../contracts'
import { ModelUnavailableError } from '../model'
import { FIXTURE_PROJECT } from '../room/fixture'
import { asStub, fixtureRoom, memoryRoom } from '../testing'
import { COACH_FAILED, NO_CONFLICTS, NO_PROJECT, NOT_CHECKED, OPEN_ROOM_GUIDE } from './text'
import { openRoom, readRoom, tellCoach, type McpDeps } from './tools'

const COACH_REPLY = { reply: 'Noted: launch in July.\n\nWhat does done look like for the board?', itemId: 1, noted: [], closed: [], ask: null }

async function setup(deps: Partial<McpDeps> = {}) {
  const fixture = await fixtureRoom()
  const env = {} as Env
  const ctx = { waitUntil: vi.fn() }
  const full: McpDeps = {
    coachTurn: vi.fn(async () => COACH_REPLY),
    openingBrief: vi.fn(async () => ({ reply: 'Welcome, Casey. One thing first: what does "voice" mean to you?', ask: null })),
    runLensRounds: vi.fn(async () => {}),
    ...deps,
  }
  const identity = { projectId: FIXTURE_PROJECT.id, room: fixture.stub, participant: fixture.people.casey.participant }
  return { ...fixture, env, ctx, deps: full, context: { env, ctx, identity, deps: full } }
}

afterEach(() => vi.restoreAllMocks())

describe('open_room', () => {
  it('says who you are, then shows the coach opening as written', async () => {
    const { context, deps, people } = await setup()
    const result = await openRoom(context)
    expect(result.isError).toBeUndefined()
    expect(result.text).toContain(`You're connected as Casey Sample, Marketing lead on the client side of "${FIXTURE_PROJECT.name}".`)
    expect(result.text).toContain(OPEN_ROOM_GUIDE)
    expect(result.text.endsWith('Welcome, Casey. One thing first: what does "voice" mean to you?')).toBe(true)
    expect(deps.openingBrief).toHaveBeenCalledWith(context.env, context.identity.room, people.casey.participant)
  })

  it('passes on a missing API key as a clear tool error', async () => {
    const { context } = await setup({ openingBrief: async () => Promise.reject(new ModelUnavailableError()) })
    expect(await openRoom(context)).toEqual({ text: new ModelUnavailableError().message, isError: true })
  })
})

describe('tell_coach', () => {
  it('hands the words over unchanged, returns the reply as written and starts lens rounds in the background', async () => {
    const { context, deps, ctx, people } = await setup()
    const message = 'Launch is July.\n\nPasted brief:\nObjective: get kids drinking water.'
    expect(await tellCoach(context, message)).toEqual({ text: COACH_REPLY.reply })
    expect(deps.coachTurn).toHaveBeenCalledWith(context.env, context.identity.room, people.casey.participant, message)
    expect(ctx.waitUntil).toHaveBeenCalledOnce()
    expect(deps.runLensRounds).toHaveBeenCalledWith(context.env, context.identity.room)
  })

  it('logs only the error name when the coach fails, and starts no lens rounds', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { context, ctx } = await setup({ coachTurn: async () => Promise.reject(new TypeError('the request held: Launch is July')) })
    expect(await tellCoach(context, 'Launch is July.')).toEqual({ text: COACH_FAILED, isError: true })
    expect(ctx.waitUntil).not.toHaveBeenCalled()
    expect(JSON.stringify(log.mock.calls)).not.toContain('Launch')
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
  it('shows current facts by topic, marks proposed ones, and lists conflicts without naming a lens', async () => {
    const { context, facts } = await setup()
    const { text } = await readRoom(context)
    expect(text.indexOf('## Background')).toBeLessThan(text.indexOf('## Budget'))
    expect(text).toContain(`f${facts.fortnightlyBoard!.id} The brand board signs off every creative change and meets every two weeks. Replaces f${facts.monthlyBoard!.id}. (from Casey Sample, client side)`)
    expect(text).not.toContain('meets once a month')
    expect(text).toContain(`f${facts.budgetGap!.id} Proposed, not confirmed yet: The two sides read the £60k differently`)
    expect(text).toContain(`worked out by the coach from f${facts.quoteCovers!.id} and f${facts.wholeBudget!.id}`)
    expect(text).toContain('What the price covers (fundamental). The agency side said: "Hosting and app store fees sit outside that."')
    expect(text).not.toMatch(/lens|CFO/i)
  })

  it('narrows to one topic, with the conflicts that quote its facts', async () => {
    const { context } = await setup()
    const budget = (await readRoom(context, 'budget')).text
    expect(budget).toContain('## Budget')
    expect(budget).not.toContain('## Timeline')
    expect(budget).toContain('What the price covers')

    const audience = (await readRoom(context, 'audience')).text
    expect(audience).toContain('The game is for kids aged 6 to 10.')
    expect(audience).toContain(NO_CONFLICTS)
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
