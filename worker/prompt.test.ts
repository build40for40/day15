// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { instructions, messages } from './prompt'

describe('coach prompt', () => {
  it('names the party, the other side and the lens focus', () => {
    const text = instructions({ party: 'client', lens: 'cfo' })
    expect(text).toContain('someone on the client side')
    expect(text).toContain('The agency side has its own separate conversation')
    expect(text).toContain('"Money" lens')
    expect(text).toContain('contingency')
  })

  it('starts with the project and ends on the last answer', () => {
    const result = messages({
      project: 'A new website for a fictional biscuit brand.',
      turns: [{ lens: 'cto', question: 'What does done look like?', answer: 'It is live by March.' }],
    })
    expect(result.map((message) => message.role)).toEqual(['user', 'assistant', 'user'])
    expect(result[0]!.content).toContain('fictional biscuit brand')
    expect(result[1]!.content).toBe('(Delivery lens) What does done look like?')
    expect(result[2]!.content).toBe('It is live by March.')
  })
})
