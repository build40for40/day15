/** The hats the coach can wear. The person never sees which one is on. */
export const LENS_IDS = ['cfo', 'cto', 'agency', 'client', 'procurement'] as const

export type LensId = (typeof LENS_IDS)[number]
