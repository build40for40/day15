// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import type { Env } from '../contracts'
import { ModelUnavailableError } from '../model'
import { FIXTURE_PROJECT } from '../room/fixture'
import { formatKey } from '../room/keys'
import { fixtureRoom } from '../testing'
import { createHandleMcp } from './server'
import { OPEN_ROOM_TOOL, READ_ROOM_TOOL, SERVER_INSTRUCTIONS, TELL_COACH_TOOL } from './text'

async function setup() {
  const fixture = await fixtureRoom()
  const env = { ROOMS: { getByName: () => fixture.stub } } as unknown as Env
  const deps = {
    coachTurn: vi.fn(async () => ({ reply: 'Noted. What does done look like?', itemId: 1, noted: [], people: [], closed: [], ask: null })),
    openingBrief: vi.fn(async () => ({ reply: 'Hello Casey.', ask: null })),
    runLensRounds: vi.fn(async () => {}),
  }
  const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} } as unknown as ExecutionContext
  const url = `https://a-line.build40for40.com/mcp/${formatKey(FIXTURE_PROJECT.id, fixture.people.casey.secret)}`
  const handleMcp = createHandleMcp(deps)
  let id = 0
  const rpc = async (method: string, params: Record<string, unknown> = {}) => {
    const response = await handleMcp(
      new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
      }),
      env,
      ctx,
    )
    const body = await response.text()
    const data = body.split('\n').find((line) => line.startsWith('data: '))
    return { status: response.status, message: JSON.parse(data ? data.slice(6) : body) }
  }
  return { ...fixture, env, deps, ctx, url, handleMcp, rpc }
}

describe('handleMcp', () => {
  it('answers a wrong or malformed key with a bare 404', async () => {
    const { env, ctx, handleMcp, people } = await setup()
    const wrongSecret = people.casey.secret.replace(/^./, (c) => (c === 'A' ? 'B' : 'A'))
    for (const path of [`/mcp/${formatKey(FIXTURE_PROJECT.id, wrongSecret)}`, '/mcp/not-a-key', '/mcp']) {
      const response = await handleMcp(new Request(`https://a-line.build40for40.com${path}`, { method: 'POST' }), env, ctx)
      expect(response.status).toBe(404)
      expect(await response.text()).toBe('Not found')
    }
  })

  it('gives the client the relay instructions when it connects', async () => {
    const { rpc } = await setup()
    const { message } = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '0.0.0' },
    })
    expect(message.result.instructions).toBe(SERVER_INSTRUCTIONS)
  })

  it('marks a failed tool call as an error', async () => {
    const { rpc, deps } = await setup()
    deps.openingBrief.mockRejectedValueOnce(new ModelUnavailableError())
    const { message } = await rpc('tools/call', { name: OPEN_ROOM_TOOL.name, arguments: {} })
    expect(message.result).toEqual({ content: [{ type: 'text', text: new ModelUnavailableError().message }], isError: true })
  })

  it('lists the three tools', async () => {
    const { rpc } = await setup()
    const { message } = await rpc('tools/list')
    expect(message.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(
      [OPEN_ROOM_TOOL.name, READ_ROOM_TOOL.name, TELL_COACH_TOOL.name].sort(),
    )
  })

  it('relays tell_coach for the caller the key names', async () => {
    const { rpc, deps, people, ctx } = await setup()
    const { message } = await rpc('tools/call', { name: TELL_COACH_TOOL.name, arguments: { message: 'Launch is July.' } })
    expect(message.result.content).toEqual([{ type: 'text', text: 'Noted. What does done look like?' }])
    expect(deps.coachTurn).toHaveBeenCalledWith(expect.anything(), expect.anything(), people.casey.participant, 'Launch is July.')
    expect(ctx.waitUntil).toHaveBeenCalledOnce()
  })
})
