import { MAX_ITEM_LENGTH, topicSchema } from '@day15/shared/schema'
import { McpServer } from '@modelcontextprotocol/server'
import { createMcpHandler } from 'agents/mcp/server'
import { z } from 'zod'

import type { HandleMcp } from '../contracts'
import { identify } from './identify'
import { OPEN_ROOM_TOOL, READ_ROOM_TOOL, SERVER_INSTRUCTIONS, SERVER_NAME, TELL_COACH_TOOL } from './text'
import { openRoom, readRoom, tellCoach, type McpDeps, type ToolContext, type ToolResult } from './tools'

const asCallResult = ({ text, isError }: ToolResult) => ({ content: [{ type: 'text' as const, text }], ...(isError && { isError }) })

/** A fresh server per request for one known caller: clients send no conversation id, so nothing is kept between calls. */
export function createRoomServer(context: ToolContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: '0.1.0' }, { instructions: SERVER_INSTRUCTIONS })

  server.registerTool(
    OPEN_ROOM_TOOL.name,
    { title: OPEN_ROOM_TOOL.title, description: OPEN_ROOM_TOOL.description, annotations: OPEN_ROOM_TOOL.annotations },
    async () => asCallResult(await openRoom(context)),
  )

  server.registerTool(
    TELL_COACH_TOOL.name,
    {
      title: TELL_COACH_TOOL.title,
      description: TELL_COACH_TOOL.description,
      inputSchema: z.object({ message: z.string().trim().min(1).max(MAX_ITEM_LENGTH).describe(TELL_COACH_TOOL.message) }),
      annotations: TELL_COACH_TOOL.annotations,
    },
    async ({ message }) => asCallResult(await tellCoach(context, message)),
  )

  server.registerTool(
    READ_ROOM_TOOL.name,
    {
      title: READ_ROOM_TOOL.title,
      description: READ_ROOM_TOOL.description,
      inputSchema: z.object({
        topic: topicSchema.optional().describe(READ_ROOM_TOOL.topic),
        only_open_questions: z.boolean().optional().describe(READ_ROOM_TOOL.onlyOpenQuestions),
      }),
      annotations: READ_ROOM_TOOL.annotations,
    },
    async ({ topic, only_open_questions }) =>
      asCallResult(await readRoom(context, { topic, onlyOpenQuestions: only_open_questions })),
  )

  return server
}

/** Unknown and malformed keys get the same bare 404, so the address never says whether a project exists. */
export function createHandleMcp(deps: McpDeps): HandleMcp {
  return async (request, env, ctx) => {
    const identity = await identify(request, env)
    if (!identity) return new Response('Not found', { status: 404 })
    const handler = createMcpHandler(() => createRoomServer({ env, identity, deps }), {
      route: new URL(request.url).pathname,
      onerror: (error) => console.error('MCP request failed:', error.name),
    })
    return handler(request, env, ctx)
  }
}
