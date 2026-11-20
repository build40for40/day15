// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { Env } from '../contracts'
import { DirectoryStore } from '../directory/store'
import { parseKey } from '../room/keys'
import type { RoomStore } from '../room/store'
import { memoryDirectory, memoryRoom } from '../testing'
import { createTeamApi } from './api'

const data = async (res: Response) => (await res.json()) as any

function setup(user: string | null = 'user_fake') {
  const directories = new Map<string, DirectoryStore>()
  const rooms = new Map<string, RoomStore>()
  const env = {
    TEAMS: { getByName: (name: string) => directories.get(name) ?? directories.set(name, memoryDirectory()).get(name) },
    ROOMS: { getByName: (name: string) => rooms.get(name) ?? rooms.set(name, memoryRoom()).get(name) },
  } as unknown as Env
  const api = createTeamApi(async () => user)
  const call = (method: string, path: string, body?: unknown) =>
    api(
      new Request(`https://day15.test${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      env,
    )
  return { call, rooms }
}

async function teamWithProject() {
  const s = setup()
  await s.call('POST', '/api/team', { name: 'Fake Agency' })
  const { project } = await data(await s.call('POST', '/api/projects', { name: 'Orchard Dash' }))
  return { ...s, projectId: project.id as string }
}

describe('team API', () => {
  it('refuses anyone who is not signed in', async () => {
    expect((await setup(null).call('GET', '/api/session')).status).toBe(401)
  })

  it('starts with no team, then makes one', async () => {
    const { call } = setup()
    expect(await data(await call('GET', '/api/session'))).toMatchObject({ team: null, projects: [] })
    expect((await call('POST', '/api/team', { name: 'Fake Agency' })).status).toBe(201)
    expect(await data(await call('GET', '/api/session'))).toMatchObject({ team: { name: 'Fake Agency' } })
  })

  it('rejects a blank team name', async () => {
    expect((await setup().call('POST', '/api/team', { name: '   ' })).status).toBe(400)
  })

  it('needs a team before a project', async () => {
    expect((await setup().call('POST', '/api/projects', { name: 'Orchard Dash' })).status).toBe(409)
  })

  it('creates a project and its room', async () => {
    const { rooms, projectId } = await teamWithProject()
    expect(await rooms.get(projectId)!.project()).toMatchObject({ name: 'Orchard Dash', ownerId: 'user_fake' })
  })

  it('adds a person and returns an address whose key matches them', async () => {
    const { call, rooms, projectId } = await teamWithProject()
    const res = await call('POST', `/api/projects/${projectId}/people`, { name: 'Alex', persona: 'agency_lead', side: 'agency' })
    expect(res.status).toBe(201)
    const { participant, address } = await data(res)
    const key = parseKey(address.split('/mcp/')[1])!
    expect(key.projectId).toBe(projectId)
    expect((await rooms.get(projectId)!.identify(key.secret))?.id).toBe(participant.id)
  })

  it('lists projects with their people', async () => {
    const { call, projectId } = await teamWithProject()
    await call('POST', `/api/projects/${projectId}/people`, { name: 'Dana', persona: 'cfo', side: 'client' })
    const { projects } = await data(await call('GET', '/api/projects'))
    expect(projects[0].participants.map((p: { name: string }) => p.name)).toEqual(['Dana'])
  })

  it('issues a fresh address and the old one stops working', async () => {
    const { call, rooms, projectId } = await teamWithProject()
    const added = await data(await call('POST', `/api/projects/${projectId}/people`, { name: 'Casey', persona: 'procurement', side: 'client' }))
    const fresh = await data(await call('POST', `/api/projects/${projectId}/people/${added.participant.id}/address`))
    const secretOf = (a: string) => parseKey(a.split('/mcp/')[1]!)!.secret
    const room = rooms.get(projectId)!
    expect(await room.identify(secretOf(added.address))).toBeNull()
    expect((await room.identify(secretOf(fresh.address)))?.id).toBe(added.participant.id)
  })

  it('rejects a person with no side', async () => {
    const { call, projectId } = await teamWithProject()
    expect((await call('POST', `/api/projects/${projectId}/people`, { name: 'Pat', persona: 'cfo' })).status).toBe(400)
  })

  it('does not open another owner\'s project', async () => {
    const { projectId } = await teamWithProject()
    const stranger = setup('user_other')
    await stranger.call('POST', '/api/team', { name: 'Other' })
    const res = await stranger.call('POST', `/api/projects/${projectId}/people`, { name: 'Pat', persona: 'cfo', side: 'client' })
    expect(res.status).toBe(404)
  })

  it('answers 404 for unknown routes', async () => {
    expect((await setup().call('GET', '/api/nope')).status).toBe(404)
  })
})
