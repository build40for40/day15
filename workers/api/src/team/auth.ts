import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

import type { Env } from '../contracts'
import { APP_HOST } from '../hosts'

const CLIENT_IDS = {
  production: 'client_01M6E5ZDQ9XBYYE28XYN7H3XTJ',
  staging: 'client_01M6E5ZDCH31RFHPJTD8N5JQZY',
}

export function workosClientId(hostname: string, override?: string) {
  if (override) return override
  return hostname === APP_HOST ? CLIENT_IDS.production : CLIENT_IDS.staging
}

export const workosIssuer = (clientId: string) => `https://api.workos.com/user_management/${clientId}`

const keySets = new Map<string, JWTVerifyGetKey>()

export function workosKeys(clientId: string) {
  let keys = keySets.get(clientId)
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${clientId}`))
    keySets.set(clientId, keys)
  }
  return keys
}

/** The WorkOS user id behind a Bearer access token, or null when the token is missing, forged or expired. */
export async function authenticate(request: Request, keys: JWTVerifyGetKey, issuer: string): Promise<string | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, keys, { issuer })
    return payload.sub ?? null
  } catch {
    return null
  }
}

export function signedInUser(request: Request, env: Pick<Env, 'WORKOS_CLIENT_ID'>) {
  const clientId = workosClientId(new URL(request.url).hostname, env.WORKOS_CLIENT_ID)
  return authenticate(request, workosKeys(clientId), workosIssuer(clientId))
}
