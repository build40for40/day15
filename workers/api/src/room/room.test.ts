// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { memorySql } from '../testing'
import {
  addAsk,
  addFacts,
  addItem,
  addParticipant,
  closeAsk,
  createProject,
  latestRuns,
  listAsks,
  readRoom,
  RoomError,
  saveLensRun,
} from './room'
import { migrate } from './schema'

const now = new Date('2026-11-20T10:00:00Z')

function room() {
  const sql = memorySql()
  migrate(sql)
  createProject(sql, { id: 'project-1', name: 'A fake biscuit site', ownerId: 'user_fake' }, now)
  const agency = addParticipant(sql, { name: 'Alex Example', persona: 'agency_lead', side: 'agency' }, 'hash-a', now)
  const client = addParticipant(sql, { name: 'Casey Sample', persona: 'cfo', side: 'client' }, 'hash-c', now)
  const item = addItem(sql, client.id, 'The budget is £10k, fixed.', now)
  return { sql, agency, client, item }
}

const personFact = (participantId: number, sourceItemId: number, statement: string, supersedes?: number) => ({
  authorKind: 'person' as const,
  participantId,
  sourceItemId,
  sourceQuote: '£10k, fixed',
  status: 'confirmed' as const,
  topic: 'budget' as const,
  statement,
  supersedes,
})

describe('the room', () => {
  it('keeps the first project and ignores a second create', () => {
    const { sql } = room()
    expect(createProject(sql, { id: 'project-2', name: 'Other', ownerId: 'user_other' }, now).id).toBe('project-1')
  })

  it("records each person fact with its author's side, item and quote", () => {
    const { sql, client, item } = room()
    const [fact] = addFacts(sql, [personFact(client.id, item.id, 'The budget is £10k and fixed.')], now)
    expect(fact).toMatchObject({
      id: 1,
      authorKind: 'person',
      side: 'client',
      participantId: client.id,
      sourceItemId: item.id,
      sourceQuote: '£10k, fixed',
      status: 'confirmed',
      lens: null,
    })
  })

  it('never edits a fact: a change is a new row that marks the old one superseded', () => {
    const { sql, client, item } = room()
    const [old] = addFacts(sql, [personFact(client.id, item.id, 'The budget is £10k.')], now)
    const [replacement] = addFacts(sql, [personFact(client.id, item.id, 'The budget is £12k.', old!.id)], now)
    const facts = readRoom(sql)!.facts
    expect(facts.map((fact) => [fact.id, fact.statement, fact.status, fact.supersededBy])).toEqual([
      [old!.id, 'The budget is £10k.', 'superseded', replacement!.id],
      [replacement!.id, 'The budget is £12k.', 'confirmed', null],
    ])
    expect(() => addFacts(sql, [personFact(client.id, item.id, 'Again.', old!.id)], now)).toThrow(RoomError)
  })

  it('tells lens facts from person facts and needs them to build on real facts', () => {
    const { sql, client, item } = room()
    const [base] = addFacts(sql, [personFact(client.id, item.id, 'The budget is £10k.')], now)
    const run = saveLensRun(sql, { lens: 'cfo', round: 1, watermark: base!.id, report: null, status: 'done' }, now)
    const lensFact = { authorKind: 'lens' as const, lensRunId: run.id, topic: 'budget' as const, statement: 'No cushion.' }
    const [fact] = addFacts(sql, [{ ...lensFact, basedOn: [base!.id] }], now)
    expect(fact).toMatchObject({ authorKind: 'lens', status: 'proposed', lens: 'cfo', side: null, basedOn: [base!.id] })
    expect(() => addFacts(sql, [{ ...lensFact, basedOn: [99] }], now)).toThrow('f99')
  })

  it('refuses facts that point at nothing', () => {
    const { sql, client } = room()
    expect(() => addFacts(sql, [personFact(client.id, 42, 'Nope.')], now)).toThrow('i42')
    expect(() => addFacts(sql, [personFact(42, 1, 'Nope.')], now)).toThrow('p42')
  })

  it('keeps the newest finished report of each lens', () => {
    const { sql } = room()
    const report = { coverage: [], conflicts: [], questions: [], done: false }
    saveLensRun(sql, { lens: 'cfo', round: 1, watermark: 0, report, status: 'done' }, now)
    const newer = saveLensRun(sql, { lens: 'cfo', round: 2, watermark: 0, report: { ...report, done: true }, status: 'done' }, now)
    saveLensRun(sql, { lens: 'cfo', round: 3, watermark: 0, report: null, status: 'failed' }, now)
    expect(latestRuns(sql)).toEqual({ cfo: newer })
  })

  it('opens asks for one person and closes each once, with the item that answered it', () => {
    const { sql, agency, client, item } = room()
    const ask = addAsk(sql, { addressedTo: client.id, ask: 'Is that with VAT?', because: 'It changes the total.', lens: 'cfo' }, now)
    addAsk(sql, { addressedTo: agency.id, ask: 'What does it cover?', because: '', lens: null }, now)
    expect(listAsks(sql, { addressedTo: client.id, status: 'open' }).map((open) => open.id)).toEqual([ask.id])

    const closed = closeAsk(sql, ask.id, { status: 'answered', answeredBy: item.id }, now)
    expect(closed).toMatchObject({ status: 'answered', answeredBy: item.id, closedAt: now.toISOString() })
    expect(closeAsk(sql, ask.id, { status: 'dropped' }, now)!.status).toBe('answered')
    expect(listAsks(sql, { status: 'open' }).map((open) => open.addressedTo)).toEqual([agency.id])
  })
})
