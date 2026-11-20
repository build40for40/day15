import { describe, expect, it, vi } from 'vitest'

import {
  blocker,
  captureSetup,
  CLIENT_REP_KEY,
  lonelySide,
  newGuest,
  parseSetup,
  PROCUREMENT_KEY,
  seats,
  SETUP_KEY,
  takeSetup,
  type Draft,
  type Guest,
} from './onboarding'

const guest = (overrides: Partial<Guest> = {}): Guest => ({
  key: 1,
  name: 'Robin Fakeworth',
  persona: 'cfo',
  side: 'client',
  link: true,
  jobTitle: '',
  organisation: '',
  lenses: [],
  notes: '',
  ...overrides,
})

const draft = (overrides: Partial<Draft> = {}): Draft => ({
  clientRep: newGuest(CLIENT_REP_KEY, 'marketing_lead', 'client'),
  procurementRep: newGuest(PROCUREMENT_KEY, 'procurement', 'client'),
  yourName: 'Alex Example',
  yourJobTitle: '',
  agencyName: 'Fake Agency',
  projectName: 'Orchard Dash',
  clientName: 'Make-Believe Foods',
  guests: [],
  ...overrides,
})

describe('seats', () => {
  it('puts the person setting up first, as the agency lead with a link', () => {
    const [you] = seats(draft(), 'Fake Agency')
    expect(you).toMatchObject({
      you: true,
      link: true,
      details: { name: 'Alex Example', side: 'agency', persona: 'agency_lead', organisation: 'Fake Agency', lenses: ['agency'] },
    })
  })

  it('takes each organisation from the side, so nobody is asked twice', () => {
    const people = seats(
      draft({
        guests: [
          guest({ name: ' Robin Fakeworth ' }),
          guest({ key: 2, name: 'Sam Pretend', persona: 'delivery_lead', side: 'agency', link: false }),
        ],
      }),
      'Fake Agency',
    )
    expect(people.map((p) => [p.details.name, p.details.organisation, p.details.lenses, p.link])).toEqual([
      ['Alex Example', 'Fake Agency', ['agency'], true],
      ['Robin Fakeworth', 'Make-Believe Foods', ['cfo'], true],
      ['Sam Pretend', 'Fake Agency', ['cto'], false],
    ])
  })
})

describe('the three seats', () => {
  const named = (key: number, persona: 'marketing_lead' | 'procurement', name: string) => ({
    ...newGuest(key, persona, 'client'),
    name,
  })

  it('makes the agency rep, then the client rep and client procurement once they are named', () => {
    const people = seats(
      draft({
        clientRep: named(CLIENT_REP_KEY, 'marketing_lead', 'Robin Fakeworth'),
        procurementRep: named(PROCUREMENT_KEY, 'procurement', 'Pat Pretend'),
      }),
      'Fake Agency',
    )
    expect(people.map((p) => [p.details.name, p.details.persona, p.details.side, p.details.lenses, p.link])).toEqual([
      ['Alex Example', 'agency_lead', 'agency', ['agency'], true],
      ['Robin Fakeworth', 'marketing_lead', 'client', ['client'], true],
      ['Pat Pretend', 'procurement', 'client', ['procurement'], true],
    ])
  })

  it('leaves out a seat nobody has named', () => {
    expect(seats(draft(), 'Fake Agency')).toHaveLength(1)
  })

  it('counts a named client rep as someone on the client side', () => {
    expect(lonelySide(draft({ clientRep: named(CLIENT_REP_KEY, 'marketing_lead', 'Robin') }))).toBeNull()
  })
})

describe('seats with more detail', () => {
  it('keeps a title, an organisation, chosen lenses and notes, and trims them', () => {
    const [you, robin] = seats(
      draft({
        yourJobTitle: ' Managing Director ',
        guests: [
          guest({
            jobTitle: ' Finance Director ',
            organisation: ' Make-Believe Holdings ',
            lenses: ['cfo', 'procurement'],
            notes: ' Reports to the CEO. Signs off the budget. ',
          }),
        ],
      }),
      'Fake Agency',
    )
    expect(you!.details.jobTitle).toBe('Managing Director')
    expect(robin!.details).toMatchObject({
      jobTitle: 'Finance Director',
      organisation: 'Make-Believe Holdings',
      lenses: ['cfo', 'procurement'],
      notes: 'Reports to the CEO. Signs off the budget.',
    })
  })
})

