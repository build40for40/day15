// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { legacyRedirect } from './hosts'

const location = (from: string) => legacyRedirect(new URL(from))?.headers.get('Location')

describe('legacyRedirect', () => {
  it('sends the old build40for40.com/day15 addresses to the same path on a-line.build40for40.com', () => {
    const moved = legacyRedirect(new URL('https://build40for40.com/day15/api/session?x=1'))
    expect(moved?.status).toBe(308)
    expect(moved?.headers.get('Location')).toBe('https://a-line.build40for40.com/api/session?x=1')
    expect(location('https://build40for40.com/day15')).toBe('https://a-line.build40for40.com/')
    expect(location('https://www.build40for40.com/day15/mcp/abc.def')).toBe('https://a-line.build40for40.com/mcp/abc.def')
  })

  it('sends day15.build40for40.com to the same path and query on a-line.build40for40.com', () => {
    const moved = legacyRedirect(new URL('https://day15.build40for40.com/mcp/abc.def?x=1'))
    expect(moved?.status).toBe(308)
    expect(moved?.headers.get('Location')).toBe('https://a-line.build40for40.com/mcp/abc.def?x=1')
    expect(location('https://day15.build40for40.com/')).toBe('https://a-line.build40for40.com/')
    expect(location('https://day15.build40for40.com/api/projects?x=1')).toBe('https://a-line.build40for40.com/api/projects?x=1')
  })

  it('leaves everything else alone', () => {
    expect(legacyRedirect(new URL('https://a-line.build40for40.com/mcp/abc.def'))).toBeNull()
    expect(legacyRedirect(new URL('https://a-line.build40for40.com/day15/x'))).toBeNull()
    expect(legacyRedirect(new URL('https://build40for40.com/day150'))).toBeNull()
    expect(legacyRedirect(new URL('https://day15-preview.example.workers.dev/'))).toBeNull()
  })
})
