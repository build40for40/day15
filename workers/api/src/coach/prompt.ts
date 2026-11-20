import type { SystemModelMessage } from 'ai'

import { ALIGNMENT_AREAS, type Assessment } from '@day15/shared/alignment'
import { LENS_IDS, LENS_NAMES, type LensId } from '@day15/shared/lenses'
import { ref } from '@day15/shared/refs'
import {
  PERSONA_NAMES,
  SIDES,
  type Ask,
  type Item,
  type LensRun,
  type Participant,
  type RoomSnapshot,
} from '@day15/shared/schema'
import coachHarness from '../../../../persona-harnesses/coach.md'
import coachReference from '../../../../persona-harnesses/coach-reference.md'
import motherAgent from '../../../../persona-harnesses/mother-agent.md'
import { renderRoom } from '../room/render'
import { heardFrom, lensGaps, speakersFor, type AskCandidate } from './select'

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

/** How the two harness files fit together. They were written separately and overlap. */
const HOW_THEY_FIT = [
  '# Your two harnesses',
  'Two documents follow. Together they are you.',
  '- **The mother agent** is how you think and speak: who you are, the signals you listen for, what matters most, ' +
    'your priority matrix and ratings, how you choose and word the next ask, and when to explain something first. ' +
    'What it calls your persona agents are the advisers whose reports are above.',
  '- **The coach harness** is how you keep the room: taking facts from what a person says, corrections, ' +
    'confirmations and closing asks.',
  'Where they differ on what to ask next, how to word it, or how open to be about what the other side said, ' +
    'follow the mother agent. Where they differ on how facts are recorded, follow the coach harness.',
].join('\n\n')

/** The mother agent, the coach's harness and the reference pack, the same for every call. */
export function renderHarness(): string {
  return [HOW_THEY_FIT, motherAgent.trim(), coachHarness.trim(), '<reference>', coachReference.trim(), '</reference>'].join(
    '\n\n',
  )
}

const CAUSES = { knowledge_gap: 'a gap in knowledge', different_expectations: 'a genuine difference in expectation' } as const

const AREA_NAMES = new Map<string, string>(ALIGNMENT_AREAS.map((area) => [area.id, area.name]))

/** The mother agent's own matrix from last time, so its view carries from turn to turn. */
export function renderAssessment(previous: Assessment | null | undefined): string {
  const areas = `The seven areas, in priority order: ${ALIGNMENT_AREAS.map((area) => area.id).join(', ')}.`
  if (!previous) return `## Your priority matrix\nYou have not rated this project yet. ${areas}`
  const reading = previous.health
    ? `Health was ${previous.health.score} out of 100, ${previous.health.band}.`
    : 'There was no health reading yet, because both sides had not spoken.'
  return [
    `## Your priority matrix, as you left it after ${ref('item', previous.itemId)}`,
    ...previous.areas.map(
      (row) =>
        `- ${AREA_NAMES.get(row.area) ?? row.area} (${row.area}): ${row.rating}` +
        `${row.misalignment ? `. ${oneLine(row.misalignment)}` : ''}${row.cause ? ` Cause: ${CAUSES[row.cause]}.` : ''}`,
    ),
    `${reading} The health reading is worked out for you from your ratings. Nobody on either side sees any of this.`,
  ].join('\n')
}

/** Room first, then the lens reports, then the coach's own harness. */
export function coachInstructions(room: RoomSnapshot): SystemModelMessage[] {
  return [
    { role: 'system', content: renderRoom(room), providerOptions: CACHED },
    { role: 'system', content: renderReports(room) },
    { role: 'system', content: renderHarness() },
  ]
}

function describe(participant: Participant): string {
  const role = [participant.jobTitle, participant.organisation].filter(Boolean).join(' at ')
  return (
    `${participant.name} (${ref('participant', participant.id)}), ${role ? `${role}, ` : ''}on the ${participant.side} ` +
    `side as ${PERSONA_NAMES[participant.persona]}`
  )
}

const names = (lenses: LensId[]) => lenses.map((lens) => LENS_NAMES[lens]).join(', ')