describe('blocker', () => {
  it('wants a name and, for a new team, an agency name', () => {
    expect(blocker('hello', draft({ yourName: ' ' }), true)).toBe('Tell me your name.')
    expect(blocker('hello', draft({ agencyName: '' }), true)).toBe('What is your agency called?')
    expect(blocker('hello', draft({ agencyName: '' }), false)).toBeNull()
  })

  it('wants a project name but nothing else on the later steps', () => {
    expect(blocker('project', draft({ projectName: '' }), false)).toBe('Give the project a name.')
    expect(blocker('people', draft(), false)).toBeNull()
  })
})

describe('lonelySide', () => {
  it('flags a project with nobody on the client side', () => {
    expect(lonelySide(draft())).toBe('client')
    expect(lonelySide(draft({ guests: [guest()] }))).toBeNull()
  })
})

const encode = (value: unknown) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')

describe('a setup made in chat', () => {
  const setup = {
    v: 1,
    you: { name: 'Alex Example', jobTitle: 'Managing Director' },
    agency: 'Fake Agency',
    project: 'Orchard Dash',
    client: 'Make-Believe Foods',
    clientRep: { name: 'Robin Fakeworth', jobTitle: 'Head of Brand', lenses: ['client', 'procurement', 'nonsense'], notes: 'Signs off the brief.' },
    procurementRep: { name: 'Pat Pretend' },
    others: [{ name: 'Sam Pretend', persona: 'delivery_lead', side: 'agency' }, { name: '' }, { name: 'Lee Odd', persona: 'wizard', side: 'moon' }],
  }

  it('reads every answer, with accents and unknown values handled', () => {
    const parsed = parseSetup(encode({ ...setup, project: 'Café Orchard ✨' }))!
    expect(parsed).toMatchObject({
      yourName: 'Alex Example',
      yourJobTitle: 'Managing Director',
      agencyName: 'Fake Agency',
      projectName: 'Café Orchard ✨',
      clientName: 'Make-Believe Foods',
    })
    expect(parsed.clientRep).toMatchObject({ name: 'Robin Fakeworth', persona: 'marketing_lead', side: 'client', lenses: ['client', 'procurement'], notes: 'Signs off the brief.', link: true })
    expect(parsed.procurementRep).toMatchObject({ name: 'Pat Pretend', persona: 'procurement', lenses: ['procurement'] })
    expect(parsed.guests.map((g) => [g.name, g.persona, g.side])).toEqual([
      ['Sam Pretend', 'delivery_lead', 'agency'],
      ['Lee Odd', 'marketing_lead', 'client'],
    ])
    expect(seats(parsed, 'Fake Agency').map((seat) => seat.details.name)).toEqual(['Alex Example', 'Robin Fakeworth', 'Pat Pretend', 'Sam Pretend', 'Lee Odd'])
  })

  it('gives null for anything that is not a setup, and cuts overlong text', () => {
    expect(parseSetup('not base64 at all!!')).toBeNull()
    expect(parseSetup(encode('just a string'))).toBeNull()
    expect(parseSetup(encode({ project: 'x'.repeat(500) }))!.projectName).toHaveLength(80)
  })

  it('moves a setup from the address bar to session storage, then hands it over once', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as unknown as Storage
    const replaceState = vi.fn()
    const encoded = encode(setup)
    captureSetup({ hash: `#setup=${encoded}`, pathname: '/', search: '?x=1' } as Location, { replaceState } as unknown as History, storage)
    expect(store.get(SETUP_KEY)).toBe(encoded)
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?x=1')
    expect(takeSetup(storage)!.projectName).toBe('Orchard Dash')
    expect(takeSetup(storage)).toBeNull()
  })

  it('ignores any other fragment', () => {
    const replaceState = vi.fn()
    captureSetup({ hash: '#other', pathname: '/', search: '' } as Location, { replaceState } as unknown as History, {} as Storage)
    expect(replaceState).not.toHaveBeenCalled()
  })
})
