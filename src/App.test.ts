import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import App from './App.vue'

const ID = '00000000-0000-4000-8000-000000000000'

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('starts a project on the side you pick and gives you a link for the other side', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'POST' && url.endsWith('api/projects')
          ? Response.json({ id: ID })
          : Response.json({ project: '', turns: [], otherSideStarted: false }),
      ),
    )
    vi.stubGlobal('fetch', fetch)

    const wrapper = mount(App)
    await wrapper.findAll('nav button')[0]!.trigger('click')
    await flushPromises()

    expect(window.location.search).toBe(`?p=${ID}&as=agency`)
    expect(wrapper.text()).toContain('agency side')
    expect(wrapper.get('aside a').attributes('href')).toContain(`?p=${ID}&as=client`)
    expect(wrapper.find('#project').exists()).toBe(true)
  })

  it('asks which side you are on when the link only names a project', () => {
    window.history.replaceState(null, '', `/?p=${ID}`)
    const wrapper = mount(App)
    expect(wrapper.findAll('nav a').map((link) => link.attributes('href'))).toEqual([
      `?p=${ID}&as=agency`,
      `?p=${ID}&as=client`,
    ])
  })
})
