import { assessmentSchema, type Assessment } from '@day15/shared/alignment'
import { LENS_IDS, type LensId } from '@day15/shared/lenses'
import {
  lensReportSchema,
  newAskSchema,
  newFactSchema,
  newLensRunSchema,
  newParticipantSchema,
  participantUpdateSchema,
  MAX_ITEM_LENGTH,
  PERSONA_LENS,
  type AddedBy,
  type Ask,
  type AskStatus,
  type CloseAsk,
  type Fact,
  type Item,
  type LensRun,
  type NewAsk,
  type NewFact,
  type NewLensRun,
  type NewParticipant,
  type Participant,
  type ParticipantUpdate,
  type Persona,
  type Project,
  type RoomSnapshot,
  type Side,
  type Topic,
} from '@day15/shared/schema'
import { listOpenQuestions, recordLensReport } from './questions'
import { all, first, type Sql } from './sql'

/** A request the room refuses. The message is safe to show. */
export class RoomError extends Error {
  override name = 'RoomError'
}

type ProjectRow = { id: string; name: string; owner_id: string; created_at: string }
type ParticipantRow = {
  id: number
  side: string
  persona: string
  name: string
  job_title: string
  organisation: string
  lenses: string
  notes: string
  has_link: number
  added_by: string
  created_at: string
  removed_at: string | null
}
type ItemRow = { id: number; participant_id: number; text: string; created_at: string }
type FactRow = {
  id: number
  topic: string
  statement: string
  status: string
  author_kind: string
  participant_id: number | null
  lens_run_id: number | null
  lens: string | null
  side: string | null
  source_item_id: number | null
  source_quote: string | null
  based_on: string
  supersedes: number | null
  superseded_by: number | null
  created_at: string
}
type LensRunRow = {
  id: number
  lens: string
  round: number
  watermark: number
  report: string | null
  status: string
  created_at: string
}
type AskRow = {
  id: number
  addressed_to: number
  ask: string
  because: string
  lens: string | null
  status: string
  answered_by: number | null
  created_at: string
  closed_at: string | null
  question_id: number | null
}

const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  ownerId: row.owner_id,
  createdAt: row.created_at,
})

const toParticipant = (row: ParticipantRow): Participant => {
  const lenses = JSON.parse(row.lenses) as string[]
  return {
    id: row.id,
    side: row.side as Side,
    persona: row.persona as Persona,
    name: row.name,
    jobTitle: row.job_title,
    organisation: row.organisation,
    lenses: LENS_IDS.filter((lens) => lenses.includes(lens)),
    notes: row.notes,
    hasLink: row.has_link === 1,
    addedBy: row.added_by as AddedBy,
    createdAt: row.created_at,
    removedAt: row.removed_at,
  }
}

const toItem = (row: ItemRow): Item => ({
  id: row.id,
  participantId: row.participant_id,
  text: row.text,
  createdAt: row.created_at,
})

const toFact = (row: FactRow): Fact => ({
  id: row.id,
  topic: row.topic as Topic,
  statement: row.statement,
  status: row.superseded_by ? 'superseded' : (row.status as Fact['statedAs']),
  statedAs: row.status as Fact['statedAs'],
  authorKind: row.author_kind as Fact['authorKind'],
  participantId: row.participant_id,
  lensRunId: row.lens_run_id,
  lens: row.lens as LensId | null,
  side: row.side as Side | null,
  sourceItemId: row.source_item_id,
  sourceQuote: row.source_quote,
  basedOn: JSON.parse(row.based_on) as number[],
  supersedes: row.supersedes,
  supersededBy: row.superseded_by,
  createdAt: row.created_at,
})

const toLensRun = (row: LensRunRow): LensRun => ({
  id: row.id,
  lens: row.lens as LensId,
  round: row.round,
  watermark: row.watermark,
  report: row.report ? lensReportSchema.parse(JSON.parse(row.report)) : null,
  status: row.status as LensRun['status'],
  createdAt: row.created_at,
})

const toAsk = (row: AskRow): Ask => ({
  id: row.id,
  addressedTo: row.addressed_to,
  ask: row.ask,
  because: row.because,
  lens: row.lens as LensId | null,
  status: row.status as AskStatus,
  answeredBy: row.answered_by,
  createdAt: row.created_at,
  closedAt: row.closed_at,
  questionId: row.question_id,
})

