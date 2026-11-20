// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { memoryDirectory } from '../testing'

describe('DirectoryStore', () => {
  it('makes the team once and keeps the first name', async () => {
    const directory = memoryDirectory()
    expect(await directory.team()).toBeNull()
    const first = await directory.createTeam({ name: ' Bright Fake Studio ', ownerId: 'user_fake' })
    expect(first).toMatchObject({ created: true, team: { name: 'Bright Fake Studio', ownerId: 'user_fake' } })
    expect(await directory.createTeam({ name: 'Another', ownerId: 'user_fake' })).toEqual({ ...first, created: false })
  })

  it('lists projects only once there is a team', async () => {
    const directory = memoryDirectory()
    await expect(directory.addProject({ id: 'p-1', name: 'Orchard Dash' })).rejects.toThrow('team first')
    await directory.createTeam({ name: 'Bright Fake Studio', ownerId: 'user_fake' })
    await directory.addProject({ id: 'p-1', name: 'Orchard Dash' })
    expect((await directory.projects()).map((project) => project.name)).toEqual(['Orchard Dash'])
    expect(await directory.hasProject('p-1')).toBe(true)
    expect(await directory.hasProject('p-2')).toBe(false)
  })
})
