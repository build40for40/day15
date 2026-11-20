import type { LensId } from '@day15/shared/lenses'
import { ref } from '@day15/shared/refs'
import { TOPICS, type LensRun, type RoomSnapshot } from '@day15/shared/schema'
import { renderQuestion, renderRoom } from '../room/render'
import { fillSlots, PERSONAS, WRAPPER } from './personas'

/** The room goes first so every lens in a round shares the same prefix, and the lens's own instructions follow. */
export interface LensPrompt {
  room: string
  instructions: string
}

/** Its conflicts and questions are left out: what is still open of them comes separately, as open questions. */
function previousReport(previous: LensRun | undefined, room: RoomSnapshot): string {
  if (!previous?.report) return 'None yet: this is your first report, so every fact in the room is new to you.'
  const since = room.facts.filter((fact) => fact.id > previous.watermark).map((fact) => ref('fact', fact.id))
  const { conflicts: _conflicts, questions: _questions, resolved: _resolved, ...report } = previous.report
  return [
    `You wrote this in ${ref('lensRun', previous.id)}, when the newest fact was ${ref('fact', previous.watermark)}.`,
    since.length ? `Facts that arrived since: ${since.join(', ')}.` : 'No facts have arrived since.',
    JSON.stringify(report, null, 2),
  ].join('\n')
}

function ownOpenQuestions(lens: LensId, room: RoomSnapshot): string {
  const open = room.openQuestions.filter((question) => question.lens === lens)
  return open.length ? open.map(renderQuestion).join('\n') : 'None.'
}

export function lensPrompt(lens: LensId, room: RoomSnapshot, roomText = renderRoom(room)): LensPrompt {
  return {
    room: roomText,
    instructions: fillSlots(WRAPPER, {
      persona: PERSONAS[lens].trim(),
      previous: previousReport(room.latestRuns[lens], room),
      open_questions: ownOpenQuestions(lens, room),
      topics: TOPICS.join(', '),
    }),
  }
}
