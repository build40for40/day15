import { z } from 'zod'

import { LENS_IDS, type LensId } from './lenses'

export const SIDES = ['agency', 'client'] as const
export type Side = (typeof SIDES)[number]
export const sideSchema = z.enum(SIDES)
export const OTHER_SIDE = { agency: 'client', client: 'agency' } as const satisfies Record<Side, Side>

/** The real people in a project. Any persona can sit on either side. */
export const PERSONAS = ['agency_lead', 'marketing_lead', 'procurement', 'cfo', 'delivery_lead'] as const
export type Persona = (typeof PERSONAS)[number]
export const personaSchema = z.enum(PERSONAS)

export const PERSONA_NAMES: Record<Persona, string> = {
  agency_lead: 'Agency lead',
  marketing_lead: 'Marketing lead',
  procurement: 'Procurement',
  cfo: 'CFO',
  delivery_lead: 'Delivery lead',
}

/** The lens that simulates each persona. */
export const PERSONA_LENS: Record<Persona, LensId> = {
  agency_lead: 'agency',
  marketing_lead: 'client',
  procurement: 'procurement',
  cfo: 'cfo',
  delivery_lead: 'cto',
}

/** Every fact sits under one of these, taken from a client brief template. */
export const TOPICS = [
  'background',
  'objective',
  'audience',
  'insight',
  'kpis',
  'budget',
  'deliverables',
  'timeline',
  'sign_off',
  'legal_ip',
  'other',
] as const
export type Topic = (typeof TOPICS)[number]
export const topicSchema = z.enum(TOPICS)

export const lensSchema = z.enum(LENS_IDS)

export const MAX_NAME_LENGTH = 80
export const MAX_ITEM_LENGTH = 20_000
export const MAX_STATEMENT_LENGTH = 1_000
export const MAX_QUOTE_LENGTH = 1_000

const id = z.number().int().positive()
const timestamp = z.string()

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: timestamp,
})

export const MAX_JOB_TITLE_LENGTH = 120
export const MAX_ORGANISATION_LENGTH = 120
export const MAX_NOTES_LENGTH = 1_000

/** Who put a person on the list: the agency owner on the setup page, or the coach when someone was mentioned. */
export const ADDED_BY = ['owner', 'coach'] as const
export type AddedBy = (typeof ADDED_BY)[number]

/** Sorted into the usual lens order, each lens once. */
const lensListSchema = z
  .array(lensSchema)
  .max(LENS_IDS.length)
  .transform((lenses) => LENS_IDS.filter((lens) => lenses.includes(lens)))

const personDetails = {
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  persona: personaSchema,
  side: sideSchema,
  jobTitle: z.string().trim().max(MAX_JOB_TITLE_LENGTH),
  organisation: z.string().trim().max(MAX_ORGANISATION_LENGTH),
  /** The lenses that speak for what this person cares about. Need not match the persona. */
  lenses: lensListSchema,
  /** Who they report to, what they sign off, anything else worth knowing. */
  notes: z.string().trim().max(MAX_NOTES_LENGTH),
}

/** Lenses default to the persona's own lens when left out. */
export const newParticipantSchema = z.object({
  name: personDetails.name,
  persona: personDetails.persona,
  side: personDetails.side,
  jobTitle: personDetails.jobTitle.optional(),
  organisation: personDetails.organisation.optional(),
  lenses: personDetails.lenses.optional(),
  notes: personDetails.notes.optional(),
})

/** People details are a directory, not facts, so they are edited in place. */
export const participantUpdateSchema = z.object(personDetails).partial()

export const participantSchema = z.object({
  id,
  ...personDetails,
  lenses: z.array(lensSchema),
  /** Only people with a link can reach the coach. */
  hasLink: z.boolean(),
  addedBy: z.enum(ADDED_BY),
  createdAt: timestamp,
  removedAt: timestamp.nullable(),
})

/** Anything a person said or pasted, kept word for word. */
export const itemSchema = z.object({
  id,
  participantId: id,
  text: z.string(),
  createdAt: timestamp,
})

export const FACT_STATUSES = ['proposed', 'confirmed', 'superseded'] as const
export type FactStatus = (typeof FACT_STATUSES)[number]

const factBody = {
  topic: topicSchema,
  statement: z.string().trim().min(1).max(MAX_STATEMENT_LENGTH),
  /** The fact this one replaces. Nothing is edited: a change is a new fact. */
  supersedes: id.nullable().optional(),
}

/** A fact the coach took from what a person said. It points at the item and the words it came from. */
export const newPersonFactSchema = z.object({
  authorKind: z.literal('person'),
  participantId: id,
  sourceItemId: id,
  sourceQuote: z.string().trim().min(1).max(MAX_QUOTE_LENGTH),
  status: z.enum(['proposed', 'confirmed']),
  basedOn: z.array(id).optional(),
  ...factBody,
})

