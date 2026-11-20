/** The short per-project ids models see: f12 for a fact, i3 for an item, a4 for an ask, p2 for a person, r5 for a lens run. */
export const REF_PREFIXES = { fact: 'f', item: 'i', ask: 'a', participant: 'p', lensRun: 'r' } as const
export type RefKind = keyof typeof REF_PREFIXES

export const ref = (kind: RefKind, id: number) => `${REF_PREFIXES[kind]}${id}`

/** The number behind a short id, or null when it is not one of `kind`. Accepts a bare number too. */
export function parseRef(kind: RefKind, value: string): number | null {
  const match = value.trim().match(new RegExp(`^${REF_PREFIXES[kind]}?(\\d+)$`, 'i'))
  const id = match ? Number(match[1]) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