/** Who speaks for each adviser on each side, and the gaps, said the way this person's side needs it. */
export function renderCoverage(room: RoomSnapshot, participant: Participant): string {
  const sides = SIDES.map((side) => {
    const who = LENS_IDS.map((lens) => {
      const speakers = speakersFor(room, lens, side)
      return `${LENS_NAMES[lens]}: ${speakers.length ? speakers.map((p) => `${ref('participant', p.id)} ${p.name}${p.hasLink ? '' : ' (no link)'}`).join(', ') : 'nobody'}`
    })
    return `- ${side === 'agency' ? 'Agency' : 'Client'} side. ${who.join('; ')}.`
  })
  const gaps = lensGaps(room)
  const missing = SIDES.filter((side) => gaps[side].length).map((side) => `the ${side} side has nobody for ${names(gaps[side])}`)
  let advice: string
  if (!missing.length) advice = 'Every adviser has someone behind it on both sides.'
  else if (participant.side === 'agency') {
    advice =
      `Gaps: ${missing.join('; ')}. This person is on the agency side, which sets up the people list. If a gap ` +
      'matters to what is open, mention it once, in plain words about the area (money, delivery, legal and ' +
      'procurement, the brief, the agency), and suggest they add someone. The same goes for an area whose only ' +
      'person has no link yet. Never treat anyone as owning a gap.'
  } else {
    advice =
      `Gaps: ${missing.join('; ')}. Asks for an adviser nobody on their side speaks for may come to this person, ` +
      'marked as such. Ask only what they can answer from where they sit, and never treat them as owning it.'
  }
  return `## Who speaks for each adviser\n${sides.join('\n')}\n\n${advice}`
}

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
    `You are talking with ${describe(participant)}. ` +
      (participant.lenses.length
        ? `They speak for what the ${names(participant.lenses)} ${participant.lenses.length > 1 ? 'advisers care' : 'adviser cares'} about.`
        : 'They speak for no adviser in particular.'),
    renderCoverage(room, participant),
    `## Their open asks\n${open.length ? open.map(renderAsk).join('\n') : 'None.'}`,
    `## What they were asked before\n${past.length ? past.map(renderAsk).join('\n') : 'Nothing yet.'}`,
    `## Asks they have had from each adviser\n${LENS_IDS.map((lens) => `${LENS_NAMES[lens]} ${counts[lens]}`).join(', ')}.`,
    `## Candidates for the next ask, best first\n` +
      (candidates.length
        ? candidates
            .slice(0, MAX_CANDIDATES)
            .map(
              (candidate, index) =>
                `${index + 1}. [${KIND_LABELS[candidate.kind]}${candidate.lens ? `, ${candidate.lens}` : ''}` +
                `${candidate.unowned ? ', nobody on their side speaks for this' : ''}] ` +
                `Find out ${oneLine(candidate.findOut)}. Because: ${oneLine(candidate.because)}`,
            )
            .join('\n')
        : 'None for this person: the advisers are done, or what they need is for someone else. Ask nothing unless ' +
          'something in their message needs following up.'),
  ].join('\n\n')
}

/** What this person just said, and what to do with it. */
export function turnPrompt(
  room: RoomSnapshot,
  participant: Participant,
  item: Item,
  candidates: AskCandidate[],
  previous?: Assessment | null,
): string {
  return [
    renderPerson(room, participant, candidates),
    renderAssessment(previous),
    `## What they just said (${ref('item', item.id)})\n<message>\n${item.text}\n</message>`,
    'Take facts only from this message, quoting its exact words. Use ids exactly as they appear in the room ' +
      '(f12, a4). If it names someone involved in the project who is not in the people list, add them to ' +
      'people_mentioned. Rate all seven areas again in alignment, changing only what this message or the ' +
      'reports give you reason to. Then say what you noted and ask the one next thing, following your harness: ' +
      'take the first candidate that still fits after this message, and skip any it has just answered, unless a ' +
      'signal in what they just said or a higher ranked area outranks it. If you are educating, put the ' +
      'explanation in explain and keep ask to the one question.',
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