const FACTS = `
  SELECT f.*, r.lens AS lens, later.id AS superseded_by
  FROM facts f
  LEFT JOIN lens_runs r ON r.id = f.lens_run_id
  LEFT JOIN facts later ON later.supersedes = f.id`

export function readProject(sql: Sql): Project | null {
  const row = first<ProjectRow>(sql, 'SELECT id, name, owner_id, created_at FROM project')
  return row ? toProject(row) : null
}

/** Makes the project once. A second call leaves the first one as it was. */
export function createProject(sql: Sql, input: { id: string; name: string; ownerId: string }, now: Date): Project {
  sql.exec(
    'INSERT INTO project (singleton, id, name, owner_id, created_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
    input.id,
    input.name.trim(),
    input.ownerId,
    now.toISOString(),
  )
  return readProject(sql)!
}

const PARTICIPANT = `SELECT id, side, persona, name, job_title, organisation, lenses, notes, has_link, added_by, created_at,
  removed_at FROM participants`

/** Old rooms keep `key_hash` NOT NULL UNIQUE, so a person with no link holds a value no secret ever hashes to. */
const noKeyHash = () => `none:${crypto.randomUUID()}`

/** The people on the project now. Removed people stay in the table, since facts and asks point at them. */
export function listParticipants(sql: Sql): Participant[] {
  return all<ParticipantRow>(sql, `${PARTICIPANT} WHERE removed_at IS NULL ORDER BY id`).map(toParticipant)
}

