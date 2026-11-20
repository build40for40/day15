import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import App from './App.vue'

afterEach(() => window.history.replaceState(null, '', '/'))

describe('App', () => {
  it('asks which side you are on', () => {
    const wrapper = mount(App)
    expect(wrapper.findAll('nav a').map((link) => link.attributes('href'))).toEqual(['?as=agency', '?as=client'])
  })

  it('opens the coach for the side in the link', () => {
    window.history.replaceState(null, '', '/?as=client')
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('client side')
    expect(wrapper.find('#project').exists()).toBe(true)
  })

  it('ignores a side it does not know', () => {
    window.history.replaceState(null, '', '/?as=landlord')
    expect(mount(App).find('nav').exists()).toBe(true)
  })
})
