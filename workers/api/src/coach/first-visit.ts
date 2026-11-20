import type { Participant, RoomSnapshot } from '@day15/shared/schema'

export const FIRST_VISIT =
  "Welcome to A-Line! I'm the coach: I help the agency and the client spot blind spots and words read two ways " +
  "before the work starts, not after the budget's gone. Tell me about the project in your own words or paste in " +
  "the brief, and I'll ask one thing at a time."

export const isFirstVisit = (room: RoomSnapshot, participant: Participant) =>
  !room.items.some((item) => item.participantId === participant.id)

/** Puts the welcome before the coach's greeting for someone who has not said anything yet. */
export const withFirstVisit = (room: RoomSnapshot, participant: Participant, reply: string) =>
  isFirstVisit(room, participant) ? `${FIRST_VISIT}\n\n${reply}` : reply
