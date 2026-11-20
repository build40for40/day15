import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PeopleSidebar from './PeopleSidebar.vue'

const person = (id: number, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name,
  persona: 'cfo',
  side: 'client',
  jobTitle: '',
  organisation: '',
  lenses: ['procurement'],
  notes: '',
  hasLink: true,
  addedBy: 'owner',
  createdAt: 'x',
  removedAt: null,
  ...overrides,
})

describe('PeopleSidebar', () => {
  it('marks who has a link and who the coach only heard about', () => {
    const people = [
      person(1, 'Robin Fakeworth', { jobTitle: 'Finance Director' }),
      person(2, 'Morgan Madeup', { hasLink: false, addedBy: 'coach' }),
      person(3, 'Pat Notreal', { hasLink: false }),
    ]
    const wrapper = mount(PeopleSidebar, { props: { people: people as never, selected: null } })
    const rows = wrapper.findAll('.person').map((row) => row.text())
    expect(rows).toEqual([
      'Robin FakeworthFinance DirectorHas a link',
      'Morgan MadeupMentioned, no link',
      'Pat NotrealNo link',
    ])
  })
})
