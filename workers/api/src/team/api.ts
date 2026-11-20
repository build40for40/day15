import { MAX_NAME_LENGTH, newParticipantSchema, participantUpdateSchema } from '@day15/shared/schema'
import { z } from 'zod'

import { API_PATH, MCP_PATH, type Env, type HandleTeamApi } from '../contracts'
import { DirectoryError } from '../directory/store'
import { formatKey, isProjectId } from '../room/keys'
import { RoomError } from '../room/room'

export type SignedIn = (request: Request, env: Env) => Promise<string | null>

const nameBody = z.object({ name: z.string().trim().min(1).max(MAX_NAME_LENGTH) })

const newPersonBody = newParticipantSchema.extend({ link: z.boolean().optional() })

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
export function createTeamApi(signedIn: SignedIn): HandleTeamApi {
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

      if (head === 'projects' && projectId && tail === 'people') {
        if (!isProjectId(projectId) || !(await directory.hasProject(projectId))) return fail('No such project.', 404)
        const room = env.ROOMS.getByName(projectId)

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
      console.error('team api failed:', error instanceof Error ? error.name : 'Unknown error')
      return fail('Something went wrong on our side.', 500)
    }
  }
}
