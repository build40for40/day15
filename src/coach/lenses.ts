export const LENS_IDS = ['cfo', 'cto', 'agency', 'client', 'procurement'] as const

export type LensId = (typeof LENS_IDS)[number]

export interface Lens {
  id: LensId
  /** Short label for the lens picker. */
  name: string
  /** What the person sees under the label. */
  blurb: string
  /** What the coach is told to dig into. Never shown on the page. */
  focus: string
}

export const LENSES: readonly Lens[] = [
  {
    id: 'cfo',
    name: 'Money',
    blurb: 'The finance director who signs it off',
    focus:
      'the money: budget, contingency, payment terms, what happens when something costs more than planned, ' +
      'and which things get cut first if the budget will not stretch',
  },
  {
    id: 'cto',
    name: 'Delivery',
    blurb: 'The tech lead who has to make it work',
    focus:
      'delivery: what is technically hard, what depends on other people or systems, what "done" looks like, ' +
      'timelines, handoffs, and any jargon the two sides might be reading differently',
  },
  {
    id: 'agency',
    name: 'Agency',
    blurb: 'The team doing the work',
    focus:
      'what the agency needs to do good work: creative freedom, clear feedback and sign-off, access to people ' +
      'and assets, and how scope creep gets handled',
  },
  {
    id: 'client',
    name: 'Client',
    blurb: 'The people who commissioned it',
    focus:
      'what the client needs out of this: the real goal behind the brief, what success looks like inside their ' +
      'organisation, who has to be kept happy, and what would make it feel like a failure',
  },
  {
    id: 'procurement',
    name: 'Procurement',
    blurb: 'The person with the contract and the checklist',
    focus:
      'procurement and the contract: approvals, who can change the scope, what must be written down, ' +
      'legal or compliance must-haves, and how a disagreement gets escalated',
  },
]

export const lensById = (id: LensId): Lens => LENSES.find((lens) => lens.id === id)!
