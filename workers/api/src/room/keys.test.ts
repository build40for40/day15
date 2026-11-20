// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { formatKey, hashSecret, newSecret, parseKey } from './keys'

const PROJECT = '00000000-0000-4000-8000-000000000015'

describe('keys', () => {
  it('round-trips a project id and a fresh secret', () => {
    const secret = newSecret()
    expect(parseKey(formatKey(PROJECT, secret))).toEqual({ projectId: PROJECT, secret })
    expect(newSecret()).not.toBe(secret)
  })

  it('refuses anything that is not exactly a project id and a secret', () => {
    const secret = newSecret()
    for (const key of ['', PROJECT, `${PROJECT}.`, `not-a-project.${secret}`, `${PROJECT}.${secret}.extra`, `${PROJECT}.short`]) {
      expect(parseKey(key)).toBeNull()
    }
  })

  it('hashes the same secret the same way, as hex', async () => {
    expect(await hashSecret('fake')).toBe(await hashSecret('fake'))
    expect(await hashSecret('fake')).toMatch(/^[0-9a-f]{64}$/)
  })
})
