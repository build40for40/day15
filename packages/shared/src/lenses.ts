/**
 * The three persona harnesses that advise the coach. The person never sees which one a question came from.
 * `ops` is delivery, procurement and finance in one.
 */
export const LENS_IDS = ['client', 'agency', 'ops'] as const

export type LensId = (typeof LENS_IDS)[number]
