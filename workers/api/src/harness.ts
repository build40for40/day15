import type { LensId } from '@day15/shared/lenses'

import agency from '../../../persona-harnesses/personas/agency.md'
import cfo from '../../../persona-harnesses/personas/cfo.md'
import client from '../../../persona-harnesses/personas/client.md'
import delivery from '../../../persona-harnesses/personas/delivery.md'
import procurement from '../../../persona-harnesses/personas/procurement.md'
import wrapper from '../../../persona-harnesses/wrapper.md'
import type { Room, RoomSide } from './room'

/** Each persona's Actor, Instructions and Mission, straight from its markdown file. `cto` is the delivery persona. */
export const PERSONAS: Record<LensId, string> = { cfo, cto: delivery, agency, client, procurement }

/** A side as the harnesses read it: its description, then every question it was asked and its answer. */
export function captured(side: RoomSide | undefined): string {
  if (!side) return 'This side has not spoken to the coach yet.'
  const turns = side.turns.map((turn) => `Asked: ${turn.question}\nAnswered: ${turn.answer}`)
  return [`Their description of the project: ${side.project}`, ...turns].join('\n\n')
}

/** One persona harness, ready to run: the shared wrapper with its three slots filled. */
export function harnessPrompt(lens: LensId, room: Room): string {
  const slots: Record<string, string> = {
    persona: PERSONAS[lens].trim(),
    agency_side: captured(room.sides.agency),
    client_side: captured(room.sides.client),
  }
  return wrapper.replace(/\{\{(\w+)\}\}/g, (slot, name: string) => slots[name] ?? slot)
}
