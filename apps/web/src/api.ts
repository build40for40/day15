import type { Participant, Persona, Side } from '@day15/shared/schema'

import { getAccessToken } from './auth'

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

export interface AddedPerson {
  participant: Participant
  address: string
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

export const getSession = () => request<Session>('session')
export const createTeam = (name: string) => request<{ team: Team }>('team', 'POST', { name })
export const createProject = (name: string) => request<{ project: Project }>('projects', 'POST', { name })
export const addPerson = (projectId: string, person: { name: string; persona: Persona; side: Side }) =>
  request<AddedPerson>(`projects/${projectId}/people`, 'POST', person)
export const freshAddress = (projectId: string, participantId: number) =>
  request<AddedPerson>(`projects/${projectId}/people/${participantId}/address`, 'POST')
