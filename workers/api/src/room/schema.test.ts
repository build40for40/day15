// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { memorySql } from '../testing'
import { hashSecret } from './keys'
import { RoomStore } from './store'

const OLD_PARTICIPANTS = `CREATE TABLE participants (
  id INTEGER PRIMARY KEY,
  side TEXT NOT NULL CHECK (side IN ('agency', 'client')),
  persona TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
)`

async function oldRoom() {
  const sql = memorySql()
  sql.exec(`CREATE TABLE project (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1), id TEXT NOT NULL, name TEXT NOT NULL, owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`)
  sql.exec(OLD_PARTICIPANTS)
  sql.exec(`INSERT INTO project VALUES (1, 'project-1', 'A fake biscuit site', 'user_fake', '2026-11-19T09:00:00Z')`)
  sql.exec(
    `INSERT INTO participants (side, persona, name, key_hash, created_at) VALUES ('client', 'cfo', 'Robin Fakeworth', ?, ?)`,
    await hashSecret('old-secret'),
    '2026-11-19T09:00:00Z',
  )
  return sql
}

describe('migrate', () => {
  it('adds the people columns to a room made before them, keeping its people and their keys', async () => {
    const sql = await oldRoom()
    const room = new RoomStore(sql, (run) => sql.transaction(run))

    expect(await room.participants()).toEqual([
      {
        id: 1,
        name: 'Robin Fakeworth',
        persona: 'cfo',
        side: 'client',
        jobTitle: '',
        organisation: '',
        lenses: ['cfo'],
        notes: '',
        hasLink: true,
        addedBy: 'owner',
        createdAt: '2026-11-19T09:00:00Z',
        removedAt: null,
      },
    ])
    expect((await room.identify('old-secret'))?.id).toBe(1)

    const { participant, secret } = await room.addParticipant(
      { name: 'Pat Notreal', persona: 'procurement', side: 'client' },
      { link: false },
    )
    expect(secret).toBeNull()
    expect(participant).toMatchObject({ hasLink: false, lenses: ['procurement'] })
  })

  it('leaves a migrated room alone the next time it starts', async () => {
    const sql = await oldRoom()
    const first = new RoomStore(sql, (run) => sql.transaction(run))
    await first.updateParticipant(1, { lenses: [] })
    const again = new RoomStore(sql, (run) => sql.transaction(run))
    expect((await again.participants())[0]!.lenses).toEqual([])
  })
})
