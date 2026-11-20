import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'

const auth = vi.hoisted(() => ({ currentUser: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), getAccessToken: vi.fn() }))
vi.mock('./auth', () => auth)

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const ADDRESS = `https://day15.test/mcp/${PROJECT_ID}.fake-secret`

const person = (overrides: Record<string, unknown>) => ({
  id: 1,
  name: 'Alex Example',
  persona: 'agency_lead',
  side: 'agency',
  jobTitle: 'Managing Director',
  organisation: 'Make-Believe Studio',
  lenses: ['agency'],
  notes: '',
  hasLink: true,
  addedBy: 'owner',
  createdAt: '2026-11-20T09:00:00Z',
  removedAt: null,
  ...overrides,
})
const team = { name: 'Fake Agency', ownerId: 'user_fake', createdAt: '2026-11-20T09:00:00Z' }
const project = (participants: unknown[] = [], overrides: Record<string, unknown> = {}) => ({
  id: PROJECT_ID,
  name: 'Orchard Dash',
  createdAt: 'x',
  participants,
  ...overrides,
})

const said = (id: number, side: string, statement: string) => ({
  id,
  topic: 'budget',
  statement,
  status: 'confirmed',
  authorKind: 'person',
  participantId: 1,
  side,
  basedOn: [],
  private: false,
})
const ROOM = {
  facts: [said(1, 'agency', 'The quote is £80k.'), said(2, 'client', 'The budget is £60k.')],
  openQuestions: [
    {
      id: 1,
      kind: 'conflict',
      topic: 'budget',
      area: 'budget',
      statement: 'The quote is £20k over the budget (f1, f2).',
      because: '',
      agencySaid: null,
      clientSaid: null,
      askSide: 'both',
      priority: 1,
      basedOn: [1, 2],
      withheld: false,
    },
  ],
  asks: [],
}

function serve(session: unknown) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, 'https://day15.test').pathname
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    if (path === '/api/session') return Response.json(session)
    if (path.endsWith('/room')) return Response.json({ room: ROOM })
    if (path === '/api/projects') return Response.json({ project: project() }, { status: 201 })
    if (path.endsWith('/people') && init?.method === 'POST') {
      const { link, ...details } = body
      return Response.json(
        { participant: person({ ...details, id: 2, hasLink: link }), address: link ? ADDRESS : null },
        { status: 201 },
      )
    }
    if (path.endsWith('/people/2') && init?.method === 'DELETE') {
      return Response.json({ participant: person({ id: 2, removedAt: '2026-11-20T10:00:00Z' }) })
    }
    return Response.json({ error: 'Not found.' }, { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const sidebarNames = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('nav .person .name').map((name) => name.text())

const button = (wrapper: ReturnType<typeof mount>, text: string) => wrapper.findAll('button').find((b) => b.text() === text)!

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

  it('says a project is shared with both sides unless someone asks for privacy', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    serve({ team: null, projects: [] })
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain('shared with both sides by default')
    expect(wrapper.text()).toContain('it stays on your side')
    expect(wrapper.text()).toContain('name your team')
  })

  it('creates a first project and lands on adding a person', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    serve({ team, projects: [] })
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('input[aria-label="Project name"]').setValue('Orchard Dash')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('h2').text()).toBe('Orchard Dash')
    expect(wrapper.text()).toContain('Add a person')
  })

  it('adds a person from the sidebar, shows their link once, and removes them after a confirm', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    const fetchMock = serve({ team, projects: [project([person({})])] })
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = mount(App)
    await flushPromises()
    await button(wrapper, 'People 1').trigger('click')
    expect(sidebarNames(wrapper)).toEqual(['Alex Example'])

    await button(wrapper, 'Add person').trigger('click')
    await wrapper.get('input[name="name"]').setValue('Robin Fakeworth')
    await wrapper.get('input[name="jobTitle"]').setValue('Finance Director')
    await wrapper.get('select[name="side"]').setValue('client')
    await wrapper.get('select[name="persona"]').setValue('cfo')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const added = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(String(added[1]!.body))).toEqual({
      name: 'Robin Fakeworth',
      jobTitle: 'Finance Director',
      organisation: '',
      side: 'client',
      persona: 'cfo',
      lenses: ['cfo'],
      notes: '',
      link: true,
    })
    expect(sidebarNames(wrapper)).toEqual(['Alex Example', 'Robin Fakeworth'])
    expect(wrapper.get('nav').text()).toContain('Finance Director')
    const invite = wrapper.get('.link .message').text()
    expect(invite).toContain('Hi Robin, you\'re on "Orchard Dash"')
    expect(invite).toContain(ADDRESS)
    expect(wrapper.find('input.address').exists()).toBe(false)
    await button(wrapper, 'Copy prompt').trigger('click')
    expect(writeText).toHaveBeenCalledWith(invite)
    const whatsapp = new URL(wrapper.get('.link a.share').attributes('href')!)
    expect(whatsapp.searchParams.get('text')).toBe(invite)

    await button(wrapper, 'Remove from project').trigger('click')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
    await button(wrapper, 'Yes, remove them').trigger('click')
    await flushPromises()
    expect(sidebarNames(wrapper)).toEqual(['Alex Example'])
    expect(fetchMock.mock.calls.every(([, init]) => (init?.headers as Record<string, string>).Authorization === 'Bearer fake-token')).toBe(true)
  })

  it('opens a project with people on its circle, drawn from the room', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    const fetchMock = serve({ team, projects: [project([person({})])] })
    const wrapper = mount(App)
    await flushPromises()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith(`/api/projects/${PROJECT_ID}/room`))).toBe(true)
    expect(wrapper.get('.center').text()).toContain('Not started')
    const budget = wrapper.findAll('.rows .head').find((row) => row.text().includes('Budget'))!
    expect(budget.text()).toContain('Deal-breaker. The quote is £20k over the budget.')
    await budget.trigger('click')
    expect(wrapper.findAll('.rows .fact .txt').map((fact) => fact.text())).toEqual(['The budget is £60k.', 'The quote is £80k.'])
    expect(wrapper.get('.rows .fact .meta').text()).toContain('Confirmed by')
  })

  it('switches between projects', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    const other = project([person({ name: 'Morgan Madeup' })], { id: '22222222-2222-4222-8222-222222222222', name: 'Biscuit Bonanza' })
    serve({ team, projects: [project(), other] })
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('select').setValue(other.id)
    await button(wrapper, 'People 1').trigger('click')
    expect(sidebarNames(wrapper)).toEqual(['Morgan Madeup'])
  })
})
