// @vitest-environment node
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { authenticate, workosClientId, workosIssuer } from './auth'

const ISSUER = workosIssuer('client_fake')

let keys: ReturnType<typeof createLocalJWKSet>
let sign: (claims: { sub?: string; issuer?: string; expires?: string }) => Promise<string>

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'fake-1', alg: 'RS256' }
  keys = createLocalJWKSet({ keys: [jwk] })
  sign = ({ sub = 'user_fake', issuer = ISSUER, expires = '1h' }) =>
    new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'fake-1' }).setSubject(sub).setIssuer(issuer).setExpirationTime(expires).sign(privateKey)
})

const withToken = (token?: string) =>
  new Request('https://day15.test/api/session', { headers: token ? { Authorization: `Bearer ${token}` } : {} })

describe('authenticate', () => {
  it('returns the user id of a valid token', async () => {
    expect(await authenticate(withToken(await sign({})), keys, ISSUER)).toBe('user_fake')
  })

  it('rejects a missing header', async () => {
    expect(await authenticate(withToken(), keys, ISSUER)).toBeNull()
  })

  it('rejects the wrong issuer', async () => {
    expect(await authenticate(withToken(await sign({ issuer: 'https://elsewhere.test' })), keys, ISSUER)).toBeNull()
  })

  it('rejects an expired token', async () => {
    expect(await authenticate(withToken(await sign({ expires: '-1h' })), keys, ISSUER)).toBeNull()
  })

  it('rejects a token signed by another key', async () => {
    const other = await generateKeyPair('RS256')
    const forged = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'fake-1' }).setSubject('user_fake').setIssuer(ISSUER).setExpirationTime('1h').sign(other.privateKey)
    expect(await authenticate(withToken(forged), keys, ISSUER)).toBeNull()
  })
})

describe('workosClientId', () => {
  it('uses production on the app host and staging elsewhere', () => {
    expect(workosClientId('a-line.build40for40.com')).not.toBe(workosClientId('localhost'))
  })

  it('lets the environment override the client', () => {
    expect(workosClientId('localhost', 'client_override')).toBe('client_override')
  })
})
