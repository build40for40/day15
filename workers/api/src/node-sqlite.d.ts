/** The part of Node's built-in SQLite the tests use. The Worker itself never imports it. */
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): { all(...params: unknown[]): unknown[] }
  }
}
