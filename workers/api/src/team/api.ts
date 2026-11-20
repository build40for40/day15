import { MAX_ITEM_LENGTH, MAX_NAME_LENGTH, newParticipantSchema, participantUpdateSchema } from '@day15/shared/schema'
import { z } from 'zod'

import { API_PATH, MCP_PATH, type CoachTurn, type Env, type HandleTeamApi } from '../contracts'
import { DirectoryError } from '../directory/store'
import { logModelError } from '../model'
import { formatKey, isProjectId } from '../room/keys'
import { RoomError } from '../room/room'
import { sideView } from '../room/side-view'

export type SignedIn = (request: Request, env: Env) => Promise<string | null>

const nameBody = z.object({ name: z.string().trim().min(1).max(MAX_NAME_LENGTH) })

const newPersonBody = newParticipantSchema.extend({ link: z.boolean().optional() })

const sayBody = z.object({ participantId: z.number().int().positive(), message: z.string().trim().min(1).max(MAX_ITEM_LENGTH) })

/** What the owner's page needs to talk to the coach on someone's behalf. Left out in tests that do not need it. */
export interface TeamDeps {
  coachTurn: CoachTurn
}

const SAFE_COACH_ERRORS = new Set(['CoachError', 'ModelUnavailableError'])

const PERSON_RULES = 'Each person needs a name, a persona and a side, and the rest has to be short enough.'

const json = (body: unknown, status = 200) => Response.json(body, { status })
const fail = (message: string, status: number) => json({ error: message }, status)

async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T> | null> {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  return parsed.success ? parsed.data : null
}

const address = (url: URL, projectId: string, secret: string) =>
  `${url.origin}${MCP_PATH}/${formatKey(projectId, secret)}`

/** The agency owner's API, behind a sign-in check that is passed in so tests can fake it. */
export function createTeamApi(signedIn: SignedIn, deps?: TeamDeps): HandleTeamApi {
  return async (request, env) => {
    const signedInId = await signedIn(request, env)
    if (!signedInId) return fail('Sign in first.', 401)
    const userId: string = signedInId

    const url = new URL(request.url)
    const segments = url.pathname.slice(API_PATH.length).split('/').filter(Boolean)
    const directory = env.TEAMS.getByName(userId)
    const { method } = request

    const projectsWithPeople = async () =>
      Promise.all(
        (await directory.projects()).map(async (project) => ({
          ...project,
          participants: await env.ROOMS.getByName(project.id).participants(),
        })),
      )

    async function route(): Promise<Response> {
      const [head, projectId, tail, personId, action] = segments

      if (head === 'session' && segments.length === 1) {
        if (method !== 'GET') return fail('Use GET.', 405)
        const team = await directory.team()
        return json({ userId, team, projects: team ? await projectsWithPeople() : [] })
      }

      if (head === 'team' && segments.length === 1) {
        if (method !== 'POST') return fail('Use POST.', 405)
        const body = await readBody(request, nameBody)
        if (!body) return fail(`Give your team a name under ${MAX_NAME_LENGTH} characters.`, 400)
        const { team, created } = await directory.createTeam({ name: body.name, ownerId: userId })
        return json({ team }, created ? 201 : 200)
      }

      if (head === 'projects' && segments.length === 1) {
        if (method === 'GET') return json({ projects: await projectsWithPeople() })
        if (method !== 'POST') return fail('Use GET or POST.', 405)
        if (!(await directory.team())) return fail('Set up your team first.', 409)
        const body = await readBody(request, nameBody)
        if (!body) return fail(`Give the project a name under ${MAX_NAME_LENGTH} characters.`, 400)
        const id = crypto.randomUUID()
        await env.ROOMS.getByName(id).create({ id, name: body.name, ownerId: userId })
        const project = await directory.addProject({ id, name: body.name })
        return json({ project: { ...project, participants: [] } }, 201)
      }

      if (head === 'projects' && projectId && (tail === 'people' || tail === 'room' || tail === 'say')) {
        if (!isProjectId(projectId) || !(await directory.hasProject(projectId))) return fail('No such project.', 404)
        const room = env.ROOMS.getByName(projectId)

        if (tail === 'room') {
          if (segments.length !== 3) return fail('Not found.', 404)
          if (method !== 'GET') return fail('Use GET.', 405)
          const snapshot = await room.read()
          if (!snapshot) return fail('No such project.', 404)
          const { facts, openQuestions } = sideView(snapshot, 'agency')
          return json({ room: { facts, openQuestions, asks: snapshot.asks.filter((ask) => ask.status === 'open') } })
        }

        if (tail === 'say') {
          if (segments.length !== 3) return fail('Not found.', 404)
          if (method !== 'POST') return fail('Use POST.', 405)
          if (!deps) return fail('Talking to the coach from here is not set up.', 501)
          const body = await readBody(request, sayBody)
          if (!body) return fail('Say something, and say who is speaking.', 400)
          const speaker = (await room.participants()).find((person) => person.id === body.participantId && !person.removedAt)
          if (!speaker) return fail('No such person.', 404)
          // The owner can already give anyone a link, but the client's side stays the client's own.
          if (speaker.side !== 'agency') return fail('You can speak here for people on the agency side. The client talks to the coach from their own link.', 403)
          const { reply } = await deps.coachTurn(env, room, speaker, body.message)
          try {
            await room.scheduleLensRounds()
          } catch (error) {
            logModelError('Scheduling lens rounds', error)
          }
          return json({ reply })
        }

        if (segments.length === 3) {
          if (method !== 'POST') return fail('Use POST.', 405)
          const body = await readBody(request, newPersonBody)
          if (!body) return fail(PERSON_RULES, 400)
          const { link, ...person } = body
          const { participant, secret } = await room.addParticipant(person, { link })
          return json({ participant, address: secret ? address(url, projectId, secret) : null }, 201)
        }

        const id = Number(personId)
        if (!Number.isSafeInteger(id) || id < 1) return fail('No such person.', 404)

        if (segments.length === 4) {
          if (method === 'PATCH') {
            const body = await readBody(request, participantUpdateSchema)
            if (!body) return fail(PERSON_RULES, 400)
            const participant = await room.updateParticipant(id, body)
            return participant ? json({ participant }) : fail('No such person.', 404)
          }
          if (method === 'DELETE') {
            const participant = await room.removeParticipant(id)
            return participant ? json({ participant }) : fail('No such person.', 404)
          }
          return fail('Use PATCH or DELETE.', 405)
        }

        if (segments.length === 5 && action === 'address') {
          if (method !== 'POST') return fail('Use POST.', 405)
          const result = await room.resetKey(id)
          if (!result) return fail('No such person.', 404)
          return json({ participant: result.participant, address: address(url, projectId, result.secret) })
        }
      }

      return fail('Not found.', 404)
    }

    try {
      return await route()
    } catch (error) {
      if (error instanceof RoomError || error instanceof DirectoryError) return fail(error.message, 400)
      if (error instanceof Error && SAFE_COACH_ERRORS.has(error.name)) return fail(error.message, 503)
      console.error('team api failed:', error instanceof Error ? error.name : 'Unknown error')
      return fail('Something went wrong on our side.', 500)
    }
  }
}
