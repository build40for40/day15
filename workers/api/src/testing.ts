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

/** Alex's quote about hosting made private, and the CFO lens's conflict on it re-reported citing it. */
export async function privateAgencyRoom() {
  const fixture = await fixtureRoom()
  const { room, facts } = fixture
  await room.setFactPrivacy([facts.quoteCovers!.id], true, 'agency')
  await room.saveLensRun({
    lens: 'cfo',
    round: 2,
    watermark: facts.budgetGap!.id,
    status: 'done',
    report: {
      coverage: [],
      conflicts: [
        {
          topic: 'What the price covers',
          agency_said: `the quote leaves something out (f${facts.quoteCovers!.id})`,
          client_said: `everything for a year (f${facts.wholeBudget!.id})`,
          priority: 1,
          note: 'They are pricing two different projects.',
          same_as: 'q1',
          rests_on_private: true,
        },
      ],
      questions: [],
      done: false,
    },
  })
  return fixture
}

export const AGENCY_PRIVATE = [
  'Hosting and app store fees sit outside that.',
  'covers building the app only',
  'The two sides read the £60k differently',
  'They are pricing two different projects.',
  'the quote leaves something out',
]