export function getParticipant(sql: Sql, id: number): Participant | null {
  const row = first<ParticipantRow>(sql, `${PARTICIPANT} WHERE id = ? AND removed_at IS NULL`, id)
  return row ? toParticipant(row) : null
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function findParticipantByName(sql: Sql, name: string, side: Side): Participant | null {
  return listParticipants(sql).find((person) => person.side === side && sameName(person.name, name)) ?? null
}

/** Stores only the hash of the person's key. A null hash adds them with no link. */
export function addParticipant(
  sql: Sql,
  input: NewParticipant,
  keyHash: string | null,
  now: Date,
  addedBy: AddedBy = 'owner',
): Participant {
  const person = newParticipantSchema.parse(input)
  const row = first<{ id: number }>(
    sql,
    `INSERT INTO participants (side, persona, name, job_title, organisation, lenses, notes, key_hash, has_link, added_by,
       created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    person.side,
    person.persona,
    person.name,
    person.jobTitle ?? '',
    person.organisation ?? '',
    JSON.stringify(person.lenses ?? [PERSONA_LENS[person.persona]]),
    person.notes ?? '',
    keyHash ?? noKeyHash(),
    keyHash ? 1 : 0,
    addedBy,
    now.toISOString(),
  )!
  return getParticipant(sql, row.id)!
}

/** Changes only the fields given. Returns null when there is no such person on the project. */
export function updateParticipant(sql: Sql, participantId: number, input: ParticipantUpdate): Participant | null {
  const current = getParticipant(sql, participantId)
  if (!current) return null
  const changes = Object.entries(participantUpdateSchema.parse(input)).filter(([, value]) => value !== undefined)
  const next: Participant = { ...current, ...Object.fromEntries(changes) }
  sql.exec(
    `UPDATE participants SET side = ?, persona = ?, name = ?, job_title = ?, organisation = ?, lenses = ?, notes = ?
     WHERE id = ?`,
    next.side,
    next.persona,
    next.name,
    next.jobTitle,
    next.organisation,
    JSON.stringify(next.lenses),
    next.notes,
    participantId,
  )
  return getParticipant(sql, participantId)
}

/** Gives a person a new key hash, which also gives a link to someone who had none. */
export function replaceKeyHash(sql: Sql, participantId: number, keyHash: string): Participant | null {
  sql.exec('UPDATE participants SET key_hash = ?, has_link = 1 WHERE id = ? AND removed_at IS NULL', keyHash, participantId)
  return getParticipant(sql, participantId)
}

/**
 * Takes a person off the project without deleting them, so their facts keep their source. Their key stops working
 * at once and their open asks are dropped. Returns the removed person, or null when there was nobody to remove.
 */
export function removeParticipant(sql: Sql, participantId: number, now: Date): Participant | null {
  if (!getParticipant(sql, participantId)) return null
  const at = now.toISOString()
  sql.exec(
    'UPDATE participants SET removed_at = ?, has_link = 0, key_hash = ? WHERE id = ?',
    at,
    noKeyHash(),
    participantId,
  )
  sql.exec(
    `UPDATE asks SET status = 'dropped', closed_at = ? WHERE addressed_to = ? AND status = 'open'`,
    at,
    participantId,
  )
  const row = first<ParticipantRow>(sql, `${PARTICIPANT} WHERE id = ?`, participantId)
  return row ? toParticipant(row) : null
}

export function findParticipantByKeyHash(sql: Sql, keyHash: string): Participant | null {
  const row = first<ParticipantRow>(
    sql,
    `${PARTICIPANT} WHERE key_hash = ? AND has_link = 1 AND removed_at IS NULL`,
    keyHash,
  )
  return row ? toParticipant(row) : null
}

export function addItem(sql: Sql, participantId: number, text: string, now: Date): Item {
  const trimmed = text.trim()
  if (!trimmed) throw new RoomError('There is nothing in that to keep.')
  if (trimmed.length > MAX_ITEM_LENGTH) throw new RoomError(`Keep it under ${MAX_ITEM_LENGTH} characters.`)
  if (!getParticipant(sql, participantId)) throw new RoomError(`There is no person p${participantId} here.`)
  const row = first<ItemRow>(
    sql,
    'INSERT INTO items (participant_id, text, created_at) VALUES (?, ?, ?) RETURNING *',
    participantId,
    trimmed,
    now.toISOString(),
  )!
  return toItem(row)
}

export function listItems(sql: Sql): Item[] {
  return all<ItemRow>(sql, 'SELECT * FROM items ORDER BY id').map(toItem)
}

export function listFacts(sql: Sql): Fact[] {
  return all<FactRow>(sql, `${FACTS} ORDER BY f.id`).map(toFact)
}

function factById(sql: Sql, id: number): Fact | null {
  const row = first<FactRow>(sql, `${FACTS} WHERE f.id = ?`, id)
  return row ? toFact(row) : null
}

/**
 * Adds facts in order, so a later one in the batch may supersede an earlier one by its new id.
 * Checks everything a fact points at before writing it: the person, the item, the lens run, the facts it builds on.
 */
export function addFacts(sql: Sql, input: NewFact[], now: Date): Fact[] {
  const added: Fact[] = []
  for (const raw of input) {
    const fact = newFactSchema.parse(raw)
    const basedOn = fact.basedOn ?? []
    for (const id of basedOn) if (!factById(sql, id)) throw new RoomError(`There is no fact f${id} to build on.`)
    if (fact.supersedes) {
      const old = factById(sql, fact.supersedes)
      if (!old) throw new RoomError(`There is no fact f${fact.supersedes} to replace.`)
      if (old.supersededBy) throw new RoomError(`f${old.id} was already replaced by f${old.supersededBy}.`)
    }

    let row: { id: number } | undefined
    if (fact.authorKind === 'person') {
      const person = getParticipant(sql, fact.participantId)
      if (!person) throw new RoomError(`There is no person p${fact.participantId} here.`)
      if (!first(sql, 'SELECT id FROM items WHERE id = ?', fact.sourceItemId)) {
        throw new RoomError(`There is no item i${fact.sourceItemId} to quote.`)
      }
      row = first<{ id: number }>(
        sql,
        `INSERT INTO facts (topic, statement, status, author_kind, participant_id, side, source_item_id, source_quote,
           based_on, supersedes, created_at)
         VALUES (?, ?, ?, 'person', ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        fact.topic,
        fact.statement,
        fact.status,
        person.id,
        person.side,
        fact.sourceItemId,
        fact.sourceQuote,
        JSON.stringify(basedOn),
        fact.supersedes ?? null,
        now.toISOString(),
      )
    } else {
      if (!first(sql, 'SELECT id FROM lens_runs WHERE id = ?', fact.lensRunId)) {
        throw new RoomError(`There is no lens run r${fact.lensRunId}.`)
      }
      row = first<{ id: number }>(
        sql,
        `INSERT INTO facts (topic, statement, status, author_kind, lens_run_id, based_on, supersedes, created_at)
         VALUES (?, ?, 'proposed', 'lens', ?, ?, ?, ?) RETURNING id`,
        fact.topic,
        fact.statement,
        fact.lensRunId,
        JSON.stringify(basedOn),
        fact.supersedes ?? null,
        now.toISOString(),
      )
    }
    added.push(factById(sql, row!.id)!)
  }
  return added
}

