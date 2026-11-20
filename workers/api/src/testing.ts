import { DatabaseSync } from 'node:sqlite'

import type { RoomStub } from './contracts'
import { DirectoryStore } from './directory/store'
import { seedFixture } from './room/fixture'
import type { Sql, SqlValue } from './room/sql'
import { RoomStore } from './room/store'

/** An in-memory SQLite shaped like a Durable Object's `ctx.storage.sql`. For tests only. */
export function memorySql(): Sql & { transaction<T>(run: () => T): T } {
  const db = new DatabaseSync(':memory:')
  return {
    exec<T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]) {
      const rows = db.prepare(query).all(...bindings) as T[]
      return { toArray: () => rows }
    },
    transaction<T>(run: () => T): T {
      db.exec('BEGIN')
      try {
        const result = run()
        db.exec('COMMIT')
        return result
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
  }
}

/** A room that behaves like the ProjectRoom Durable Object, in memory. */
export function memoryRoom(now?: () => Date): RoomStore {
  const sql = memorySql()
  return new RoomStore(sql, (run) => sql.transaction(run), now)
}

/** Stands in for `env.ROOMS.getByName(id)` wherever code expects a stub. */
export const asStub = (room: RoomStore) => room as unknown as RoomStub

/** A team directory that behaves like the TeamDirectory Durable Object, in memory. */
export const memoryDirectory = (now?: () => Date) => new DirectoryStore(memorySql(), now)

/** A memory room already holding the made-up juice brand project. */
export async function fixtureRoom(now?: () => Date) {
  const room = memoryRoom(now)
  return { room, stub: asStub(room), ...(await seedFixture(room)) }
}
