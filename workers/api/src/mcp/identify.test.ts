// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import type { Env } from '../contracts'
import { formatKey } from '../room/keys'
import { FIXTURE_PROJECT } from '../room/fixture'
import { asStub, fixtureRoom, memoryRoom } from '../testing'
import { identify, keyFromPath } from './identify'

async function setup() {
  const fixture = await fixtureRoom()
  const env = { ROOMS: { getByName: (name: string) => (name === FIXTURE_PROJECT.id ? fixture.stub : null) } } as unknown as Env
  return { ...fixture, env }
}

describe('identify', () => {
  it('knows the person from the key in the address', async () => {
    const { env, people } = await setup()
    const key = formatKey(FIXTURE_PROJECT.id, people.casey.secret)
    const identity = await identify(new Request(`https://day15.build40for40.com/mcp/${key}`), env)
    expect(identity?.participant).toEqual(people.casey.participant)
    expect(identity?.projectId).toBe(FIXTURE_PROJECT.id)
  })

  it('knows nobody from a wrong or missing key', async () => {
    const { env, people } = await setup()
    const wrong = formatKey(FIXTURE_PROJECT.id, people.casey.secret.replace(/^./, (c) => (c === 'A' ? 'B' : 'A')))
    expect(await identify(new Request(`https://day15.build40for40.com/mcp/${wrong}`), env)).toBeNull()
    expect(await identify(new Request('https://day15.build40for40.com/mcp'), env)).toBeNull()
  })

  it('knows nobody from a malformed key or a project that does not exist, without opening a room for bad keys', async () => {
    const { env, people } = await setup()
    const getByName = vi.spyOn(env.ROOMS, 'getByName')
    const unknownProject = formatKey('00000000-0000-4000-8000-000000000099', people.casey.secret)
    for (const key of ['not-a-key', `${FIXTURE_PROJECT.id}.short`, `${formatKey(FIXTURE_PROJECT.id, people.casey.secret)}.extra`]) {
      expect(await identify(new Request(`https://day15.build40for40.com/mcp/${key}`), env)).toBeNull()
    }
    expect(getByName).not.toHaveBeenCalled()
    const empty = memoryRoom()
    getByName.mockReturnValue(asStub(empty) as never)
    expect(await identify(new Request(`https://day15.build40for40.com/mcp/${unknownProject}`), env)).toBeNull()
  })

  it('reads the key from /mcp/<key> only', () => {
    expect(keyFromPath('/mcp/abc.def')).toBe('abc.def')
    expect(keyFromPath('/mcp/abc.def/')).toBe('abc.def')
    expect(keyFromPath('/mcp/abc/def')).toBeNull()
    expect(keyFromPath('/api/abc')).toBeNull()
  })
})
