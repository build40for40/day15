import { z } from 'zod'

import { LENS_IDS } from '@day15/shared/lenses'
import { topicSchema } from '@day15/shared/schema'

const noteSchema = z.object({
  topic: topicSchema,
  statement: z
    .string()
    .describe('One sentence that stands alone: who, what and any number, readable by a stranger with no context.'),
  quote: z.string().describe("The person's exact words from this message that the fact comes from."),
  tentative: z.boolean().describe('True when the person hedged ("probably", "I think", "roughly").'),
  replaces: z
    .string()
    .nullable()
    .describe('The id (like f12) of an earlier fact this corrects. Only one this person said or an adviser proposed.'),
})

const confirmationSchema = z.object({
  fact: z.string().describe('The id (like f20) of a proposed fact this person clearly agreed with.'),
  quote: z.string().describe('Their exact words that show they agree.'),
})

export const nextAskSchema = z.object({
  ask: z.string().describe('Exactly one question for this person, in your voice. Never two things at once.'),
  because: z.string().describe('One short sentence on why it matters, for the team. Not shown to the person.'),
  lens: z.enum(LENS_IDS).nullable().describe('The adviser whose need this serves, or null.'),
  same_as: z
    .string()
    .nullable()
    .describe("The id (like a4) of this person's open ask when you are asking it again, otherwise null."),
})

export const coachTurnOutputSchema = z.object({
  facts: z.array(noteSchema).describe('Every separate fact in this message. Empty when there are none.'),
  answered_asks: z.array(z.string()).describe('Ids (like a4) of open asks this message answers.'),
  confirmed: z.array(confirmationSchema).describe('Proposed facts this person clearly agreed with.'),
  noted: z.string().describe('One or two warm sentences playing back what you noted. No question here.'),
  next_ask: nextAskSchema.nullable().describe('The one next thing you need from this person, or null if nothing.'),
})

export const openingOutputSchema = z.object({
  reply: z
    .string()
    .describe('A short warm hello: who they are on this project and where it stands. No question here.'),
  next_ask: nextAskSchema.nullable().describe('The one thing you most need from this person, or null if nothing.'),
})

export type NextAskOutput = z.infer<typeof nextAskSchema>
export type CoachTurnOutput = z.infer<typeof coachTurnOutputSchema>
export type OpeningOutput = z.infer<typeof openingOutputSchema>
