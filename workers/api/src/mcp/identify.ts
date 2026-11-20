import { MCP_PATH, type Identify } from '../contracts'
import { parseKey } from '../room/keys'

/** The key from `/mcp/<projectId>.<secret>`, or null. */
export function keyFromPath(pathname: string): string | null {
  const match = pathname.match(new RegExp(`^${MCP_PATH}/([^/]+)/?$`))
  return match ? decodeURIComponent(match[1]!) : null
}

/** Today the key in the address says who is calling. OAuth replaces this function, and nothing else. */
export const identify: Identify = async (request, env) => {
  const key = keyFromPath(new URL(request.url).pathname)
  const parsed = key ? parseKey(key) : null
  if (!parsed) return null
  const room = env.ROOMS.getByName(parsed.projectId)
  const participant = await room.identify(parsed.secret)
  return participant ? { projectId: parsed.projectId, room, participant } : null
}