/** Keeps the report as it came, and turns its conflicts and questions into open questions. Run it in a transaction. */
export function saveLensRun(sql: Sql, input: NewLensRun, now: Date): LensRun {
  const run = newLensRunSchema.parse(input)
  const row = first<LensRunRow>(
    sql,
    'INSERT INTO lens_runs (lens, round, watermark, report, status, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    run.lens,
    run.round,
    run.watermark,
    run.report ? JSON.stringify(run.report) : null,
    run.status,
    now.toISOString(),
  )!
  const saved = toLensRun(row)
  recordLensReport(sql, saved, now)
  return saved
}

/** The newest finished run of each lens that has one. */
export function latestRuns(sql: Sql): Partial<Record<LensId, LensRun>> {
  const rows = all<LensRunRow>(
    sql,
    `SELECT * FROM lens_runs WHERE id IN (SELECT MAX(id) FROM lens_runs WHERE status = 'done' GROUP BY lens)`,
  )
  const runs: Partial<Record<LensId, LensRun>> = {}
  for (const lens of LENS_IDS) {
    const row = rows.find((run) => run.lens === lens)
    if (row) runs[lens] = toLensRun(row)
  }
  return runs
}

export function addAsk(sql: Sql, input: NewAsk, now: Date): Ask {
  const ask = newAskSchema.parse(input)
  if (!getParticipant(sql, ask.addressedTo)) throw new RoomError(`There is no person p${ask.addressedTo} to ask.`)
  const questionId = ask.questionId ?? null
  if (questionId && !first(sql, 'SELECT id FROM open_questions WHERE id = ?', questionId)) {
    throw new RoomError(`There is no open question q${questionId}.`)
  }
  const row = first<AskRow>(
    sql,
    'INSERT INTO asks (addressed_to, ask, because, lens, question_id, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    ask.addressedTo,
    ask.ask,
    ask.because,
    ask.lens,
    questionId,
    now.toISOString(),
  )!
  return toAsk(row)
}

export function listAsks(sql: Sql, filter: { addressedTo?: number; status?: AskStatus } = {}): Ask[] {
  return all<AskRow>(
    sql,
    `SELECT * FROM asks WHERE (? IS NULL OR addressed_to = ?) AND (? IS NULL OR status = ?) ORDER BY id`,
    filter.addressedTo ?? null,
    filter.addressedTo ?? null,
    filter.status ?? null,
    filter.status ?? null,
  ).map(toAsk)
}

/** Closes an open ask. Returns null when there is no such ask, and the ask unchanged when it was already closed. */
export function closeAsk(sql: Sql, askId: number, close: CloseAsk, now: Date): Ask | null {
  const answeredBy = close.answeredBy ?? null
  if (answeredBy && !first(sql, 'SELECT id FROM items WHERE id = ?', answeredBy)) {
    throw new RoomError(`There is no item i${answeredBy} that answered it.`)
  }
  sql.exec(
    `UPDATE asks SET status = ?, answered_by = ?, closed_at = ? WHERE id = ? AND status = 'open'`,
    close.status,
    answeredBy,
    now.toISOString(),
    askId,
  )
  const row = first<AskRow>(sql, 'SELECT * FROM asks WHERE id = ?', askId)
  return row ? toAsk(row) : null
}

export function readRoom(sql: Sql): RoomSnapshot | null {
  const project = readProject(sql)
  if (!project) return null
  const facts = listFacts(sql)
  return {
    project,
    participants: listParticipants(sql),
    items: listItems(sql),
    facts,
    asks: listAsks(sql),
    latestRuns: latestRuns(sql),
    openQuestions: listOpenQuestions(sql),
    watermark: facts.at(-1)?.id ?? 0,
  }
}

const ASSESSMENT_KEY = 'assessment'

/** The mother agent's latest matrix and health reading. Kept apart from the snapshot so no view of the room shows it. */
export function readAssessment(sql: Sql): Assessment | null {
  const row = first<{ value: string }>(sql, 'SELECT value FROM meta WHERE key = ?', ASSESSMENT_KEY)
  const parsed = row ? assessmentSchema.safeParse(JSON.parse(row.value)) : null
  return parsed?.success ? parsed.data : null
}

export function writeAssessment(sql: Sql, assessment: Assessment): void {
  sql.exec(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    ASSESSMENT_KEY,
    JSON.stringify(assessment),
  )
}
