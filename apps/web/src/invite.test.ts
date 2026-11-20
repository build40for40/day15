import { describe, expect, it } from 'vitest'

import { inviteMessage, whatsappUrl } from './invite'

const ADDRESS = 'https://day15.test/mcp/11111111-1111-4111-8111-111111111111.fake-secret'

describe('inviteMessage', () => {
  it('greets the person by first name and carries the project, the link and what to say first', () => {
    const message = inviteMessage({ personName: ' Robin  Fakeworth', projectName: 'Orchard Dash', address: ADDRESS })
    expect(message).toMatch(/^Hi Robin, you're on "Orchard Dash" in A-Line/)
    expect(message).toContain(`\n${ADDRESS}\n`)
    expect(message).toContain('"Open my A-Line room."')
  })
})

describe('whatsappUrl', () => {
  it('opens WhatsApp with the whole message and no number picked', () => {
    const message = inviteMessage({ personName: 'Robin', projectName: 'Tea & Cake?', address: ADDRESS })
    const url = new URL(whatsappUrl(message))
    expect(url.origin + url.pathname).toBe('https://wa.me/')
    expect(url.searchParams.get('text')).toBe(message)
  })
})
