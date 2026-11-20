/** The three headless personas that read the room. People never meet them: only the coach talks to people. */
export const LENS_IDS = ['client', 'agency', 'procurement'] as const

export type LensId = (typeof LENS_IDS)[number]

/** What the coach and the team call each lens. `procurement` also carries money and delivery. */
export const LENS_NAMES: Record<LensId, string> = {
  client: 'Client',
  agency: 'Agency',
  procurement: 'Procurement',
}

/** Lens ids from before there were three, and the lens that speaks for them now. Stored rows keep the old id. */
const RETIRED: Record<string, LensId> = { cfo: 'procurement', cto: 'procurement' }

/** The lens a stored id means today, or null for one that was never a lens. */
export function currentLens(stored: string): LensId | null {
  if ((LENS_IDS as readonly string[]).includes(stored)) return stored as LensId
  return RETIRED[stored] ?? null
}

/** A stored list of lens ids as today's lenses, each once, in the usual order. */
export function currentLenses(stored: readonly string[]): LensId[] {
  const lenses = new Set(stored.map(currentLens))
  return LENS_IDS.filter((lens) => lenses.has(lens))
}

/** Every id a lens's stored rows may carry: its own and the retired ones it took over. */
export function storedIds(lens: LensId): string[] {
  return [lens, ...Object.keys(RETIRED).filter((old) => RETIRED[old] === lens)]
}
