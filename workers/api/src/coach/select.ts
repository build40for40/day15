import { LENS_IDS, type LensId } from '@day15/shared/lenses'
import { PERSONA_LENS, TOPICS, type LensReport, type Participant, type RoomSnapshot, type Topic } from '@day15/shared/schema'

export type CandidateKind = 'fundamental_conflict' | 'workable_conflict' | 'priority_gap' | 'least_heard' | 'missing_topic'

/** Something the coach could ask this person next, in the order it should be considered. */
export interface AskCandidate {
  kind: CandidateKind
  lens: LensId | null
  topic: string
  /** What the coach needs to learn, for the model to phrase. */
  findOut: string
  because: string
  /** A plain question to fall back on when the model asks nothing. */
  question: string
}

/** The lens each brief topic matters most to, so a missing topic still has an owner. */
export const TOPIC_LENS: Record<Exclude<Topic, 'other'>, LensId> = {
  background: 'client',
  objective: 'client',
  audience: 'client',
  insight: 'client',
  kpis: 'client',
  budget: 'cfo',
  deliverables: 'cto',
  timeline: 'cto',
  sign_off: 'agency',
  legal_ip: 'procurement',
}

const TOPIC_QUESTIONS: Record<Exclude<Topic, 'other'>, string> = {
  background: 'What led to this project, and why now?',
  objective: 'If this goes brilliantly, what has changed for the business?',
  audience: 'Who is this really for?',
  insight: "What do you know about the audience that the brief hasn't said yet?",
  kpis: 'What number would tell you this worked?',
  budget: 'What do you understand the budget to cover?',
  deliverables: 'What exactly do you expect to have in your hands at the end?',
  timeline: 'Which date matters most here, and how fixed is it?',
  sign_off: 'Who has the final yes on the work?',
  legal_ip: 'Who do you expect to own the work once it is paid for?',
}

const BRIEF_TOPICS = TOPICS.filter((topic): topic is Exclude<Topic, 'other'> => topic !== 'other')

const sentence = (text: string) => text.trim().replace(/[.?!\s]+$/, '')

const lowerFirst = (text: string) => (/^[A-Z][a-z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text)

const askAbout = (findOut: string) => `Could you tell me ${lowerFirst(sentence(findOut))}?`

/** This person's own lens first, then the rest in their usual order. */
function lensOrder(participant: Participant): LensId[] {
  const own = PERSONA_LENS[participant.persona]
  return [own, ...LENS_IDS.filter((lens) => lens !== own)]
}

function reportsInOrder(room: RoomSnapshot, participant: Participant): [LensId, LensReport][] {
  return lensOrder(participant).flatMap((lens) => {
    const report = room.latestRuns[lens]?.report
    return report ? [[lens, report] as [LensId, LensReport]] : []
  })
}

function conflicts(reports: [LensId, LensReport][], severity: 'fundamental' | 'workable'): AskCandidate[] {
  const seen = new Set<string>()
  const found: AskCandidate[] = []
  for (const [lens, report] of reports) {
    for (const conflict of report.conflicts) {
      const key = conflict.topic.trim().toLowerCase()
      if (conflict.severity !== severity || seen.has(key)) continue
      seen.add(key)
      found.push({
        kind: severity === 'fundamental' ? 'fundamental_conflict' : 'workable_conflict',
        lens,
        topic: conflict.topic,
        findOut: `where they land on "${conflict.topic}": the agency said "${conflict.agency_said}" and the client said "${conflict.client_said}"`,
        because: conflict.note,
        question:
          `The two sides seem to see "${sentence(conflict.topic)}" differently: the agency said "${conflict.agency_said}" ` +
          `and the client said "${conflict.client_said}". Where do you land on it?`,
      })
    }
  }
  return found
}

function questionsFor(report: LensReport, participant: Participant) {
  return report.questions.filter((question) => question.ask === participant.side).sort((a, b) => a.priority - b.priority)
}

function priorityGaps(reports: [LensId, LensReport][], participant: Participant): AskCandidate[] {
  return reports.flatMap(([lens, report]) =>
    questionsFor(report, participant)
      .filter((question) => question.priority === 1)
      .map((question) => ({
        kind: 'priority_gap' as const,
        lens,
        topic: question.find_out,
        findOut: question.find_out,
        because: question.because,
        question: askAbout(question.find_out),
      })),
  )
}

/** How many asks this person has had from each lens. */
export function heardFrom(room: RoomSnapshot, participant: Participant): Record<LensId, number> {
  const counts = Object.fromEntries(LENS_IDS.map((lens) => [lens, 0])) as Record<LensId, number>
  for (const ask of room.asks) if (ask.addressedTo === participant.id && ask.lens) counts[ask.lens] += 1
  return counts
}

function leastHeard(room: RoomSnapshot, reports: [LensId, LensReport][], participant: Participant): AskCandidate[] {
  const counts = heardFrom(room, participant)
  const order = lensOrder(participant)
  return [...reports]
    .sort(([a], [b]) => counts[a] - counts[b] || order.indexOf(a) - order.indexOf(b))
    .flatMap(([lens, report]) => {
      const best = questionsFor(report, participant)[0]
      if (!best) return []
      return [
        {
          kind: 'least_heard' as const,
          lens,
          topic: best.find_out,
          findOut: best.find_out,
          because: best.because,
          question: askAbout(best.find_out),
        },
      ]
    })
}

/** Brief topics nobody on this person's side has a standing fact on, their own lens's topics first. */
function missingTopics(room: RoomSnapshot, participant: Participant): AskCandidate[] {
  const covered = new Set(
    room.facts
      .filter((fact) => fact.status !== 'superseded' && fact.side === participant.side)
      .map((fact) => fact.topic),
  )
  const order = lensOrder(participant)
  return BRIEF_TOPICS.filter((topic) => !covered.has(topic))
    .sort((a, b) => order.indexOf(TOPIC_LENS[a]) - order.indexOf(TOPIC_LENS[b]))
    .map((topic) => ({
      kind: 'missing_topic' as const,
      lens: TOPIC_LENS[topic],
      topic,
      findOut: `their side's view on ${topic.replace('_', ' ')}`,
      because: `Nobody on the ${participant.side} side has said anything about ${topic.replace('_', ' ')} yet.`,
      question: TOPIC_QUESTIONS[topic],
    }))
}

/**
 * What the coach could ask this person next, best first: fundamental conflicts, workable conflicts, priority 1
 * gaps for their side (their own lens first), then the lens they have heard least from. Brief topics their side
 * has said nothing about come last, so a room with no lens reports yet still has something to ask.
 */
export function askCandidates(room: RoomSnapshot, participant: Participant): AskCandidate[] {
  if (LENS_IDS.every((lens) => room.latestRuns[lens]?.report?.done)) return []
  const reports = reportsInOrder(room, participant)
  return [
    ...conflicts(reports, 'fundamental'),
    ...conflicts(reports, 'workable'),
    ...priorityGaps(reports, participant),
    ...leastHeard(room, reports, participant),
    ...missingTopics(room, participant),
  ]
}
