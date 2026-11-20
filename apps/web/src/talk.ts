import type { Topic } from '@day15/shared/schema'

import { questionText, type TopicState } from './circle'

/** Lens wording cites facts by short ids, which mean nothing to a person. */
const plain = (text: string) => text.replace(/\s*\((?:[a-z]\d+(?:,\s*|\s+and\s+)?)+\)/gi, '')

/** What the room holds on a topic, in a few characters, so a refresh can tell that something moved. */
export function fingerprint(topic: TopicState): string {
  const facts = topic.facts.map((fact) => `${fact.id}:${fact.status}`).join(',')
  const questions = topic.questions.map((question) => question.id).join(',')
  return `${topic.bucket}|${facts}|${questions}`
}

export function fingerprints(topics: TopicState[]): Map<Topic, string> {
  return new Map(topics.map((topic) => [topic.id, fingerprint(topic)]))
}

/** The topics that changed since the last read. Nothing on the first read, because nothing has changed yet. */
export function changedTopics(before: Map<Topic, string> | null, topics: TopicState[]): Topic[] {
  if (!before) return []
  return topics.filter((topic) => before.get(topic.id) !== fingerprint(topic)).map((topic) => topic.id)
}

/**
 * What to say to the coach, ready to paste into the person's own AI. It points at the card that is open,
 * and at the question the coach is waiting on, so nobody has to explain where they are.
 */
export function sayToCoach(topic: TopicState | null): string {
  if (!topic) return 'Open my A-Line room. Then I will tell the coach what has changed on the project.'
  const question = topic.questions[0]
  if (question) {
    return `Open my A-Line room. About ${topic.name}: the coach is waiting on "${plain(questionText(question))}" My answer is: `
  }
  return `Open my A-Line room. About ${topic.name}, here is what has changed: `
}
