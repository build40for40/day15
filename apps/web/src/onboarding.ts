import type { LensId } from '@day15/shared/lenses'
import { PERSONA_LENS, PERSONA_NAMES, type Persona, type Side } from '@day15/shared/schema'

import type { PersonDetails } from './api'

/** The steps of the first-run conversation, in order. */
export const STEPS = ['hello', 'project', 'people', 'review'] as const
export type Step = (typeof STEPS)[number]

export const STEP_LABELS: Record<Step, string> = {
  hello: 'You',
  project: 'The win',
  people: 'Your client',
  review: 'Review',
}

/** One line on what each seat does, shown when picking a role. */
export const PERSONA_HINTS: Record<Persona, string> = {
  agency_lead: 'Runs the pitch and the relationship',
  marketing_lead: 'Owns the brief and the brand',
  procurement: 'Contracts, terms and suppliers',
  cfo: 'Holds the budget',
  delivery_lead: 'Makes it, on time',
}

export interface Guest {
  key: number
  name: string
  persona: Persona
  side: Side
  /** Whether they get their own link to the coach. */
  link: boolean
  jobTitle: string
  /** Blank means the side's organisation. */
  organisation: string
  /** Which of the coach's advisers speak for them. Empty means the persona's own. */
  lenses: LensId[]
  notes: string
}

export interface Draft {
  /** The client's day-to-day contact, who owns the brief on their side. */
  clientRep: Guest
  /** The client's procurement contact, who handles terms and contracts. */
  procurementRep: Guest
  yourName: string
  yourJobTitle: string
  agencyName: string
  projectName: string
  clientName: string
  guests: Guest[]
}

export interface Seat {
  key: number
  details: PersonDetails
  link: boolean
  you: boolean
}

/** The key the person who is signing up gets, so no guest can collide with it. */
export const YOU_KEY = 0
export const CLIENT_REP_KEY = -1
export const PROCUREMENT_KEY = -2

/** An empty profile for someone, with the advisers that speak for their role already chosen. */
export const newGuest = (key: number, persona: Persona, side: Side): Guest => ({
  key,
  name: '',
  persona,
  side,
  link: true,
  jobTitle: '',
  organisation: '',
  lenses: [PERSONA_LENS[persona]],
  notes: '',
})

/**
 * Everyone who goes on the project. The person setting it up comes first: they are the agency lead, and they
 * get a link so they can talk to the coach too. Organisations come from the side, so nobody is asked twice.
 */
export function seats(draft: Draft, agencyName: string): Seat[] {
  const organisation = (side: Side) => (side === 'agency' ? agencyName : draft.clientName).trim()
  const seat = (key: number, you: boolean, guest: Guest): Seat => ({
    key,
    you,
    link: guest.link,
    details: {
      name: guest.name.trim(),
      jobTitle: guest.jobTitle.trim(),
      organisation: guest.organisation.trim() || organisation(guest.side),
      side: guest.side,
      persona: guest.persona,
      lenses: guest.lenses.length ? guest.lenses : [PERSONA_LENS[guest.persona]],
      notes: guest.notes.trim(),
    },
  })
  const me: Guest = {
    key: YOU_KEY,
    name: draft.yourName,
    persona: 'agency_lead',
    side: 'agency',
    link: true,
    jobTitle: draft.yourJobTitle,
    organisation: '',
    lenses: [],
    notes: '',
  }
  const others = [draft.clientRep, draft.procurementRep, ...draft.guests].filter((guest) => guest.name.trim())
  return [seat(YOU_KEY, true, me), ...others.map((guest) => seat(guest.key, false, guest))]
}

/** What stops someone moving on from a step, or null when they can go. */
export function blocker(step: Step, draft: Draft, needsAgencyName: boolean): string | null {
  if (step === 'hello') {
    if (!draft.yourName.trim()) return 'Tell me your name.'
    if (needsAgencyName && !draft.agencyName.trim()) return 'What is your agency called?'
  }
  if (step === 'project' && !draft.projectName.trim()) return 'Give the project a name.'
  return null
}

/** The coach finds gaps between the sides, so it helps to know when one side is empty. */
export function lonelySide(draft: Draft): Side | null {
  const named = [draft.clientRep, draft.procurementRep, ...draft.guests].filter((guest) => guest.name.trim())
  const sides = new Set(named.map((guest) => guest.side))
  sides.add('agency')
  return sides.has('client') ? null : 'client'
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

/** What this person is called on a project: the three seats by their working names, anyone else by persona. */
export function roleName(persona: Persona, side: Side): string {
  if (persona === 'agency_lead' && side === 'agency') return 'Agency rep'
  if (persona === 'marketing_lead' && side === 'client') return 'Client rep'
  if (persona === 'procurement' && side === 'client') return 'Client procurement'
  return PERSONA_NAMES[persona]
}
