import { z } from 'zod'

import { LENS_IDS } from './lenses'

export const PARTIES = ['agency', 'client'] as const
export type Party = (typeof PARTIES)[number]

export const OTHER_SIDE = { agency: 'client', client: 'agency' } as const satisfies Record<Party, Party>

export const MAX_PROJECT_LENGTH = 1500
export const MAX_ANSWER_LENGTH = 1500
export const MAX_TURNS = 30

const lens = z.enum(LENS_IDS)
export const partySchema = z.enum(PARTIES)

export const turnSchema = z.object({
  lens,
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
})

/** What the page sends to get the coach's next question: who is talking, and the answer they just gave, if any. */
export const coachRequestSchema = z.object({
  party: partySchema,
  project: z.string().trim().min(1).max(MAX_PROJECT_LENGTH),
  turn: turnSchema.optional(),
})

/** What the coach streams back. `lens` is the hat the brain chose, and is never shown. */
export const coachReplySchema = z.object({
  lens,
  question: z.string(),
  why: z.string(),
})

/** One side's half of a project. */
export const sideSchema = z.object({
  project: z.string(),
  turns: z.array(turnSchema),
})

/** What a side gets back about its own conversation. Never the other side's words. */
export const mySideSchema = sideSchema.extend({
  otherSideStarted: z.boolean(),
})

export type Turn = z.infer<typeof turnSchema>
export type CoachRequest = z.infer<typeof coachRequestSchema>
export type CoachReply = z.infer<typeof coachReplySchema>
export type Side = z.infer<typeof sideSchema>
export type MySide = z.infer<typeof mySideSchema>
