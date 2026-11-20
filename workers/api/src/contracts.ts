import type { Ask, Fact, Participant } from '@day15/shared/schema'
import type { TeamDirectory } from './directory/team-directory'
import type { ProjectRoom } from './room/project-room'

export interface Env {
  ANTHROPIC_API_KEY?: string
  /** Only for keys that aren't scoped to a workspace. */
  ANTHROPIC_WORKSPACE_ID?: string
  /** Overrides the WorkOS client picked from the request's host. */
  WORKOS_CLIENT_ID?: string
  /** One ProjectRoom per project, named by the project id. */
  ROOMS: DurableObjectNamespace<ProjectRoom>
  /** One TeamDirectory per agency owner, named by their WorkOS user id. */
  TEAMS: DurableObjectNamespace<TeamDirectory>
  ASSETS: Fetcher
}

export type RoomStub = DurableObjectStub<ProjectRoom>
export type DirectoryStub = DurableObjectStub<TeamDirectory>

export const API_PATH = '/api'
export const MCP_PATH = '/mcp'
export const MAX_LENS_ROUNDS = 3
/** Lens rounds run in `ctx.waitUntil`, which the runtime cuts off about 30 seconds after the response. */
export const LENS_ROUNDS_BUDGET_MS = 25_000

/** What the coach hands back after a person says something. */
export interface CoachReply {
  /** What the person reads: what the coach noted, then its one next ask. */
  reply: string
  /** The item that keeps what they said, word for word. */
  itemId: number
  /** Facts the coach took from it. */
  noted: Fact[]
  /** Asks it answered or made moot. */
  closed: Ask[]
  /** The one thing the coach needs next from this person, or null when it needs nothing. */
  ask: Ask | null
}

/** Who you are, where the project stands, and what the coach most needs from you. */
export interface OpeningBrief {
  reply: string
  ask: Ask | null
}

/** Who is calling the MCP server, and their project's room. */
export interface Identity {
  projectId: string
  room: RoomStub
  participant: Participant
}

/** One coach turn: keeps the message as an item, takes facts from it, closes asks it answers, sets the next ask. */
export type CoachTurn = (env: Env, room: RoomStub, participant: Participant, message: string) => Promise<CoachReply>

/** What the coach says when someone opens the room. */
export type OpeningBriefFn = (env: Env, room: RoomStub, participant: Participant) => Promise<OpeningBrief>

/**
 * Runs all five lenses on one snapshot, again while a round adds proposed facts, at most MAX_LENS_ROUNDS times and
 * within LENS_ROUNDS_BUDGET_MS. Never throws.
 */
export type RunLensRounds = (env: Env, room: RoomStub) => Promise<void>

/** Everything under MCP_PATH. */
export type HandleMcp = (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>

/** The only place an MCP caller's identity is worked out, so OAuth can replace the key in the address later. */
export type Identify = (request: Request, env: Env) => Promise<Identity | null>

/** Everything under API_PATH: the agency owner's signed-in API. */
export type HandleTeamApi = (request: Request, env: Env) => Promise<Response>
