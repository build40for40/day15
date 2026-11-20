// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { LensId } from '@day15/shared/lenses'
import type { LensReport } from '@day15/shared/schema'
import { memorySql } from '../testing'
import { listOpenQuestions, resolveQuestions, setQuestionPriorities } from './questions'
import { addFacts, addItem, addParticipant, createProject, saveLensRun } from './room'
import { migrate } from './schema'

const now = new Date('2026-11-20T10:00:00Z')

function room() {
  const sql = memorySql()
  migrate(sql)
  createProject(sql, { id: 'project-1', name: 'A fake biscuit site', ownerId: 'user_fake' }, now)
  const client = addParticipant(sql, { name: 'Casey Sample', persona: 'cfo', side: 'client' }, 'hash-c', now)
  const item = addItem(sql, client.id, 'The budget is £10k, fixed.', now)
  const [fact] = addFacts(
    sql,
    [{ authorKind: 'person', participantId: client.id, sourceItemId: item.id, sourceQuote: '£10k', status: 'confirmed', topic: 'budget', statement: 'The budget is £10k.' }],
    now,
  )
  const report = (lens: LensId, overrides: Partial<LensReport>) =>
    saveLensRun(sql, { lens, round: 1, watermark: 1, status: 'done', report: { coverage: [], conflicts: [], questions: [], done: false, ...overrides } }, now)
  return { sql, item, fact: fact!, report }
}

const price = { topic: 'Price', agency_said: 'build only (f1)', client_said: 'everything (f1)', priority: 2, note: 'Two projects.' }
const gap = { ask: 'client' as const, find_out: 'who holds the contingency', because: 'Nobody does.', priority: 2 }

const summary = (sql: ReturnType<typeof room>['sql']) =>
  listOpenQuestions(sql).map((question) => [question.id, question.kind, question.lens, question.priority])

describe('open questions', () => {
  it('takes the area a lens gives, else the area of the facts it cites, else its lens default', () => {
    const { sql, report } = room()
    report('procurement', { conflicts: [price], questions: [{ ...gap, area: 'dependencies_and_ownership' }] })
    report('agency', { questions: [{ ...gap, find_out: 'who signs' }] })
    expect(listOpenQuestions(sql).map((question) => [question.id, question.area])).toEqual([
      [2, 'dependencies_and_ownership'],
      [1, 'budget'],
      [3, 'ways_of_working'],
    ])
  })

  it('turns a report into rows, with the priority the lens gives and the facts it cites', () => {
    const { sql, report, fact } = room()
    const run = report('procurement', { conflicts: [{ ...price, priority: 1 }], questions: [{ ...gap, topic: 'Contingency' }] })
    expect(listOpenQuestions(sql)).toMatchObject([
      { id: 1, kind: 'conflict', lens: 'procurement', askSide: 'both', priority: 1, basedOn: [fact.id], raisedByRun: run.id },
      { id: 2, kind: 'gap', lens: 'procurement', askSide: 'client', priority: 2, statement: 'who holds the contingency', topic: 'Contingency' },
    ])
  })

  it('updates the row a lens names or repeats instead of adding it twice, taking the priority it gives now', () => {
    const { sql, report } = room()
    report('procurement', { conflicts: [price], questions: [gap] })
    report('procurement', { conflicts: [{ ...price, priority: 1, note: 'Worse now.' }], questions: [{ ...gap, priority: 3 }] })
    report('procurement', { questions: [{ ...gap, find_out: 'who holds the cushion', same_as: 'q2' }] })
    report('agency', { conflicts: [price] })
    expect(summary(sql)).toEqual([
      [1, 'conflict', 'procurement', 1],
      [2, 'gap', 'procurement', 2],
      [3, 'conflict', 'agency', 2],
    ])
    expect(listOpenQuestions(sql)[0]!.statement).toBe('Worse now.')
    expect(listOpenQuestions(sql)[1]!.statement).toBe('who holds the cushion')
  })

  it('lets a lens resolve only its own rows, and resolves all of them when it says it is done', () => {
    const { sql, report } = room()
    report('procurement', { conflicts: [price], questions: [gap] })
    report('agency', { questions: [{ ...gap, find_out: 'who signs' }] })
    report('agency', { resolved: ['q1', 'q3'] })
    expect(summary(sql).map(([id]) => id).sort()).toEqual([1, 2])
    report('procurement', { done: true })
    expect(listOpenQuestions(sql)).toEqual([])
  })

  it('moves open questions to the priority the coach sets, clamped, and leaves closed ones alone', () => {
    const { sql, report, item } = room()
    report('procurement', { conflicts: [price], questions: [gap] })
    expect(resolveQuestions(sql, [2, 2, 99], item.id, now)).toMatchObject([{ id: 2, status: 'resolved', resolvedByItem: item.id }])
    expect(setQuestionPriorities(sql, [{ id: 1, priority: 9 }, { id: 2, priority: 1 }], now)).toMatchObject([{ id: 1, priority: 3 }])
    expect(summary(sql)).toEqual([[1, 'conflict', 'procurement', 3]])
  })
})
