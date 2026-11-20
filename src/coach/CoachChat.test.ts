import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import CoachChat from './CoachChat.vue'

afterEach(() => vi.unstubAllGlobals())

function streamed(value: unknown) {
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      for (const piece of JSON.stringify(value).match(/.{1,8}/g) ?? []) controller.enqueue(encoder.encode(piece))
      controller.close()
    },
  })
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

const sent = (fetch: ReturnType<typeof vi.fn>, call: number) => JSON.parse(fetch.mock.calls[call]![1].body)

describe('CoachChat', () => {
  it('asks, takes an answer, and sends the conversation back for the next question', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(streamed({ question: 'What does done look like?', why: 'So nobody guesses.' }))
      .mockResolvedValueOnce(streamed({ question: 'Who signs it off?', why: 'So it can end.' }))
    vi.stubGlobal('fetch', fetch)

    const wrapper = mount(CoachChat, { props: { party: 'agency' } })
    await wrapper.get('#project').setValue('  A site for a fictional biscuit brand.  ')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('What does done look like?'))
    expect(sent(fetch, 0)).toEqual({
      party: 'agency',
      lens: 'agency',
      project: 'A site for a fictional biscuit brand.',
      turns: [],
    })

    await wrapper.get('#answer').setValue('Live by March.')
    await vi.waitFor(() => expect(wrapper.get('form button').attributes('disabled')).toBeUndefined())
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Who signs it off?'))
    expect(sent(fetch, 1).turns).toEqual([
      { lens: 'agency', question: 'What does done look like?', answer: 'Live by March.' },
    ])
    expect(wrapper.find('.turns').text()).toContain('Live by March.')
  })

  it('swaps the question when the lens changes', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(streamed({ question: 'First question?', why: 'Because.' }))
      .mockResolvedValueOnce(streamed({ question: 'Who finds the extra money?', why: 'Because money.' }))
    vi.stubGlobal('fetch', fetch)

    const wrapper = mount(CoachChat, { props: { party: 'client' } })
    await wrapper.get('#project').setValue('A fictional app.')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('First question?'))

    const money = wrapper.findAll('.lenses button').find((button) => button.text() === 'Money')!
    await money.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Who finds the extra money?'))
    expect(sent(fetch, 1)).toMatchObject({ lens: 'cfo', turns: [] })
    expect(money.attributes('aria-pressed')).toBe('true')
  })
})
