import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import CoachChat from './CoachChat.vue'
import type { MySide } from '@day15/shared/schema'

afterEach(() => vi.unstubAllGlobals())

/** A fetch that answers the first GET with `mine` and each coach POST with the next reply. */
function api(mine: MySide, replies: unknown[]) {
  const posts: unknown[] = []
  const fetch = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') return Promise.resolve(Response.json(mine))
    posts.push(JSON.parse(init.body as string))
    return Promise.resolve(Response.json(replies[posts.length - 1]))
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, posts }
}

const props = { party: 'agency' as const, projectId: 'abc' }
const fresh: MySide = { project: '', turns: [], otherSideStarted: false }

describe('CoachChat', () => {
  it('asks, takes an answer, and hands it over with the hidden hat for the next question', async () => {
    const { fetch, posts } = api(fresh, [
      { lens: 'ops', question: 'What does done look like?', why: 'So nobody guesses.' },
      { lens: 'agency', question: 'Who signs it off?', why: 'So it can end.' },
    ])

    const wrapper = mount(CoachChat, { props })
    await flushPromises()
    expect(fetch.mock.calls[0]![0]).toMatch(/api\/projects\/abc\/agency$/)

    await wrapper.get('#project').setValue('  A site for a fictional biscuit brand.  ')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('What does done look like?'))
    expect(posts[0]).toEqual({ party: 'agency', project: 'A site for a fictional biscuit brand.' })

    await wrapper.get('#answer').setValue('Live by March.')
    await vi.waitFor(() => expect(wrapper.get('form button').attributes('disabled')).toBeUndefined())
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Who signs it off?'))
    expect(posts[1]).toMatchObject({
      turn: { lens: 'ops', question: 'What does done look like?', answer: 'Live by March.' },
    })
    expect(wrapper.find('.turns').text()).toContain('Live by March.')
  })

  it('never shows which hat the coach has on', async () => {
    api(fresh, [{ lens: 'ops', question: 'Who can change the scope?', why: 'It always changes.' }])
    const wrapper = mount(CoachChat, { props })
    await flushPromises()
    await wrapper.get('#project').setValue('A fictional app.')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Who can change the scope?'))
    expect(wrapper.text().toLowerCase()).not.toContain('procurement')
  })

  it('picks up a conversation that was already going', async () => {
    const turn = { lens: 'agency' as const, question: 'Who pays for overruns?', answer: 'We split it.' }
    const { posts } = api({ project: 'A fictional app.', turns: [turn], otherSideStarted: true }, [
      { lens: 'agency', question: 'Who has the final say?', why: 'Someone must.' },
    ])
    const wrapper = mount(CoachChat, { props })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Who has the final say?'))
    expect(wrapper.find('.turns').text()).toContain('We split it.')
    expect(posts[0]).toEqual({ party: 'agency', project: 'A fictional app.' })
  })

  it('says so when the project does not exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })))
    const wrapper = mount(CoachChat, { props })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain("doesn't lead anywhere")
  })
})
