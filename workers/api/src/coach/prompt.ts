import type { SystemModelMessage } from 'ai'

import { LENS_IDS, LENS_NAMES } from '@day15/shared/lenses'
import { ref } from '@day15/shared/refs'
import {
  PERSONA_LENS,
  PERSONA_NAMES,
  type Ask,
  type Item,
  type LensRun,
  type Participant,
  type RoomSnapshot,
} from '@day15/shared/schema'
import coachHarness from '../../../../persona-harnesses/coach.md'
import coachReference from '../../../../persona-harnesses/coach-reference.md'
import { renderRoom } from '../room/render'
import { heardFrom, type AskCandidate } from './select'

const MAX_CANDIDATES = 8
const MAX_PAST_ASKS = 10

const CACHED = { anthropic: { cacheControl: { type: 'ephemeral' } } } as const

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

function renderRun(run: LensRun, watermark: number): string {
  const report = run.report!
  const name = LENS_NAMES[run.lens]
  const read = run.watermark < watermark ? `read up to ${ref('fact', run.watermark)}, newer facts not seen yet` : 'up to date'
  const lines = [`### ${name} adviser (${ref('lensRun', run.id)}, ${read})${report.done ? ': says it is done' : ''}`]

  lines.push(
    report.conflicts.length
      ? report.conflicts
          .map(
            (conflict) =>
              `- ${conflict.severity} conflict on "${oneLine(conflict.topic)}": the agency said "${oneLine(conflict.agency_said)}", ` +
              `the client said "${oneLine(conflict.client_said)}". ${oneLine(conflict.note)}`,
          )
          .join('\n')
      : '- No conflicts.',
  )

  const thin = report.coverage.filter((topic) => topic.agency !== 'settled' || topic.client !== 'settled')
  lines.push(
    thin.length
      ? `Not settled yet: ${thin.map((topic) => `${oneLine(topic.topic)} (agency ${topic.agency}, client ${topic.client})`).join('; ')}.`
      : 'Everything it covers is settled on both sides.',
  )

  if (report.questions.length) {
    lines.push(
      'Wants to find out:\n' +
        [...report.questions]
          .sort((a, b) => a.priority - b.priority)
          .map(
            (question) =>
              `- from the ${question.ask} side, priority ${question.priority}: ${oneLine(question.find_out)}. Because: ${oneLine(question.because)}`,
          )
          .join('\n'),
    )
  }
  return lines.join('\n')
}

/** The newest report from each lens, for the coach to choose from. People never see these. */
export function renderReports(room: RoomSnapshot): string {
  return [
    '# What the five advisers reported',
    'Their newest reports. Facts they proposed are already in the room above as proposed facts.',
    ...LENS_IDS.map((lens) => {
      const run = room.latestRuns[lens]
      return run?.report ? renderRun(run, room.watermark) : `### ${LENS_NAMES[lens]} adviser\nNo report yet.`
    }),
  ].join('\n\n')
}

/** The coach's harness and reference pack, the same for every call. */
export function renderHarness(): string {
  return [coachHarness.trim(), '<reference>', coachReference.trim(), '</reference>'].join('\n\n')
}

/** Room first, then the lens reports, then the coach's own harness. */
export function coachInstructions(room: RoomSnapshot): SystemModelMessage[] {
  return [
    { role: 'system', content: renderRoom(room), providerOptions: CACHED },
    { role: 'system', content: renderReports(room) },
    { role: 'system', content: renderHarness() },
  ]
}

const describe = (participant: Participant) =>
  `${participant.name} (${ref('participant', participant.id)}), on the ${participant.side} side as ${PERSONA_NAMES[participant.persona]}`

function renderAsk(ask: Ask): string {
  const lens = ask.lens ? ` [${LENS_NAMES[ask.lens]}]` : ''
  const status =
    ask.status === 'open' ? 'open' : ask.answeredBy ? `answered in ${ref('item', ask.answeredBy)}` : ask.status
  return `- ${ref('ask', ask.id)}${lens}, ${status}: ${oneLine(ask.ask)}`
}

const KIND_LABELS: Record<AskCandidate['kind'], string> = {
  fundamental_conflict: 'fundamental conflict',
  workable_conflict: 'workable conflict',
  priority_gap: 'priority 1 gap',
  least_heard: 'least heard adviser',
  missing_topic: 'nothing said yet',
}

function renderPerson(room: RoomSnapshot, participant: Participant, candidates: AskCandidate[]): string {
  const theirs = room.asks.filter((ask) => ask.addressedTo === participant.id)
  const open = theirs.filter((ask) => ask.status === 'open')
  const past = theirs.filter((ask) => ask.status !== 'open').slice(-MAX_PAST_ASKS)
  const counts = heardFrom(room, participant)
  return [
    `# This turn`,
    `You are talking with ${describe(participant)}. The adviser closest to their role is ` +
      `${LENS_NAMES[PERSONA_LENS[participant.persona]]}.`,
    `## Their open asks\n${open.length ? open.map(renderAsk).join('\n') : 'None.'}`,
    `## What they were asked before\n${past.length ? past.map(renderAsk).join('\n') : 'Nothing yet.'}`,
    `## Asks they have had from each adviser\n${LENS_IDS.map((lens) => `${LENS_NAMES[lens]} ${counts[lens]}`).join(', ')}.`,
    `## Candidates for the next ask, best first\n` +
      (candidates.length
        ? candidates
            .slice(0, MAX_CANDIDATES)
            .map(
              (candidate, index) =>
                `${index + 1}. [${KIND_LABELS[candidate.kind]}${candidate.lens ? `, ${candidate.lens}` : ''}] ` +
                `Find out ${oneLine(candidate.findOut)}. Because: ${oneLine(candidate.because)}`,
            )
            .join('\n')
        : 'None: every adviser is done. Ask nothing unless something in their message needs following up.'),
  ].join('\n\n')
}

/** What this person just said, and what to do with it. */
export function turnPrompt(room: RoomSnapshot, participant: Participant, item: Item, candidates: AskCandidate[]): string {
  return [
    renderPerson(room, participant, candidates),
    `## What they just said (${ref('item', item.id)})\n<message>\n${item.text}\n</message>`,
    'Take facts only from this message, quoting its exact words. Use ids exactly as they appear in the room ' +
      '(f12, a4). Then say what you noted and ask the one next thing, following your harness: take the first ' +
      'candidate that still fits after this message, and skip any it has just answered.',
  ].join('\n\n')
}

/** The coach greeting someone who has just opened the room. */
export function openingPrompt(room: RoomSnapshot, participant: Participant, candidates: AskCandidate[]): string {
  return [
    renderPerson(room, participant, candidates),
    'They have just opened the room. Say hello, remind them who they are on this project and where it stands in ' +
      'a sentence or two (what is agreed, what is still open), then ask the one thing you most need from them, ' +
      'following your harness. If one of their open asks is still the most important thing, ask it again and ' +
      'give its id as same_as.',
  ].join('\n\n')
}
