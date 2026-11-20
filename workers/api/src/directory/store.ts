import { MAX_NAME_LENGTH } from '@day15/shared/schema'
import { all, first, type Sql } from '../room/sql'

export interface Team {
  name: string
  ownerId: string
  createdAt: string
}

export interface TeamProject {
  id: string
  name: string
  createdAt: string
}

/** A request the directory refuses. The message is safe to show. */
export class DirectoryError extends Error {
  override name = 'DirectoryError'
}

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS team (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
]

function cleanName(name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > MAX_NAME_LENGTH) throw new DirectoryError(`Give it a name under ${MAX_NAME_LENGTH} characters.`)
  return trimmed
}

/** Everything the TeamDirectory Durable Object does, over any SQLite: one agency owner's team and its projects. */
export class DirectoryStore {
  constructor(
    private readonly sql: Sql,
    private readonly now: () => Date = () => new Date(),
  ) {
    for (const statement of STATEMENTS) sql.exec(statement)
  }

  async team(): Promise<Team | null> {
    const row = first<{ name: string; owner_id: string; created_at: string }>(this.sql, 'SELECT * FROM team')
    return row ? { name: row.name, ownerId: row.owner_id, createdAt: row.created_at } : null
  }

  /** Makes the team once. `created` is false when there already was one, which is returned unchanged. */
  async createTeam(input: { name: string; ownerId: string }): Promise<{ team: Team; created: boolean }> {
    const existing = await this.team()
    if (existing) return { team: existing, created: false }
    this.sql.exec(
      'INSERT INTO team (singleton, name, owner_id, created_at) VALUES (1, ?, ?, ?)',
      cleanName(input.name),
      input.ownerId,
      this.now().toISOString(),
    )
    return { team: (await this.team())!, created: true }
  }

  async addProject(input: { id: string; name: string }): Promise<TeamProject> {
    if (!(await this.team())) throw new DirectoryError('Set up your team first.')
    const row = first<{ id: string; name: string; created_at: string }>(
      this.sql,
      'INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?) RETURNING *',
      input.id,
      cleanName(input.name),
      this.now().toISOString(),
    )!
    return { id: row.id, name: row.name, createdAt: row.created_at }
  }

  async projects(): Promise<TeamProject[]> {
    return all<{ id: string; name: string; created_at: string }>(
      this.sql,
      'SELECT * FROM projects ORDER BY created_at, id',
    ).map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at }))
  }

  async hasProject(id: string): Promise<boolean> {
    return Boolean(first(this.sql, 'SELECT id FROM projects WHERE id = ?', id))
  }
}
