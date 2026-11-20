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
  lenses: ['cfo'],
  notes: '',
  hasLink: true,
  addedBy: 'owner',
  createdAt: 'x',
  removedAt: null,
  ...overrides,
})

const project = (id: string, name: string, participants: ReturnType<typeof person>[] = []) => ({
  id,
  name,
  createdAt: 'x',
  participants,
})

describe('PeopleSidebar', () => {
  it('marks who has a link and who the coach only heard about', () => {
    const current = project('p1', 'Orchard Dash', [
      person(1, 'Robin Fakeworth', { jobTitle: 'Finance Director' }),
      person(2, 'Morgan Madeup', { hasLink: false, addedBy: 'coach' }),
      person(3, 'Pat Notreal', { hasLink: false }),
    ])
    const wrapper = mount(PeopleSidebar, { props: { projects: [current] as never, project: current as never, selected: null } })
    const rows = wrapper.findAll('.person').map((row) => row.text())
    expect(rows).toEqual([
      'Robin FakeworthFinance DirectorHas a link',
      'Morgan MadeupMentioned, no link',
      'Pat NotrealNo link',
    ])
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('offers a project switcher once there is more than one project', async () => {
    const projects = [project('p1', 'Orchard Dash'), project('p2', 'Biscuit Bonanza')]
    const wrapper = mount(PeopleSidebar, { props: { projects: projects as never, project: projects[0] as never, selected: null } })
    await wrapper.get('select').setValue('p2')
    expect(wrapper.emitted('switchProject')).toEqual([['p2']])
  })
})
