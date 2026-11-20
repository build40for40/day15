import type { Topic } from '@day15/shared/schema'

import { questionText, type RoomQuestion, type TopicState } from './circle'

/** Lens wording cites facts by short ids, which mean nothing to a person. */
const plain = (text: string) => text.replace(/\s*\((?:[a-z]\d+(?:,\s*|\s+and\s+)?)+\)/gi, '')

/** The question as a person reads it. */
export const questionLine = (question: RoomQuestion) => plain(questionText(question))

/**
 * What the room holds on a topic, in a few characters, so a refresh can tell that something moved.
 * Sorted, so the coach reordering things does not look like a change.
 */
export function fingerprint(topic: TopicState): string {
  const facts = topic.facts.map((fact) => `${fact.id}:${fact.status}`).sort().join(',')
  const questions = topic.questions.map((question) => question.id).sort((a, b) => a - b).join(',')
  return `${facts}|${questions}`
}

export function fingerprints(topics: TopicState[]): Map<Topic, string> {
  return new Map(topics.map((topic) => [topic.id, fingerprint(topic)]))
}

/** The topics that changed since the last read. Nothing on the first read, because nothing has changed yet. */
export function changedTopics(before: Map<Topic, string> | null, topics: TopicState[]): Topic[] {
  if (!before) return []
  return topics.filter((topic) => before.get(topic.id) !== fingerprint(topic)).map((topic) => topic.id)
}

/** What the coach is told: the card it is about, the question being answered if there is one, then the person's own words. */
export function messageForCoach(topic: TopicState | null, said: string, question: RoomQuestion | null = null): string {
  if (!topic) return said
  const answering = question ? ` (the coach asked: "${questionLine(question)}")` : ''
  return `About ${topic.name}${answering}: ${said}`
}

/** The same, ready to paste into the person's own AI, which has to open the room first. */
export function messageForOwnAi(topic: TopicState | null, said: string, question: RoomQuestion | null = null): string {
  return `Open my A-Line room. ${messageForCoach(topic, said, question)}`
}
