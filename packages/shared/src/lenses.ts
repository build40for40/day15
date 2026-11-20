/** The five headless personas that read the room. People never meet them: only the coach talks to people. */
export const LENS_IDS = ['cfo', 'cto', 'agency', 'client', 'procurement'] as const

export type LensId = (typeof LENS_IDS)[number]

/** What the coach and the team call each lens. `cto` is the delivery persona. */
export const LENS_NAMES: Record<LensId, string> = {
  cfo: 'CFO',
  cto: 'Delivery',
  agency: 'Agency',
  client: 'Client',
  procurement: 'Procurement',
}
