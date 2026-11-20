// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { legacyRedirect } from './hosts'

describe('legacyRedirect', () => {
  it('sends the old build40for40.com/day15 addresses to the same path on day15.build40for40.com', () => {
    const moved = legacyRedirect(new URL('https://build40for40.com/day15/api/session?x=1'))
    expect(moved?.status).toBe(308)
    expect(moved?.headers.get('Location')).toBe('https://day15.build40for40.com/api/session?x=1')
    expect(legacyRedirect(new URL('https://build40for40.com/day15'))?.headers.get('Location')).toBe(
      'https://day15.build40for40.com/',
    )
  })

  it('leaves everything else alone', () => {
    expect(legacyRedirect(new URL('https://day15.build40for40.com/day15/x'))).toBeNull()
    expect(legacyRedirect(new URL('https://build40for40.com/day150'))).toBeNull()
  })
})