/** A fact a lens worked out from other facts. Always proposed until a person confirms it. */
export const newLensFactSchema = z.object({
  authorKind: z.literal('lens'),
  lensRunId: id,
  basedOn: z.array(id).min(1),
  ...factBody,
})

export const newFactSchema = z.discriminatedUnion('authorKind', [newPersonFactSchema, newLensFactSchema])

export const factSchema = z.object({
  id,
  topic: topicSchema,
  statement: z.string(),
  /** `superseded` once a later fact replaces this one. */
  status: z.enum(FACT_STATUSES),
  /** The status it was written with, which never changes. */
  statedAs: z.enum(['proposed', 'confirmed']),
  authorKind: z.enum(['person', 'lens']),
  participantId: id.nullable(),
  lensRunId: id.nullable(),
  lens: lensSchema.nullable(),
  side: sideSchema.nullable(),
  sourceItemId: id.nullable(),
  sourceQuote: z.string().nullable(),
  basedOn: z.array(id),
  supersedes: id.nullable(),
  supersededBy: id.nullable(),
  createdAt: timestamp,
})

const coverageLevel = z.enum(['settled', 'thin', 'missing'])

/** What one lens reports. The field names match persona-harnesses/README.md. */
export const personaReportSchema = z.object({
  coverage: z.array(z.object({ topic: z.string(), agency: coverageLevel, client: coverageLevel })),
  conflicts: z.array(
    z.object({
      topic: z.string(),
      agency_said: z.string(),
      client_said: z.string(),
      severity: z.enum(['fundamental', 'workable', 'minor']),
      note: z.string(),
    }),
  ),
  questions: z.array(z.object({ ask: sideSchema, find_out: z.string(), because: z.string(), priority: z.number() })),
  done: z.boolean(),
})

/** A fact a lens proposes, with the ids it was worked out from as the model sees them (`f12`). */
export const proposedFactSchema = z.object({
  topic: topicSchema,
  statement: z.string(),
  based_on: z.array(z.string()),
  supersedes: z.string().nullable().optional(),
})

export const lensReportSchema = personaReportSchema.extend({
  proposed_facts: z.array(proposedFactSchema).optional(),
})

export const LENS_RUN_STATUSES = ['done', 'failed'] as const

export const newLensRunSchema = z.object({
  lens: lensSchema,
  round: z.number().int().min(1),
  /** The highest fact id the lens saw. */
  watermark: z.number().int().min(0),
  report: lensReportSchema.nullable(),
  status: z.enum(LENS_RUN_STATUSES),
})

export const lensRunSchema = newLensRunSchema.extend({ id, createdAt: timestamp })

export const ASK_STATUSES = ['open', 'answered', 'dropped'] as const
export type AskStatus = (typeof ASK_STATUSES)[number]

/** Something the coach needs from one person. Only the coach asks people things. */
export const newAskSchema = z.object({
  addressedTo: id,
  ask: z.string().trim().min(1).max(MAX_STATEMENT_LENGTH),
  because: z.string().trim().max(MAX_STATEMENT_LENGTH),
  lens: lensSchema.nullable(),
})

export const askSchema = newAskSchema.extend({
  id,
  status: z.enum(ASK_STATUSES),
  /** The item that answered it. */
  answeredBy: id.nullable(),
  createdAt: timestamp,
  closedAt: timestamp.nullable(),
})

export const closeAskSchema = z.object({
  status: z.enum(['answered', 'dropped']),
  answeredBy: id.nullable().optional(),
})

/** The whole room, as every model call reads it. */
export const roomSnapshotSchema = z.object({
  project: projectSchema,
  participants: z.array(participantSchema),
  items: z.array(itemSchema),
  facts: z.array(factSchema),
  asks: z.array(askSchema),
  /** The newest finished run of each lens. */
  latestRuns: z.partialRecord(lensSchema, lensRunSchema),
  /** The highest fact id in the room. */
  watermark: z.number().int().min(0),
})

export type Project = z.infer<typeof projectSchema>
export type NewParticipant = z.input<typeof newParticipantSchema>
export type ParticipantUpdate = z.input<typeof participantUpdateSchema>
export type Participant = z.infer<typeof participantSchema>
export type Item = z.infer<typeof itemSchema>
export type NewPersonFact = z.infer<typeof newPersonFactSchema>
export type NewLensFact = z.infer<typeof newLensFactSchema>
export type NewFact = z.infer<typeof newFactSchema>
export type Fact = z.infer<typeof factSchema>
export type PersonaReport = z.infer<typeof personaReportSchema>
export type ProposedFact = z.infer<typeof proposedFactSchema>
export type LensReport = z.infer<typeof lensReportSchema>
export type NewLensRun = z.infer<typeof newLensRunSchema>
export type LensRun = z.infer<typeof lensRunSchema>
export type NewAsk = z.infer<typeof newAskSchema>
export type Ask = z.infer<typeof askSchema>
export type CloseAsk = z.infer<typeof closeAskSchema>
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>
