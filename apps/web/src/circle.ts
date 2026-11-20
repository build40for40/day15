import type { AlignmentAreaId } from '@day15/shared/alignment'
import { TOPICS, type Ask, type Fact, type OpenQuestion, type Side, type Topic } from '@day15/shared/schema'

export type RoomQuestion = OpenQuestion & { withheld: boolean }

/** A project's room as the agency side sees it. */
export interface RoomView {
  facts: Fact[]
  openQuestions: RoomQuestion[]
  asks: Ask[]
}

export type Coverage = 'missing' | 'thin' | 'settled'
export type Bucket = 'crack' | 'open' | 'talked' | 'decided'

export interface TopicState {
  id: Topic
  name: string
  label: string
  coverage: Record<Side, Coverage>
  /** Newest first, replaced ones included. */
  facts: Fact[]
  /** Most urgent first. */
  questions: RoomQuestion[]
  lit: boolean
  /** 1 when the sides sit on top of each other, towards 0.3 as they pull apart. */
  score: number
  bucket: Bucket
}

const NAMES: Record<Topic, [name: string, label: string]> = {
  background: ['Background', 'Background'],
  objective: ['Objective', 'Objective'],
  audience: ['Audience', 'Audience'],
  insight: ['Insight', 'Insight'],
  kpis: ['Success measures', 'Success'],
  budget: ['Budget', 'Budget'],
  deliverables: ['Deliverables', 'Deliverables'],
  timeline: ['Timeline', 'Timeline'],
  sign_off: ['Sign-off', 'Sign-off'],
  legal_ip: ['Legal and IP', 'Legal and IP'],
  other: ['Outside the brief', 'Outside brief'],
}

const AREA_TOPIC: Record<AlignmentAreaId, Topic> = {
  goal_and_success: 'objective',
  scope: 'deliverables',
  dependencies_and_ownership: 'other',
  budget: 'budget',
  timeline: 'timeline',
  ways_of_working: 'sign_off',
  procurement_and_contract: 'legal_ip',
}

const isTopic = (value: string): value is Topic => (TOPICS as readonly string[]).includes(value)

/** The spoke a question sits on: its own topic, else the topic most of its facts share, else its area's. */
function questionTopic(question: RoomQuestion, facts: Map<number, Fact>): Topic {
  if (isTopic(question.topic)) return question.topic
  const counts = new Map<Topic, number>()
  for (const id of question.basedOn) {
    const topic = facts.get(id)?.topic
    if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1)
  }
  const [most] = [...counts].sort((a, b) => b[1] - a[1])
  return most?.[0] ?? AREA_TOPIC[question.area]
}

const RANK: Record<Coverage, number> = { missing: 0, thin: 1, settled: 2 }

function score(coverage: Record<Side, Coverage>, worst: number | null): number {
  const low = Math.min(RANK[coverage.agency], RANK[coverage.client])
  const high = Math.max(RANK[coverage.agency], RANK[coverage.client])
  const base = low === 2 ? 1 : low === 1 ? (high === 2 ? 0.88 : 0.8) : high === 0 ? 0.42 : high === 1 ? 0.52 : 0.62
  if (worst === 1) return 0.3
  if (worst === 2) return Math.min(base, 0.78)
  if (worst === 3) return Math.min(base, 0.95)
  return base
}

export function topicStates(room: RoomView): TopicState[] {
  const facts = new Map(room.facts.map((fact) => [fact.id, fact]))
  const questions = new Map<Topic, RoomQuestion[]>()
  for (const question of room.openQuestions) {
    const topic = questionTopic(question, facts)
    questions.set(topic, [...(questions.get(topic) ?? []), question])
  }

  return TOPICS.map((id) => {
    const topicFacts = room.facts.filter((fact) => fact.topic === id)
    const open = questions.get(id) ?? []
    const coverage = (side: Side): Coverage => {
      const said = topicFacts.some((fact) => fact.side === side && fact.status !== 'superseded')
      if (!said) return 'missing'
      const owes = open.some((q) => q.priority < 3 && (q.askSide === side || q.askSide === 'both'))
      return owes ? 'thin' : 'settled'
    }
    const both = { agency: coverage('agency'), client: coverage('client') }
    const worst = open.length ? Math.min(...open.map((q) => q.priority)) : null
    const bucket: Bucket =
      worst === 1
        ? 'crack'
        : both.agency === 'missing' || both.client === 'missing'
          ? 'open'
          : both.agency === 'settled' && both.client === 'settled'
            ? 'decided'
            : 'talked'
    return {
      id,
      name: NAMES[id][0],
      label: NAMES[id][1],
      coverage: both,
      facts: [...topicFacts].reverse(),
      questions: open,
      lit: topicFacts.length > 0,
      score: score(both, worst),
      bucket,
    }
  })
}

export interface Overall {
  decided: number
  talked: number
  open: number
  crack: number
  /** What sits in the middle of the circle. */
  word: string
  detail: string
}

export function overall(topics: TopicState[]): Overall {
  const count = (bucket: Bucket) => topics.filter((topic) => topic.bucket === bucket).length
  const crack = count('crack')
  const open = count('open')
  const lit = topics.filter((topic) => topic.lit)
  const round = lit.length ? Math.round((lit.reduce((sum, topic) => sum + topic.score, 0) / lit.length) * 100) : 0
  const word =
    lit.length < 2
      ? 'Not started'
      : lit.length < 5
        ? 'Just getting started'
        : crack > 0
          ? crack === 1
            ? 'One deal-breaker to sort'
            : `${crack} deal-breakers to sort`
          : open > 3
            ? 'Taking shape'
            : 'Ready to move forward'
  const detail = lit.length < 2 ? 'Waiting for the first answers' : lit.length < 5 ? 'No score yet' : `${round}% round`
  return { decided: count('decided'), talked: count('talked'), open, crack, word, detail }
}

const WITHHELD = 'It rests on something the client asked to keep private.'

export const questionText = (question: RoomQuestion) => (question.withheld ? WITHHELD : question.statement)

export function statusLine(topic: TopicState): string {
  const [first] = topic.questions
  if (topic.bucket === 'decided') return 'Decided. Both sides have said their piece.'
  if (topic.bucket === 'crack') return `Deal-breaker. ${questionText(first!)}`
  if (topic.bucket === 'open') {
    const missing = (['agency', 'client'] as const).filter((side) => topic.coverage[side] === 'missing')
    return `Still open. Waiting on ${missing.map((side) => `the ${side}`).join(' and ')}.`
  }
  return `Talked about. ${first ? questionText(first) : ''}`.trim()
}
