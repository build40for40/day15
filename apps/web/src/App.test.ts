import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import App from './App.vue'

describe('App', () => {
  it('names the app', () => {
    expect(mount(App).get('h1').text()).toBe('Expectation Manager')
  })
})
