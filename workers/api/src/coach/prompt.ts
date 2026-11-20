import type { SystemModelMessage } from 'ai'

import { areaName } from '@day15/shared/areas'
import { LENS_IDS, LENS_NAMES, type LensId } from '@day15/shared/lenses'
import { PRIORITY_MEANINGS, priorityLabel } from '@day15/shared/priorities'
import { ref } from '@day15/shared/refs'
import {
  PERSONA_NAMES,
  SIDES,
  type Ask,
  type Item,
  type LensRun,
  type OpenQuestion,
  type Participant,
  type RoomSnapshot,
} from '@day15/shared/schema'
import coachHarness from '../../../../persona-harnesses/coach.md'
import coachReference from '../../../../persona-harnesses/coach-reference.md'
import milestones from '../../../../persona-harnesses/milestones-reference.md'
import motherAgent from '../../../../persona-harnesses/mother-agent.md'
import aboutALine from '../../../../persona-harnesses/about-a-line.md'
import { renderRoom } from '../room/render'
import { rollup, type AreaStanding } from './rollup'
import { heardFrom, lensGaps, speakersFor, type AskCandidate } from './select'

const MAX_CANDIDATES = 8
const MAX_PAST_ASKS = 10

const CACHED = { anthropic: { cacheControl: { type: 'ephemeral' } } } as const

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

function renderRun(run: LensRun, room: RoomSnapshot): string {
  const report = run.report!
  const name = LENS_NAMES[run.lens]
  const read = run.watermark < room.watermark ? `read up to ${ref('fact', run.watermark)}, newer facts not seen yet` : 'up to date'
  const lines = [`### ${name} adviser (${ref('lensRun', run.id)}, ${read})${report.done ? ': says it is done' : ''}`]

  const thin = report.coverage.filter((topic) => topic.agency !== 'settled' || topic.client !== 'settled')
  lines.push(
    thin.length
      ? `Not settled yet: ${thin.map((topic) => `${oneLine(topic.topic)} (agency ${topic.agency}, client ${topic.client})`).join('; ')}.`
      : 'Everything it covers is settled on both sides.',
  )

  const open = room.openQuestions.filter((question) => question.lens === run.lens).map((question) => ref('question', question.id))
  lines.push(open.length ? `Its open questions: ${open.join(', ')}.` : 'It has no open questions.')
  return lines.join('\n')
}

/** Where each lens stands, for the coach. Their open questions are in the room. People never see these. */
export function renderReports(room: RoomSnapshot): string {
  return [
    '# Where the advisers stand',
    'From their newest reports. What they found unresolved is in the open questions in the room above, and facts ' +
      'they proposed are there as proposed facts.',
    ...LENS_IDS.map((lens) => {
      const run = room.latestRuns[lens]
      return run?.report ? renderRun(run, room) : `### ${LENS_NAMES[lens]} adviser\nNo report yet.`
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
  '**Your matrix is worked out for you.** Where the mother agent tells you to rate each area and work out the ' +
    'overall health, you do not: the area ratings and the health reading are worked out from the open questions ' +
    'and shown to you each turn under "Where each area stands". There is one scale, priority: high (1), medium (2) ' +
    'and low (3), with the meanings the mother agent gives her ratings. You change the matrix only through the ' +
    'open questions: re-rank one with reprioritise, resolve one with resolved_questions, or raise one of your own ' +
    'with raise_questions when you hear a signal no adviser has raised.',
].join('\n\n')

/** The mother agent, the coach's harness and the two reference packs, the same for every call. */
export function renderHarness(): string {
  return [
    HOW_THEY_FIT,
    motherAgent.trim(),
    coachHarness.trim(),
    '<reference>',
    coachReference.trim(),
    milestones.trim(),
    '</reference>',
  ].join('\n\n')
}

const STANDING_NOTES: Record<AreaStanding, string> = {
  high: '',
  medium: '',
  low: '',
  aligned: 'nothing open, and both sides have said something here',
  unknown: 'nothing open, but one side or both has said nothing here yet',
}

function questionTag(question: OpenQuestion): string {
  return `${ref('question', question.id)} ${priorityLabel(question.priority)} ${question.kind}`
}

/** The matrix and health reading, worked out from the open questions. Nobody on either side sees it. */
export function renderRollup(room: RoomSnapshot): string {
  const { areas, health } = rollup(room)
  const reading = health
    ? `Health: ${health.score} out of 100, ${health.band}.`
    : 'No health reading yet: both sides have not said anything.'
  return [
    '## Where each area stands',
    `Worked out from the open questions, most important area first. ${PRIORITY_MEANINGS}`,
    ...areas.map(({ area, standing, questions }) => {
      const detail = questions.length ? `: ${questions.map(questionTag).join('; ')}` : `: ${STANDING_NOTES[standing]}`
      return `- ${areaName(area)} (${area}), ${standing}${detail}`
    }),
    `${reading} Nobody on either side sees any of this.`,
  ].join('\n')
}

/** Room first, then the lens reports, then the coach's own harness, then what it knows about A-Line. */
export function coachInstructions(room: RoomSnapshot): SystemModelMessage[] {
  return [
    { role: 'system', content: renderRoom(room), providerOptions: CACHED },
    { role: 'system', content: renderReports(room) },
    { role: 'system', content: renderHarness() },
    { role: 'system', content: aboutALine.trim() },
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

function candidateLabel(candidate: AskCandidate): string {
  const kind =
    candidate.kind === 'missing_topic' ? 'nothing said yet' : candidate.kind
  return [
    candidate.questionId ? ref('question', candidate.questionId) : null,
    candidate.priority ? `${priorityLabel(candidate.priority)} priority` : null,
    kind,
    areaName(candidate.area),
    candidate.lens,
    candidate.unowned ? 'nobody on their side speaks for this' : null,
  ]
    .filter(Boolean)
    .join(', ')
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
    `## Candidates for the next ask, best first\n${PRIORITY_MEANINGS}\n` +
      (candidates.length
        ? candidates
            .slice(0, MAX_CANDIDATES)
            .map(
              (candidate, index) =>
                `${index + 1}. [${candidateLabel(candidate)}] ` +
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
): string {
  return [
    renderPerson(room, participant, candidates),
    renderRollup(room),
    `## What they just said (${ref('item', item.id)})\n<message>\n${item.text}\n</message>`,
    'Take facts only from this message, quoting its exact words. Use ids exactly as they appear in the room ' +
      '(f12, a4, q7). If it names someone involved in the project who is not in the people list, add them to ' +
      'people_mentioned. If it settles an open question, list it in resolved_questions. If they ask to keep ' +
      'something private, mark those facts private. Then say what you noted and ask the one next thing, following your harness: take the first candidate that still fits after this ' +
      'message, and skip any it has just answered, unless a signal in what they just said or a higher ranked area ' +
      'outranks it. Give the open question it chases as question. If you are educating, put the explanation in ' +
      'explain and keep ask to the one question.',
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
