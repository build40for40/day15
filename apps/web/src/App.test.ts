import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App.vue'
import { SETUP_KEY } from './onboarding'

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
  let nextId = 2
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, 'https://day15.test').pathname
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    if (path === '/api/session') return Response.json(session)
    if (path === '/api/team') return Response.json({ team }, { status: 201 })
    if (path.endsWith('/room')) return Response.json({ room: ROOM })
    if (path === '/api/projects') return Response.json({ project: project() }, { status: 201 })
    if (path.endsWith('/people') && init?.method === 'POST') {
      const { link, ...details } = body
      return Response.json(
        { participant: person({ ...details, id: nextId++, hasLink: link }), address: link ? ADDRESS : null },
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
    expect(wrapper.text()).toContain('Welcome to A-Line')
  })

  it('walks a new agency through the questions, then creates everything once they say go', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    const fetchMock = serve({ team: null, projects: [] })
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    const wrapper = mount(App)
    await flushPromises()
    const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')

    // Hello: needs a name and an agency before moving on.
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Tell me your name.')
    await wrapper.get('input[placeholder="Your name"]').setValue('Alex Example')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('What is your agency called?')
    await wrapper.get('input[placeholder="Your agency"]').setValue('Fake Agency')
    await wrapper.get('input[placeholder="Managing Director"]').setValue('Managing Director')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    // The win, with the sketch filling in live.
    expect(wrapper.text()).toContain('Nice to meet you, Alex')
    await wrapper.get('input[placeholder="Orchard Dash"]').setValue('Orchard Dash')
    await wrapper.get('input[placeholder="The client\'s company"]').setValue('Make-Believe Foods')
    expect(wrapper.get('aside').text()).toContain('Orchard Dash')
    expect(wrapper.get('aside').text()).toContain('Make-Believe Foods')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    // Your client: nobody named yet, so the coach says so. Then the client rep and client procurement are created.
    expect(wrapper.text()).toContain('Nobody on the Make-Believe Foods side yet')
    await wrapper.get('input[placeholder="Your day-to-day contact"]').setValue('Robin Fakeworth')
    await wrapper.findAll('input[placeholder="Optional"]')[0]!.setValue('Head of Brand')
    // The advisers follow the role: the client rep starts with the client adviser.
    const repPills = wrapper.findAll('section.seat')[0]!.findAll('.adviser input')
    expect(repPills.filter((pill) => (pill.element as HTMLInputElement).checked).map((pill) => pill.attributes('value'))).toEqual(['client'])
    await repPills.find((pill) => pill.attributes('value') === 'procurement')!.setValue(true)
    await wrapper.findAll('section.seat')[0]!.get('textarea').setValue('Reports to the CEO. Signs off the budget.')
    await wrapper.get('input[placeholder="Who handles the contract"]').setValue('Pat Pretend')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Nobody on the Make-Believe Foods side yet')
    expect(wrapper.get('aside').text()).toContain('Robin Fakeworth')
    expect(wrapper.get('aside').text()).toContain('Head of Brand')
    expect(wrapper.get('aside').text()).toContain('Client procurement')
    await button(wrapper, 'Review').trigger('click')
    await flushPromises()

    // Review: nothing has been created yet.
    expect(wrapper.text()).toContain('Shall I set it up?')
    expect(posts()).toHaveLength(0)
    await button(wrapper, 'Set it up').trigger('click')
    await flushPromises()

    const bodies = posts().map(([url, init]) => [new URL(String(url), 'https://day15.test').pathname, JSON.parse(String(init!.body))])
    expect(bodies[0]).toEqual(['/api/team', { name: 'Fake Agency' }])
    expect(bodies[1]).toEqual(['/api/projects', { name: 'Orchard Dash' }])
    expect(bodies[2]![1]).toMatchObject({ name: 'Alex Example', jobTitle: 'Managing Director', side: 'agency', persona: 'agency_lead', organisation: 'Fake Agency', link: true })
    expect(bodies[3]![1]).toMatchObject({
      name: 'Robin Fakeworth',
      jobTitle: 'Head of Brand',
      side: 'client',
      persona: 'marketing_lead',
      organisation: 'Make-Believe Foods',
      lenses: ['client', 'procurement'],
      notes: 'Reports to the CEO. Signs off the budget.',
      link: true,
    })
    expect(bodies[4]![1]).toMatchObject({
      name: 'Pat Pretend',
      side: 'client',
      persona: 'procurement',
      organisation: 'Make-Believe Foods',
      lenses: ['procurement'],
      link: true,
    })

    // Done: the agency rep sends the client's people their links first, then has their own. Each is shown once.
    expect(wrapper.text()).toContain('Orchard Dash is open.')
    const messages = wrapper.findAll('.invites .message').map((message) => message.text())
    expect(messages).toHaveLength(3)
    expect(messages[0]).toMatch(/^Hi Robin, Alex at Fake Agency has set you up on "Orchard Dash"/)
    expect(messages[1]).toMatch(/^Hi Pat, Alex at Fake Agency has set you up/)
    expect(messages[2]).toMatch(/^Hi Alex, you're on "Orchard Dash"/)
    expect(wrapper.findAll('.invites .who strong').map((who) => who.text())).toEqual(['For Robin Fakeworth', 'For Pat Pretend', 'Your own link'])
    expect(messages.every((message) => message.includes(ADDRESS))).toBe(true)
    await button(wrapper, 'Go to my project').trigger('click')
    await flushPromises()
    // The project opens on its circle, and the people are one tab away.
    expect(wrapper.find('.center').exists()).toBe(true)
    await button(wrapper, 'People 3').trigger('click')
    expect(sidebarNames(wrapper)).toEqual(['Alex Example', 'Robin Fakeworth', 'Pat Pretend'])
  })

  it('lets the agency rep add a whole team on each side, each with their own role and link', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    const fetchMock = serve({ team, projects: [] })
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('input[placeholder="Your name"]').setValue('Alex Example')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('input[placeholder="Orchard Dash"]').setValue('Orchard Dash')
    await wrapper.get('input[placeholder="The client\'s company"]').setValue('Make-Believe Foods')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    await wrapper.get('input[placeholder="Your day-to-day contact"]').setValue('Robin Fakeworth')
    // Two more on the agency side, one more on the client side.
    await button(wrapper, '+ Add someone from your agency').trigger('click')
    await button(wrapper, '+ Add someone from your agency').trigger('click')
    await button(wrapper, '+ Add someone from the client').trigger('click')
    await flushPromises()
    const agency = wrapper.findAll('[data-team="agency"] .seat')
    const client = wrapper.findAll('[data-team="client"] .seat')
    expect(agency).toHaveLength(2)
    expect(client).toHaveLength(3)

    await agency[0]!.get('input[placeholder="Someone on your team"]').setValue('Sam Pretend')
    await agency[1]!.get('input[placeholder="Someone on your team"]').setValue('Dana Mistake')
    await agency[1]!.get('select').setValue('agency_lead')
    await client[2]!.get('input[placeholder="Someone on the client team"]').setValue('Lee Odd')
    // Each added person is prompted with a question for their role.
    expect(agency[0]!.text()).toContain('Who makes it, and by when?')
    expect(client[2]!.text()).toContain('Who holds the budget?')
    // Dana was added by mistake and is removed.
    await agency[1]!.findAll('button').find((b) => b.text() === 'Remove')!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-team="agency"] .seat')).toHaveLength(1)
    expect(wrapper.get('aside').text()).toContain('Sam Pretend')
    expect(wrapper.get('aside').text()).not.toContain('Dana Mistake')

    await button(wrapper, 'Review').trigger('click')
    await flushPromises()
    await button(wrapper, 'Set it up').trigger('click')
    await flushPromises()

    const people = fetchMock.mock.calls
      .filter(([url, init]) => init?.method === 'POST' && String(url).endsWith('/people'))
      .map(([, init]) => JSON.parse(String(init!.body)))
    expect(people.map((p) => [p.name, p.side, p.persona, p.organisation, p.lenses])).toEqual([
      ['Alex Example', 'agency', 'agency_lead', 'Fake Agency', ['agency']],
      ['Robin Fakeworth', 'client', 'marketing_lead', 'Make-Believe Foods', ['client']],
      ['Sam Pretend', 'agency', 'delivery_lead', 'Fake Agency', ['procurement']],
      ['Lee Odd', 'client', 'cfo', 'Make-Believe Foods', ['procurement']],
    ])
    // Everyone gets a message from the agency rep, the agency rep's own last.
    expect(wrapper.findAll('.invites .who strong').map((who) => who.text())).toEqual([
      'For Robin Fakeworth',
      'For Sam Pretend',
      'For Lee Odd',
      'Your own link',
    ])
  })

  it('lets someone fill in a form instead of being asked, and still reviews before creating anything', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    const fetchMock = serve({ team, projects: [] })
    const wrapper = mount(App)
    await flushPromises()
    await button(wrapper, 'Prefer a form? Fill it in all at once').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Set up your project')
    expect(wrapper.text()).toContain('Client procurement')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Tell me your name.')
    await wrapper.get('input[placeholder="Your name"]').setValue('Alex Example')
    await wrapper.get('input[placeholder="Orchard Dash"]').setValue('Orchard Dash')
    await wrapper.get('input[placeholder="The client\'s company"]').setValue('Make-Believe Foods')
    await wrapper.get('input[placeholder="Your day-to-day contact"]').setValue('Robin Fakeworth')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Shall I set it up?')
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)

    // Back from the review returns to the form, not to a question.
    await button(wrapper, 'Back').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Set up your project')
    expect((wrapper.get('input[placeholder="Orchard Dash"]').element as HTMLInputElement).value).toBe('Orchard Dash')
  })

  it('opens on the review, prefilled, when the /onboarding skill sent a setup link', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    serve({ team: null, projects: [] })
    sessionStorage.setItem(
      SETUP_KEY,
      Buffer.from(
        JSON.stringify({
          you: { name: 'Alex Example' },
          agency: 'Fake Agency',
          project: 'Orchard Dash',
          client: 'Make-Believe Foods',
          clientRep: { name: 'Robin Fakeworth' },
        }),
      ).toString('base64url'),
    )
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain("Here's Orchard Dash. Shall I set it up?")
    expect(wrapper.get('.added').text()).toContain('Robin Fakeworth')
    expect(sessionStorage.getItem(SETUP_KEY)).toBeNull()
  })

  it('skips the agency question when the team already exists, and carries on after a failure without repeating itself', async () => {
    auth.currentUser.mockResolvedValue({ id: 'user_fake' })
    const fetchMock = serve({ team, projects: [] })
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.find('input[placeholder="Your agency"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Setting this up for Fake Agency.')
    await wrapper.get('input[placeholder="Your name"]').setValue('Alex Example')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('input[placeholder="Orchard Dash"]').setValue('Orchard Dash')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await button(wrapper, 'Skip for now').trigger('click')
    await flushPromises()

    // The first call to add a person fails once.
    const original = fetchMock.getMockImplementation()!
    let failed = false
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (!failed && new URL(url, 'https://day15.test').pathname.endsWith('/people')) {
        failed = true
        return Response.json({ error: 'The room is busy.' }, { status: 500 })
      }
      return original(url, init)
    })
    await button(wrapper, 'Set it up').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('The room is busy.')
    expect(button(wrapper, 'Back').attributes('disabled')).toBeDefined()

    await button(wrapper, 'Try again').trigger('click')
    await flushPromises()
    const projectCreations = fetchMock.mock.calls.filter(([url]) => new URL(String(url), 'https://day15.test').pathname === '/api/projects')
    expect(projectCreations).toHaveLength(1)
    expect(wrapper.text()).toContain('Orchard Dash is open.')
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
      lenses: ['procurement'],
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
