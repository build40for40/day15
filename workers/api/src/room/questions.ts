import { ALIGNMENT_AREAS, type AlignmentAreaId } from '@day15/shared/alignment'
import { areaRank, LENS_AREA, TOPIC_AREA } from '@day15/shared/areas'
import type { LensId } from '@day15/shared/lenses'
import { toPriority } from '@day15/shared/priorities'
import { parseRef } from '@day15/shared/refs'
import { ASK_SIDES, type LensReport, type LensRun, type OpenQuestion, type Topic } from '@day15/shared/schema'
import { all, first, type Sql } from './sql'

/** What the `lens` column holds for a question the coach raised itself. */
const COACH = 'coach'

type QuestionRow = {
  id: number
  kind: string
  lens: string
  topic: string
  area: string
  statement: string
  because: string
  agency_said: string | null
  client_said: string | null
  ask_side: string
  priority: number
  based_on: string
  rests_on_private: number
  status: string
  raised_by_run: number | null
  raised_by_item: number | null
  resolved_by_run: number | null
  resolved_by_item: number | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

const toQuestion = (row: QuestionRow): OpenQuestion => ({
  id: row.id,
  kind: row.kind as OpenQuestion['kind'],
  lens: row.lens === COACH ? null : (row.lens as LensId),
  topic: row.topic,
  area: row.area as AlignmentAreaId,
  statement: row.statement,
  because: row.because,
  agencySaid: row.agency_said,
  clientSaid: row.client_said,
  askSide: row.ask_side as OpenQuestion['askSide'],
  priority: row.priority,
  basedOn: JSON.parse(row.based_on) as number[],
  restsOnPrivate: row.rests_on_private === 1,
  status: row.status as OpenQuestion['status'],
  raisedByRun: row.raised_by_run,
  raisedByItem: row.raised_by_item,
  resolvedByRun: row.resolved_by_run,
  resolvedByItem: row.resolved_by_item,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  closedAt: row.closed_at,
})

const AREA_ORDER = `CASE area ${ALIGNMENT_AREAS.map((area, rank) => `WHEN '${area.id}' THEN ${rank}`).join(' ')} ELSE ${ALIGNMENT_AREAS.length} END`

/** Priority first, then the area's rank in the mother agent's matrix, then conflicts before gaps, then oldest. */
const MOST_URGENT_FIRST = `ORDER BY priority, ${AREA_ORDER}, CASE kind WHEN 'conflict' THEN 0 ELSE 1 END, id`

export function listOpenQuestions(sql: Sql): OpenQuestion[] {
  return all<QuestionRow>(sql, `SELECT * FROM open_questions WHERE status = 'open' ${MOST_URGENT_FIRST}`).map(
    toQuestion,
  )
}

export function getQuestion(sql: Sql, id: number): OpenQuestion | null {
  const row = first<QuestionRow>(sql, 'SELECT * FROM open_questions WHERE id = ?', id)
  return row ? toQuestion(row) : null
}

const normalise = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()

type Raised = Omit<
  OpenQuestion,
  | 'id'
  | 'lens'
  | 'status'
  | 'raisedByRun'
  | 'raisedByItem'
  | 'resolvedByRun'
  | 'resolvedByItem'
  | 'createdAt'
  | 'updatedAt'
  | 'closedAt'
> & {
  sameAs: number | null
}

/** The same thing twice: a conflict on the same topic in the same words, or a gap asking the same side the same thing. */
const sameThing = (a: Pick<OpenQuestion, 'kind' | 'topic' | 'statement' | 'agencySaid' | 'clientSaid' | 'askSide'>) =>
  a.kind === 'conflict'
    ? ['conflict', a.topic, a.agencySaid ?? '', a.clientSaid ?? ''].map(normalise).join('|')
    : ['gap', a.askSide, a.statement].map(normalise).join('|')

function citedFacts(texts: string[], facts: Map<number, Topic>): number[] {
  const ids = texts.flatMap((text) => text.match(/\bf\d+\b/gi) ?? []).map((value) => parseRef('fact', value))
  return [...new Set(ids)].filter((id): id is number => id !== null && facts.has(id))
}

/**
 * The lens's own area, else the area most of the facts it cites belong to (the higher ranked on a tie), else the
 * area its lens mostly speaks to.
 */
export function areaFor(
  given: AlignmentAreaId | undefined,
  basedOn: number[],
  facts: Map<number, Topic>,
  lens: LensId,
): AlignmentAreaId {
  if (given) return given
  const counts = new Map<AlignmentAreaId, number>()
  for (const id of basedOn) {
    const area = TOPIC_AREA[facts.get(id)!]
    counts.set(area, (counts.get(area) ?? 0) + 1)
  }
  const [best] = [...counts].sort(([a, x], [b, y]) => y - x || areaRank(a) - areaRank(b))
  return best?.[0] ?? LENS_AREA[lens]
}

function raisedBy(report: LensReport, facts: Map<number, Topic>, lens: LensId): Raised[] {
  const sameAs = (value: string | null | undefined) => (value ? parseRef('question', value) : null)
  const withArea = (raised: Omit<Raised, 'area'>, given: AlignmentAreaId | undefined): Raised => ({
    ...raised,
    area: areaFor(given, raised.basedOn, facts, lens),
  })
  return [
    ...report.conflicts.map((conflict) =>
      withArea(
        {
          kind: 'conflict' as const,
          topic: conflict.topic.trim(),
          statement: conflict.note.trim(),
          because: '',
          agencySaid: conflict.agency_said.trim(),
          clientSaid: conflict.client_said.trim(),
          askSide: 'both' as const,
          priority: toPriority(conflict.priority),
          basedOn: citedFacts([conflict.agency_said, conflict.client_said, conflict.note], facts),
          restsOnPrivate: !!conflict.rests_on_private,
          sameAs: sameAs(conflict.same_as),
        },
        conflict.area,
      ),
    ),
    ...report.questions.map((question) =>
      withArea(
        {
          kind: 'gap' as const,
          topic: (question.topic ?? '').trim(),
          statement: question.find_out.trim(),
          because: question.because.trim(),
          agencySaid: null,
          clientSaid: null,
          askSide: question.ask,
          priority: toPriority(question.priority),
          basedOn: citedFacts([question.find_out, question.because], facts),
          restsOnPrivate: !!question.rests_on_private,
          sameAs: sameAs(question.same_as),
        },
        question.area,
      ),
    ),
  ]
}

/**
 * Turns one saved lens report into open questions. Each conflict and question updates the lens's own open row it
 * names with `same_as`, or one it already has for the same thing, taking the priority the lens gives it now, and is
 * added as a new row otherwise. The report then resolves the rows it lists in `resolved`, and all its other rows when
 * it says it is done. Only a lens's own rows are touched.
 */
export function recordLensReport(sql: Sql, run: LensRun, now: Date): void {
  const report = run.report
  if (run.status !== 'done' || !report) return
  const at = now.toISOString()
  const facts = new Map(
    all<{ id: number; topic: string }>(sql, 'SELECT id, topic FROM facts').map((row) => [row.id, row.topic as Topic]),
  )
  const open = all<QuestionRow>(sql, `SELECT * FROM open_questions WHERE status = 'open' AND lens = ?`, run.lens).map(
    toQuestion,
  )
  const touched = new Set<number>()

  for (const raised of raisedBy(report, facts, run.lens)) {
    const key = sameThing(raised)
    const existing = open.find(
      (row) => !touched.has(row.id) && row.kind === raised.kind && (row.id === raised.sameAs || sameThing(row) === key),
    )
    const values = [
      raised.topic,
      raised.area,
      raised.statement,
      raised.because,
      raised.agencySaid,
      raised.clientSaid,
      raised.askSide,
      raised.priority,
      JSON.stringify(raised.basedOn),
      raised.restsOnPrivate ? 1 : 0,
    ]
    if (existing) {
      sql.exec(
        `UPDATE open_questions SET topic = ?, area = ?, statement = ?, because = ?, agency_said = ?, client_said = ?,
           ask_side = ?, priority = ?, based_on = ?, rests_on_private = ?, updated_at = ? WHERE id = ?`,
        ...values,
        at,
        existing.id,
      )
      touched.add(existing.id)
    } else {
      sql.exec(
        `INSERT INTO open_questions (topic, area, statement, because, agency_said, client_said, ask_side, priority,
           based_on, rests_on_private, kind, lens, raised_by_run, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...values,
        raised.kind,
        run.lens,
        run.id,
        at,
        at,
      )
    }
  }

  const resolved = new Set((report.resolved ?? []).map((value) => parseRef('question', value)))
  for (const row of open) {
    if (!resolved.has(row.id) && !(report.done && !touched.has(row.id))) continue
    sql.exec(
      `UPDATE open_questions SET status = 'resolved', resolved_by_run = ?, updated_at = ?, closed_at = ? WHERE id = ?`,
      run.id,
      at,
      at,
      row.id,
    )
  }
}

/** Moves open questions to a new priority. Closed ones and unknown ids are skipped. */
export function setQuestionPriorities(
  sql: Sql,
  changes: { id: number; priority: number }[],
  now: Date,
): OpenQuestion[] {
  const at = now.toISOString()
  return changes.flatMap(({ id, priority }) => {
    sql.exec(
      `UPDATE open_questions SET priority = ?, updated_at = ? WHERE id = ? AND status = 'open'`,
      toPriority(priority),
      at,
      id,
    )
    const row = getQuestion(sql, id)
    return row?.status === 'open' ? [row] : []
  })
}

/** Resolves open questions that a person's answer settles. Returns the ones it closed. */
export function resolveQuestions(sql: Sql, ids: number[], itemId: number, now: Date): OpenQuestion[] {
  const at = now.toISOString()
  return ids.flatMap((id) => {
    const row = getQuestion(sql, id)
    if (row?.status !== 'open') return []
    sql.exec(
      `UPDATE open_questions SET status = 'resolved', resolved_by_item = ?, updated_at = ?, closed_at = ? WHERE id = ?`,
      itemId,
      at,
      at,
      id,
    )
    return [getQuestion(sql, id)!]
  })
}

/** An open question the coach raises itself, from a signal no lens has raised. */
export interface CoachQuestion {
  area: AlignmentAreaId
  statement: string
  askSide: (typeof ASK_SIDES)[number]
  priority: number
}

/** Adds the coach's own open questions, as gaps with no lens, raised by what a person said. */
export function raiseQuestions(sql: Sql, questions: CoachQuestion[], itemId: number, now: Date): OpenQuestion[] {
  const at = now.toISOString()
  return questions.map((question) => {
    const row = first<{ id: number }>(
      sql,
      `INSERT INTO open_questions (kind, lens, topic, area, statement, ask_side, priority, raised_by_item, created_at,
         updated_at)
       VALUES ('gap', ?, '', ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      COACH,
      question.area,
      question.statement,
      question.askSide,
      toPriority(question.priority),
      itemId,
      at,
      at,
    )!
    return getQuestion(sql, row.id)!
  })
}
