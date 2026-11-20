import { z } from 'zod'

import { LENS_IDS } from './lenses'

export const PARTIES = ['agency', 'client'] as const
export type Party = (typeof PARTIES)[number]

export const MAX_PROJECT_LENGTH = 1500
export const MAX_ANSWER_LENGTH = 1500
export const MAX_TURNS = 30

const lens = z.enum(LENS_IDS)

export const turnSchema = z.object({
  lens,
  question: z.string().trim().min(1).max(1000),
  answer: z.string().trim().min(1).max(MAX_ANSWER_LENGTH),
})

/** What the page sends to get the coach's next question. */
export const coachRequestSchema = z.object({
  party: z.enum(PARTIES),
  lens,
  project: z.string().trim().min(1).max(MAX_PROJECT_LENGTH),
  turns: z.array(turnSchema).max(MAX_TURNS),
})

/** What the coach streams back. */
export const coachReplySchema = z.object({
  question: z.string(),
  why: z.string(),
})

export type Turn = z.infer<typeof turnSchema>
export type CoachRequest = z.infer<typeof coachRequestSchema>
export type CoachReply = z.infer<typeof coachReplySchema>
