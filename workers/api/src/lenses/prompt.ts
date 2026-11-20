import type { LensId } from '@day15/shared/lenses'
import { ref } from '@day15/shared/refs'
import { TOPICS, type LensRun, type RoomSnapshot } from '@day15/shared/schema'
import { renderRoom } from '../room/render'
import { fillSlots, PERSONAS, WRAPPER } from './personas'

/** The room goes first so every lens in a round shares the same prefix, and the lens's own instructions follow. */
export interface LensPrompt {
  room: string
  instructions: string
}

function previousReport(previous: LensRun | undefined, room: RoomSnapshot): string {
  if (!previous?.report) return 'None yet: this is your first report, so every fact in the room is new to you.'
  const since = room.facts.filter((fact) => fact.id > previous.watermark).map((fact) => ref('fact', fact.id))
  return [
    `You wrote this in ${ref('lensRun', previous.id)}, when the newest fact was ${ref('fact', previous.watermark)}.`,
    since.length ? `Facts that arrived since: ${since.join(', ')}.` : 'No facts have arrived since.',
    JSON.stringify(previous.report, null, 2),
  ].join('\n')
}

export function lensPrompt(lens: LensId, room: RoomSnapshot, roomText = renderRoom(room)): LensPrompt {
  return {
    room: roomText,
    instructions: fillSlots(WRAPPER, {
      persona: PERSONAS[lens].trim(),
      previous: previousReport(room.latestRuns[lens], room),
      topics: TOPICS.join(', '),
    }),
  }
}
