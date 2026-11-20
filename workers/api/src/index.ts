import { API_PATH, MCP_PATH, type Env } from './contracts'
import { isUnder, legacyRedirect } from './hosts'
import { handleMcp } from './mcp'
import { handleTeamApi } from './team'

export { TeamDirectory } from './directory/team-directory'
export { ProjectRoom } from './room/project-room'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const moved = legacyRedirect(url)
    if (moved) return moved
    if (isUnder(url.pathname, MCP_PATH)) return handleMcp(request, env, ctx)
    if (isUnder(url.pathname, API_PATH)) return handleTeamApi(request, env)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
