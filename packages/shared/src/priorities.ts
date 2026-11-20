/** The one scale for how urgent anything unresolved is. Only the number is stored. */
export const QUESTION_PRIORITIES = [1, 2, 3] as const
export type QuestionPriority = (typeof QUESTION_PRIORITIES)[number]

export const PRIORITY_LABELS: Record<QuestionPriority, string> = { 1: 'high', 2: 'medium', 3: 'low' }

/** What each level means, in the mother agent's words for her ratings, since they are the same idea. */
export const PRIORITY_DEFINITIONS: Record<QuestionPriority, string> = {
  1: 'the two sides want different things, or one cannot give what the other needs, and the project should not start until it is sorted',
  2: 'they differ, but a trade-off or a decision would fix it',
  3: 'they agree in substance and it only needs writing down, or one detail is loose',
}

/** One line saying what each level means, for anything a model or a person reads. */
export const PRIORITY_MEANINGS = `Priority is ${QUESTION_PRIORITIES.map(
  (priority) => `${PRIORITY_LABELS[priority]} (${priority}) when ${PRIORITY_DEFINITIONS[priority]}`,
).join('; ')}.`

/** Older words for the same three levels, accepted on input and never stored. */
const ALIASES: Record<string, QuestionPriority> = {
  high: 1,
  fundamental: 1,
  medium: 2,
  workable: 2,
  low: 3,
  minor: 3,
}

/** The level for a number or a word, landing anything else on the nearest level, or low when it can't tell. */
export function toPriority(value: number | string): QuestionPriority {
  if (typeof value === 'string') return ALIASES[value.trim().toLowerCase()] ?? toPriority(Number(value))
  if (!Number.isFinite(value)) return 3
  return Math.min(Math.max(Math.round(value), 1), 3) as QuestionPriority
}

/** How a priority reads: `high (1)`. */
export function priorityLabel(value: number): string {
  const priority = toPriority(value)
  return `${PRIORITY_LABELS[priority]} (${priority})`
}
