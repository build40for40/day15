import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'

const auth = vi.hoisted(() => ({ currentUser: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), getAccessToken: vi.fn() }))
vi.mock('./auth', () => auth)

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const ADDRESS = `https://day15.test/mcp/${PROJECT_ID}.fake-secret`

const person = { id: 1, name: 'Alex', persona: 'agency_lead', side: 'agency', createdAt: '2026-11-20T09:00:00Z' }
const team = { name: 'Fake Agency', ownerId: 'user_fake', createdAt: '2026-11-20T09:00:00Z' }

function serve(session: unknown) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, 'https://day15.test').pathname
    if (path === '/api/session') return Response.json(session)
    if (path === '/api/projects') {
      return Response.json({ project: { id: PROJECT_ID, name: 'Orchard Dash', createdAt: 'x', participants: [] } }, { status: 201 })
    }
    if (path.endsWith('/people')) {
      expect(JSON.parse(String(init?.body))).toEqual({ name: 'Alex', persona: 'agency_lead', side: 'agency' })
      return Response.json({ participant: person, address: ADDRESS }, { status: 201 })
    }
    return Response.json({ error: 'Not found.' }, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.getAccessToken.mockResolvedValue('fake-token')
})

describe('App', () => {
  it('offers sign in when nobody is signed in', async () => {
    auth.currentUser.mockResolvedValue(null)
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('button').trigger('click')
    expect(auth.signIn).toHaveBeenCalled()
  })

  it('warns that a project is visible to both sides', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    serve({ team: null, projects: [] })
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain('visible to everyone in it, both sides')
    expect(wrapper.text()).toContain('name your team')
  })

  it('creates a project, adds a person and shows their address with a copy button', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    const fetchMock = serve({ team, projects: [] })
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('input[aria-label="Project name"]').setValue('Orchard Dash')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Orchard Dash')

    await wrapper.get('form.add input').setValue('Alex')
    await wrapper.get('form.add').trigger('submit')
    await flushPromises()

    expect((wrapper.get('input.address').element as HTMLInputElement).value).toBe(ADDRESS)
    const copyButton = wrapper.findAll('button').find((b) => b.text() === 'Copy address')!
    await copyButton.trigger('click')
    expect(writeText).toHaveBeenCalledWith(ADDRESS)
    expect(fetchMock.mock.calls.every(([, init]) => (init?.headers as Record<string, string>).Authorization === 'Bearer fake-token')).toBe(true)
  })
})
