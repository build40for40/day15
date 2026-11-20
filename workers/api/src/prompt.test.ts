// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { LENS_IDS } from '@day15/shared/lenses'
import type { PersonaReport } from '@day15/shared/schema'
import { harnessPrompt, PERSONAS } from './harness'
import { instructions, messages } from './prompt'
import { emptyRoom, freshReports, mySide, pend, record, upgrade, version, withReports, type Room } from './room'

const turn = { lens: 'ops' as const, question: 'What does done look like?', answer: 'It is live by March.' }

const opsReport: PersonaReport = {
  requirements: [{ requirement: 'The fee is fixed at 60k.', from: 'both' }],
  coverage: [{ topic: 'What the price covers', agency: 'thin', client: 'missing' }],
  conflicts: [
    {
      topic: 'What the price covers',
      agency_said: 'Photos are extra.',
      client_said: 'Everything is included.',
      severity: 'fundamental',
      note: 'They are pricing different projects.',
    },
  ],
  questions: [
    { ask: 'client', find_out: 'what they believe the price includes.', because: 'It is unclear.', priority: 1 },
    { ask: 'agency', find_out: 'what would trigger extra cost.', because: 'Nobody said.', priority: 2 },
  ],
  education: [
    {
      for: 'client',
      topic: 'Running costs',
      why_it_matters: 'They decide whether it lasts.',
      arguments: ['Hosting is a yearly bill.'],
    },
    { for: 'agency', topic: 'Sign-off', why_it_matters: 'It ends the job.', arguments: ['One name.'] },
  ],
  done: false,
}

describe('persona harnesses', () => {
  it('loads an Actor, Instructions and Mission for every lens', () => {
    for (const lens of LENS_IDS) {
      for (const part of ['## Actor', '## Instructions', '## Mission']) expect(PERSONAS[lens]).toContain(part)
    }
    expect(LENS_IDS).toEqual(['client', 'agency', 'ops'])
    expect(PERSONAS.ops).toContain('# Delivery, procurement and finance persona harness')
  })

  it('fills the wrapper with the persona and what both sides have said', () => {
    const room = record(emptyRoom(), 'agency', 'A fictional biscuit site.', turn)
    const prompt = harnessPrompt('ops', room)
    expect(prompt).not.toContain('{{')
    expect(prompt).toContain('# Delivery, procurement and finance persona harness')
    expect(prompt).toContain('Their description of the project: A fictional biscuit site.')
    expect(prompt).toContain('Asked: What does done look like?\nAnswered: It is live by March.')
    expect(prompt).toContain('<client_side>\nThis side has not spoken to the coach yet.')
  })
})

describe('mother agent prompt', () => {
  const room = record(emptyRoom(), 'client', 'A fictional biscuit site.', turn)
  const text = instructions('client', room, { ops: opsReport })

  it('starts from the mother agent file, Actor, Instructions and Mission', () => {
    expect(text.startsWith('# Mother agent')).toBe(true)
    for (const part of ['## Actor', '## Instructions', '## Mission']) expect(text).toContain(part)
  })

  it("adds each persona agent's requirements and conflicts, and only this side's questions", () => {
    expect(text).toContain('someone on the client side')
    expect(text).toContain('### ops (Delivery, procurement and finance)')
    expect(text).toContain('- (both) The fee is fixed at 60k.')
    expect(text).toContain('fundamental conflict on "What the price covers"')
    expect(text).toContain('find out what they believe the price includes.')
    expect(text).not.toContain('what would trigger extra cost')
    expect(text).toContain('Not yet settled on the client side: What the price covers (missing).')
    expect(text).toContain('in order: ops.')
  })

  it('passes on what this side could do with understanding, and only this side', () => {
    expect(text).toContain('Thinks the client side could do with understanding:')
    expect(text).toContain('Running costs: They decide whether it lasts. Arguments they could use: Hosting is a yearly bill.')
    expect(text).not.toContain('It ends the job.')
    expect(text).toContain('### Educating, discreetly')
  })

  it('keeps the persona agents and the other side secret', () => {
    expect(text).toContain('Never name a persona agent')
    expect(text).toContain('Never quote it')
    expect(text).toContain('Reply with "rationale" first')
  })

  it("sends only this side's own conversation as messages, ending on their last answer", () => {
    const result = messages(room.sides.client!)
    expect(result.map((message) => message.role)).toEqual(['user', 'assistant', 'user'])
    expect(result[1]!.content).toBe('What does done look like?')
    expect(result[2]!.content).toBe('It is live by March.')
  })
})

