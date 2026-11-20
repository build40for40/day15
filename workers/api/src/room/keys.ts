/** A person's key is `<projectId>.<secret>`. The room keeps only a SHA-256 hash of the secret. */
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SECRET = /^[A-Za-z0-9_-]{43}$/

export const isProjectId = (value: string) => PROJECT_ID.test(value)

export function newSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const formatKey = (projectId: string, secret: string) => `${projectId}.${secret}`

export function parseKey(key: string): { projectId: string; secret: string } | null {
  const [projectId, secret, ...rest] = key.split('.')
  if (rest.length || !projectId || !secret || !isProjectId(projectId) || !SECRET.test(secret)) return null
  return { projectId, secret }
}
