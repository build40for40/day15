import { currentLenses, type LensId } from '@day15/shared/lenses'
import {
  MAX_JOB_TITLE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_ORGANISATION_LENGTH,
  PERSONA_LENS,
  PERSONA_NAMES,
  PERSONAS,
  SIDES,
  type Persona,
  type Side,
} from '@day15/shared/schema'

import type { PersonDetails } from './api'

/** The steps of the first-run conversation, in order. */
export const STEPS = ['hello', 'project', 'people', 'review'] as const
export type Step = (typeof STEPS)[number]

export const STEP_LABELS: Record<Step, string> = {
  hello: 'You',
  project: 'The win',
  people: 'The teams',
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

// ---- A setup made in chat -------------------------------------------------------------------------------------
//
// The /onboarding skill interviews the agency rep in Claude, then gives them a link like
// https://a-line.build40for40.com/#setup=<base64url JSON>. The answers sit in the fragment, so they never reach a
// server. The page keeps them in session storage across the sign-in redirect, then opens on the review step.

export const SETUP_KEY = 'a-line.setup'

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

function decode(encoded: string): unknown {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

function guestFrom(raw: unknown, key: number, persona: Persona, side: Side): Guest {
  const given = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  // Older setup links may name the retired money and delivery advisers, which procurement now speaks for.
  const lenses = Array.isArray(given.lenses) ? currentLenses(given.lenses.filter((lens): lens is string => typeof lens === 'string')) : []
  return {
    ...newGuest(key, persona, side),
    name: text(given.name, MAX_NAME_LENGTH),
    jobTitle: text(given.jobTitle, MAX_JOB_TITLE_LENGTH),
    organisation: text(given.organisation, MAX_ORGANISATION_LENGTH),
    notes: text(given.notes, MAX_NOTES_LENGTH),
    lenses: lenses.length ? lenses : [PERSONA_LENS[persona]],
    link: given.link !== false,
  }
}

/** Reads a setup link's payload into a draft. Anything unreadable gives null, and odd values are dropped, not trusted. */
export function parseSetup(encoded: string): Draft | null {
  let raw: Record<string, unknown>
  try {
    const decoded = decode(encoded)
    if (!decoded || typeof decoded !== 'object') return null
    raw = decoded as Record<string, unknown>
  } catch {
    return null
  }
  const you = (raw.you && typeof raw.you === 'object' ? raw.you : {}) as Record<string, unknown>
  const others = Array.isArray(raw.others) ? raw.others.slice(0, 12) : []
  return {
    yourName: text(you.name, MAX_NAME_LENGTH),
    yourJobTitle: text(you.jobTitle, MAX_JOB_TITLE_LENGTH),
    agencyName: text(raw.agency, MAX_NAME_LENGTH),
    projectName: text(raw.project, MAX_NAME_LENGTH),
    clientName: text(raw.client, MAX_ORGANISATION_LENGTH),
    clientRep: guestFrom(raw.clientRep, CLIENT_REP_KEY, 'marketing_lead', 'client'),
    procurementRep: guestFrom(raw.procurementRep, PROCUREMENT_KEY, 'procurement', 'client'),
    guests: others
      .map((other, index) => {
        const given = (other && typeof other === 'object' ? other : {}) as Record<string, unknown>
        const persona = PERSONAS.find((p) => p === given.persona) ?? 'marketing_lead'
        const side = SIDES.find((s) => s === given.side) ?? 'client'
        return guestFrom(other, index + 1, persona, side)
      })
      .filter((guest) => guest.name),
  }
}

/** Called before the page mounts: moves a setup out of the address bar and into this tab's session storage. */
export function captureSetup(location: Location, history: History, storage: Storage): void {
  const match = /^#setup=([\w-]+)$/.exec(location.hash)
  if (!match) return
  try {
    storage.setItem(SETUP_KEY, match[1]!)
  } catch {
    // Without storage the answers are lost across sign-in, which is only a convenience lost.
  }
  history.replaceState(null, '', location.pathname + location.search)
}

/** Reads and forgets a captured setup. */
export function takeSetup(storage: Storage): Draft | null {
  try {
    const encoded = storage.getItem(SETUP_KEY)
    if (!encoded) return null
    storage.removeItem(SETUP_KEY)
    return parseSetup(encoded)
  } catch {
    return null
  }
}

/** A gentle prompt for each role, in the questions an agency would actually be asked before work starts. */
export const PERSONA_NUDGES: Record<Persona, string> = {
  agency_lead: 'Who else leads this for the agency?',
  marketing_lead: 'Who signs off the brief?',
  procurement: 'Who handles the contract and terms?',
  cfo: 'Who holds the budget?',
  delivery_lead: 'Who makes it, and by when?',
}

/** The next free key for someone added to the draft. */
export const nextGuestKey = (draft: Draft) => Math.max(0, ...draft.guests.map((guest) => guest.key)) + 1

/** A fresh teammate: a sensible role to start from for their side, which they can change. */
export function newTeammate(draft: Draft, side: Side): Guest {
  return newGuest(nextGuestKey(draft), side === 'agency' ? 'delivery_lead' : 'cfo', side)
}
