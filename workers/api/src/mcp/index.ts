import type { HandleMcp } from '../contracts'
import { identify } from './identify'

export const handleMcp: HandleMcp = async (request, env) => {
  if (!(await identify(request, env))) return new Response("That address doesn't lead anywhere.", { status: 404 })
  return new Response('The MCP server is not built yet.', { status: 501 })
}
