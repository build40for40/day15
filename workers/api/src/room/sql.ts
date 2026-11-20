/** The slice of a Durable Object's `ctx.storage.sql` the room uses, so tests can back it with node:sqlite. */
export type SqlValue = string | number | null | ArrayBuffer

export interface Sql {
  exec<T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]): { toArray(): T[] }
}

export const all = <T extends Record<string, SqlValue>>(sql: Sql, query: string, ...bindings: SqlValue[]): T[] =>
  sql.exec<T>(query, ...bindings).toArray()

export const first = <T extends Record<string, SqlValue>>(sql: Sql, query: string, ...bindings: SqlValue[]): T | undefined =>
  all<T>(sql, query, ...bindings)[0]
