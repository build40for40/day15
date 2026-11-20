import { describe, expect, it } from 'vitest'

import { blocker, lonelySide, seats, type Draft, type Guest } from './onboarding'

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
