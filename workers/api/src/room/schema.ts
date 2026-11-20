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
    private INTEGER NOT NULL DEFAULT 0,
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
    closed_at TEXT,
    question_id INTEGER REFERENCES open_questions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS open_questions (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('conflict', 'gap')),
    lens TEXT NOT NULL,
    topic TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'scope',
    statement TEXT NOT NULL,
    because TEXT NOT NULL DEFAULT '',
    agency_said TEXT,
    client_said TEXT,
    ask_side TEXT NOT NULL CHECK (ask_side IN ('agency', 'client', 'both')),
    priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 3),
    based_on TEXT NOT NULL DEFAULT '[]',
    rests_on_private INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dropped')),
    raised_by_run INTEGER REFERENCES lens_runs(id),
    raised_by_item INTEGER REFERENCES items(id),
    resolved_by_run INTEGER REFERENCES lens_runs(id),
    resolved_by_item INTEGER REFERENCES items(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
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

/** Columns added after rooms already existed, in the order they arrived. */
const ADDED_COLUMNS: Record<string, [name: string, definition: string][]> = {
  participants: [
  ['job_title', `TEXT NOT NULL DEFAULT ''`],
  ['organisation', `TEXT NOT NULL DEFAULT ''`],
  ['lenses', `TEXT NOT NULL DEFAULT '[]'`],
  ['notes', `TEXT NOT NULL DEFAULT ''`],
  ['has_link', 'INTEGER NOT NULL DEFAULT 1'],
  ['added_by', `TEXT NOT NULL DEFAULT 'owner'`],
  ['removed_at', 'TEXT'],
  ],
  asks: [['question_id', 'INTEGER REFERENCES open_questions(id)']],
  open_questions: [
    ['area', `TEXT NOT NULL DEFAULT 'scope'`],
    ['rests_on_private', 'INTEGER NOT NULL DEFAULT 0'],
    ['raised_by_item', 'INTEGER REFERENCES items(id)'],
  ],
  facts: [['private', 'INTEGER NOT NULL DEFAULT 0']],
}

function addColumns(sql: Sql, table: string) {
  const have = new Set(all<{ name: string }>(sql, `PRAGMA table_info(${table})`).map((column) => column.name))
  for (const [name, definition] of ADDED_COLUMNS[table]!) {
    if (have.has(name)) continue
    sql.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
    if (table === 'participants' && name === 'lenses') {
      for (const persona of PERSONAS) {
        sql.exec('UPDATE participants SET lenses = ? WHERE persona = ?', JSON.stringify([PERSONA_LENS[persona]]), persona)
      }
    }
  }
}

/** Safe to run on every start, on a new room or one made before any later column. Run it in a transaction. */
export function migrate(sql: Sql): void {
  for (const statement of STATEMENTS) sql.exec(statement)
  for (const table of Object.keys(ADDED_COLUMNS)) addColumns(sql, table)
}
