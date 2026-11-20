/** How urgent an open question is. Only the number is stored. */
export const QUESTION_PRIORITIES = [1, 2, 3] as const
export type QuestionPriority = (typeof QUESTION_PRIORITIES)[number]

export const PRIORITY_LABELS: Record<QuestionPriority, string> = { 1: 'high', 2: 'medium', 3: 'low' }

/** One line saying what each level means, for anything a model or a person reads. */
export const PRIORITY_MEANINGS =
  'Priority is high (1) for "ask this next", medium (2) for "soon" and low (3) for "when there is a gap".'

/** The nearest level to any number, so a model's 0 or 7 still lands on one. */
export function toPriority(value: number): QuestionPriority {
  if (!Number.isFinite(value)) return 3
  return Math.min(Math.max(Math.round(value), 1), 3) as QuestionPriority
}

/** How a priority reads: `high (1)`. */
export function priorityLabel(value: number): string {
  const priority = toPriority(value)
  return `${PRIORITY_LABELS[priority]} (${priority})`
}
