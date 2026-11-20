import { PERSONA_LENS, PERSONA_NAMES, type Persona, type Side } from '@day15/shared/schema'

import type { PersonDetails } from './api'

/** The steps of the first-run conversation, in order. */
export const STEPS = ['hello', 'project', 'people', 'review'] as const
export type Step = (typeof STEPS)[number]

export const STEP_LABELS: Record<Step, string> = {
  hello: 'You',
  project: 'The win',
  people: 'The people',
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
}

export interface Draft {
  yourName: string
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

/**
 * Everyone who goes on the project. The person setting it up comes first: they are the agency lead, and they
 * get a link so they can talk to the coach too. Organisations come from the side, so nobody is asked twice.
 */
export function seats(draft: Draft, agencyName: string): Seat[] {
  const organisation = (side: Side) => (side === 'agency' ? agencyName : draft.clientName).trim()
  const seat = (key: number, name: string, persona: Persona, side: Side, link: boolean, you: boolean): Seat => ({
    key,
    link,
    you,
    details: {
      name: name.trim(),
      jobTitle: '',
      organisation: organisation(side),
      side,
      persona,
      lenses: [PERSONA_LENS[persona]],
      notes: '',
    },
  })
  return [
    seat(YOU_KEY, draft.yourName, 'agency_lead', 'agency', true, true),
    ...draft.guests.map((guest) => seat(guest.key, guest.name, guest.persona, guest.side, guest.link, false)),
  ]
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
  const sides = new Set(draft.guests.map((guest) => guest.side))
  sides.add('agency')
  return sides.has('client') ? null : 'client'
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''