describe('room', () => {
  it("keeps a side's first description and adds its turns", () => {
    let room = record(emptyRoom(), 'client', 'First words.')
    room = record(room, 'client', 'Different words.', turn)
    expect(room.sides.client).toEqual({
      project: 'First words.',
      turns: [{ ...turn, note: undefined, rationale: undefined }],
    })
  })

  it("never hands one side the other's words", () => {
    const room = record(emptyRoom(), 'agency', 'Agency secrets.', turn)
    expect(mySide(room, 'client')).toEqual({ project: '', turns: [], otherSideStarted: true })
    expect(mySide(room, 'agency').otherSideStarted).toBe(false)
  })

  it("files the brain's reasoning with the answer and keeps it away from both sides", () => {
    let room = record(emptyRoom(), 'agency', 'A fictional biscuit site.')
    room = pend(room, 'agency', { lens: 'ops', question: turn.question, rationale: 'The client expects more.' })
    expect(room.sides.agency!.pending!.rationale).toBe('The client expects more.')

    room = record(room, 'agency', 'A fictional biscuit site.', turn)
    expect(room.sides.agency!.pending).toBeUndefined()
    expect(room.sides.agency!.turns[0]!.rationale).toBe('The client expects more.')
    expect(JSON.stringify(mySide(room, 'agency'))).not.toContain('The client expects more.')
  })

  it('keeps what the coach explained with the question it came before', () => {
    let room = record(emptyRoom(), 'client', 'A fictional app.')
    room = pend(room, 'client', { lens: 'ops', question: turn.question, rationale: 'Why.', note: 'Hosting is a yearly bill.' })
    room = record(room, 'client', 'A fictional app.', turn)
    expect(mySide(room, 'client').turns[0]!.note).toBe('Hosting is a yearly bill.')
    expect(messages(room.sides.client!)[1]!.content).toBe('Hosting is a yearly bill.\n\nWhat does done look like?')
  })

  it('keeps the waiting question when a side only reloads', () => {
    let room = record(emptyRoom(), 'client', 'A fictional app.')
    room = pend(room, 'client', { lens: 'ops', question: 'Who pays?', rationale: 'Nobody said.' })
    expect(record(room, 'client', 'A fictional app.').sides.client!.pending!.question).toBe('Who pays?')
  })

  it('reuses reports on a reload and drops them once either side says something new', () => {
    let room = record(emptyRoom(), 'client', 'A fictional app.')
    room = withReports(room, { ops: opsReport })
    expect(freshReports(record(room, 'client', 'A fictional app.'))).toEqual({ ops: opsReport })
    expect(freshReports(record(room, 'client', 'A fictional app.', turn))).toBeUndefined()
    expect(freshReports(record(room, 'agency', 'The other side arrives.'))).toBeUndefined()
    expect(version(room)).toBe('-:0')
    expect(JSON.stringify(mySide(room, 'client'))).not.toContain('Photos are extra')
  })

  it('brings a room from the five-persona days up to date', () => {
    const old = {
      sides: {
        agency: {
          project: 'A fictional app.',
          turns: [
            { lens: 'cfo', question: 'Who pays?', answer: 'We do.' },
            { lens: 'agency', question: 'Who decides?', answer: 'Them.' },
          ],
          pending: { lens: 'procurement', question: 'What is written down?', rationale: 'Nothing is.' },
        },
      },
      reports: { version: '2:-', byLens: { cto: opsReport } },
    } as unknown as Room
    const room = upgrade(old)
    expect(room.sides.agency!.turns.map((entry) => entry.lens)).toEqual(['ops', 'agency'])
    expect(room.sides.agency!.pending!.lens).toBe('ops')
    expect(room.reports).toBeUndefined()
  })
})
