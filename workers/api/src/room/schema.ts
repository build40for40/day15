import { PERSONA_LENS, PERSONAS } from '@day15/shared/schema'
import { all, type Sql } from './sql'

/** Facts are never edited: `supersedes` is unique, so a fact can only be replaced once, by a newer row. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS project (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY,
    side TEXT NOT NULL CHECK (side IN ('agency', 'client')),
    persona TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    job_title TEXT NOT NULL DEFAULT '',
    organisation TEXT NOT NULL DEFAULT '',
    lenses TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    has_link INTEGER NOT NULL DEFAULT 1,
    added_by TEXT NOT NULL DEFAULT 'owner',
    removed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY,
    participant_id INTEGER NOT NULL REFERENCES participants(id),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lens_runs (
    id INTEGER PRIMARY KEY,
    lens TEXT NOT NULL,
    round INTEGER NOT NULL,
    watermark INTEGER NOT NULL,
    report TEXT,
    status TEXT NOT NULL CHECK (status IN ('done', 'failed')),
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS facts (
    id INTEGER PRIMARY KEY,
    topic TEXT NOT NULL,
    statement TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('proposed', 'confirmed')),
    author_kind TEXT NOT NULL CHECK (author_kind IN ('person', 'lens')),
    participant_id INTEGER REFERENCES participants(id),
    lens_run_id INTEGER REFERENCES lens_runs(id),
    side TEXT,
    source_item_id INTEGER REFERENCES items(id),
    source_quote TEXT,
    based_on TEXT NOT NULL DEFAULT '[]',
    supersedes INTEGER UNIQUE REFERENCES facts(id),
    created_at TEXT NOT NULL,
    CHECK (
      (author_kind = 'person' AND participant_id IS NOT NULL AND source_item_id IS NOT NULL
        AND source_quote IS NOT NULL AND lens_run_id IS NULL)
      OR (author_kind = 'lens' AND lens_run_id IS NOT NULL AND participant_id IS NULL)
    )
  )`,
  `CREATE TABLE IF NOT EXISTS asks (
    id INTEGER PRIMARY KEY,
    addressed_to INTEGER NOT NULL REFERENCES participants(id),
    ask TEXT NOT NULL,
    because TEXT NOT NULL,
    lens TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'dropped')),
    answered_by INTEGER REFERENCES items(id),
    created_at TEXT NOT NULL,
    closed_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
]

export function hasSchema(sql: Sql): boolean {
  return sql.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'project'`).toArray().length > 0
}

/** Columns added to `participants` after rooms already existed, in the order they arrived. */
const PARTICIPANT_COLUMNS: [name: string, definition: string][] = [
  ['job_title', `TEXT NOT NULL DEFAULT ''`],
  ['organisation', `TEXT NOT NULL DEFAULT ''`],
  ['lenses', `TEXT NOT NULL DEFAULT '[]'`],
  ['notes', `TEXT NOT NULL DEFAULT ''`],
  ['has_link', 'INTEGER NOT NULL DEFAULT 1'],
  ['added_by', `TEXT NOT NULL DEFAULT 'owner'`],
  ['removed_at', 'TEXT'],
]

function addParticipantColumns(sql: Sql) {
  const have = new Set(all<{ name: string }>(sql, 'PRAGMA table_info(participants)').map((column) => column.name))
  for (const [name, definition] of PARTICIPANT_COLUMNS) {
    if (have.has(name)) continue
    sql.exec(`ALTER TABLE participants ADD COLUMN ${name} ${definition}`)
    if (name === 'lenses') {
      for (const persona of PERSONAS) {
        sql.exec('UPDATE participants SET lenses = ? WHERE persona = ?', JSON.stringify([PERSONA_LENS[persona]]), persona)
      }
    }
  }
}

/** Safe to run on every start, on a new room or one made before any later column. Run it in a transaction. */
export function migrate(sql: Sql): void {
  for (const statement of STATEMENTS) sql.exec(statement)
  addParticipantColumns(sql)
}
