import { z } from 'zod'

import { alignmentAreaSchema } from '@day15/shared/areas'
import { LENS_IDS } from '@day15/shared/lenses'
import { ASK_SIDES, personaSchema, SIDES, topicSchema } from '@day15/shared/schema'

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
  private: z
    .boolean()
    .optional()
    .describe('True when they asked to keep this from the other side ("between us", "off the record", "keep this private").'),
})

const privacySchema = z.object({
  fact: z.string().describe('The id (like f12) of an earlier fact from this person\'s own side.'),
  private: z.boolean().describe('True to keep it from the other side, false to release it.'),
})

const raisedQuestionSchema = z.object({
  area: alignmentAreaSchema.describe('The area of your matrix it belongs to.'),
  statement: z.string().describe('What is unresolved, in one plain sentence, with nothing private in it.'),
  ask_side: z.enum(ASK_SIDES).describe('Which side needs to answer it.'),
  priority: z
    .number()
    .describe('1 high, 2 medium or 3 low, with the same meanings as in reprioritise.'),
})

const confirmationSchema = z.object({
  fact: z.string().describe('The id (like f20) of a proposed fact this person clearly agreed with.'),
  quote: z.string().describe('Their exact words that show they agree.'),
})

export const nextAskSchema = z.object({
  explain: z
    .string()
    .optional()
    .describe(
      'Only when you are educating, as your harness describes: one short paragraph of plain explanation given before ' +
        'the question, in a form the person could reuse with their own colleagues. Otherwise leave it out.',
    ),
  ask: z.string().describe('Exactly one question for this person, in your voice. Never two things at once.'),
  because: z.string().describe('One short sentence on why it matters, for the team. Not shown to the person.'),
  lens: z.enum(LENS_IDS).nullable().describe('The adviser whose need this serves, or null.'),
  same_as: z
    .string()
    .nullable()
    .describe("The id (like a4) of this person's open ask when you are asking it again, otherwise null."),
  question: z
    .string()
    .nullable()
    .optional()
    .describe('The id (like q7) of the open question this ask chases, or null when it chases none.'),
})

const reprioritySchema = z.object({
  question: z.string().describe('The id (like q7) of an open question.'),
  priority: z
    .number()
    .describe(
      'Its new priority as a number: 1 high (the sides want different things, or one cannot give what the other ' +
        'needs, and it must be sorted before the project starts), 2 medium (a trade-off or a decision would fix it), ' +
        '3 low (they agree in substance and it only needs writing down, or one detail is loose).',
    ),
})

const mentionedPersonSchema = z.object({
  name: z.string().describe('Their name as it was said. Only people named, never "the CFO" or "my boss".'),
  job_title: z.string().describe('Their job title if it was said, otherwise empty.'),
  organisation: z.string().describe('Their organisation if it was said, otherwise empty.'),
  side: z
    .enum(SIDES)
    .nullable()
    .describe("The side they are on if it is clear, otherwise null for the speaker's own side."),
  persona: personaSchema.describe('The seat closest to their role, your best guess from what was said.'),
  notes: z.string().describe('What was said about them: who they report to, what they sign off. Empty if nothing.'),
})

export const coachTurnOutputSchema = z.object({
  facts: z.array(noteSchema).describe('Every separate fact in this message. Empty when there are none.'),
  answered_asks: z.array(z.string()).describe('Ids (like a4) of open asks this message answers.'),
  confirmed: z.array(confirmationSchema).describe('Proposed facts this person clearly agreed with.'),
  people_mentioned: z
    .array(mentionedPersonSchema)
    .optional()
    .describe('People named in this message who are involved in the project and not in the people list yet.'),
  resolved_questions: z
    .array(z.string())
    .optional()
    .describe('Ids (like q7) of open questions this message settles. Only ones it really settles.'),
  reprioritise: z
    .array(reprioritySchema)
    .optional()
    .describe('Open questions whose priority should change after this message. Empty when none should.'),
  raise_questions: z
    .array(raisedQuestionSchema)
    .optional()
    .describe('Open questions of your own, for a signal in this message that no adviser has raised yet. Usually none.'),
  privacy: z
    .array(privacySchema)
    .optional()
    .describe('Earlier facts from this person\'s side they asked to make private or to release. Usually none.'),
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
export type MentionedPersonOutput = z.infer<typeof mentionedPersonSchema>
export type CoachTurnOutput = z.infer<typeof coachTurnOutputSchema>
export type OpeningOutput = z.infer<typeof openingOutputSchema>
