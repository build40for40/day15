import type { LensId } from '@day15/shared/lenses'
import type { Participant, Persona, Side } from '@day15/shared/schema'

import { getAccessToken } from './auth'
import type { RoomView } from './circle'

export interface Team {
  name: string
  ownerId: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  participants: Participant[]
}

export interface Session {
  team: Team | null
  projects: Project[]
}

/** Everything the owner can set about a person. */
export interface PersonDetails {
  name: string
  jobTitle: string
  organisation: string
  side: Side
  persona: Persona
  lenses: LensId[]
  notes: string
}

/** The address is shown once: right after the person is added with a link, or their link is reissued. */
export interface PersonWithAddress {
  participant: Participant
  address: string | null
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${import.meta.env.BASE_URL}api/${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new ApiError(data.error ?? 'Something went wrong. Try again?', response.status)
  return data as T
}

const person = (projectId: string, participantId: number) => `projects/${projectId}/people/${participantId}`

export const getSession = () => request<Session>('session')
export const createTeam = (name: string) => request<{ team: Team }>('team', 'POST', { name })
export const createProject = (name: string) => request<{ project: Project }>('projects', 'POST', { name })
export const addPerson = (projectId: string, details: PersonDetails, link: boolean) =>
  request<PersonWithAddress>(`projects/${projectId}/people`, 'POST', { ...details, link })
export const updatePerson = (projectId: string, participantId: number, details: Partial<PersonDetails>) =>
  request<{ participant: Participant }>(person(projectId, participantId), 'PATCH', details)
export const removePerson = (projectId: string, participantId: number) =>
  request<{ participant: Participant }>(person(projectId, participantId), 'DELETE')
export const freshAddress = (projectId: string, participantId: number) =>
  request<PersonWithAddress & { address: string }>(`${person(projectId, participantId)}/address`, 'POST')
export const getRoom = (projectId: string) => request<{ room: RoomView }>(`projects/${projectId}/room`)
