import type { Topic } from '@day15/shared/schema'

/**
 * Everything the person's own AI client reads from this server: the server instructions, the tool descriptions
 * and the fixed lines in tool results. Tune the wording here. Clients may reset "Always allow" when a tool's
 * description changes, so prefer tuning SERVER_INSTRUCTIONS and OPEN_ROOM_GUIDE first.
 */

export const SERVER_NAME = 'a-line-coach'

const SHARED_WITH_EVERYONE = 'Everything sent to the coach is shared with everyone on the project, on both sides.'

export const SERVER_INSTRUCTIONS = `This server is A-Line. It connects the person to the coach for one project: an agency and a client agreeing brief, scope and budget before work starts. The coach lives on the server. It keeps what everyone says, checks it against the other side, and asks the next question that matters. You are the relay between the person and the coach. You are not the coach.

When the person says "A-Line", "Aline", "A Line" or "aline", they mean this server. Send any question about what it is, how it works, what to do or who can see what to the coach with tell_coach, and don't answer it from your own knowledge.

- At the start of every conversation, call open_room before you reply, and show the person what the coach says.
- Whenever the person says anything about the project, including answers to the coach's questions, call tell_coach with their words verbatim and in full. If they paste or attach a document, brief, email or notes, put its full text in the same message. Never summarise, shorten, tidy, translate or rephrase what you send.
- Show the coach's reply to the person exactly as written. Don't add your own questions or advice about the project, don't answer the coach's questions for the person, and don't answer on the coach's behalf.
- When the person asks what has been said or agreed, or where the sides disagree, call read_room and show them what it returns.
- If a tool returns an error, tell the person what it says.
- ${SHARED_WITH_EVERYONE} Leave out passwords, card numbers and other secrets, even if asked.`

export const OPEN_ROOM_GUIDE = `Show the person the coach's words below as written. From here on, send everything they say about the project to tell_coach, word for word, with the full text of anything they paste or attach, and show the coach's reply as written. ${SHARED_WITH_EVERYONE}`

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const writes = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }

export const OPEN_ROOM_TOOL = {
  name: 'open_room',
  title: 'Open the project room',
  description:
    "Open the person's project room. Call it at the start of every conversation, before you reply to their first message, without being asked. It says who they are on the project, where the project stands, and what the coach most needs from them. Show the coach's words to the person as written.",
  annotations: writes,
}

export const TELL_COACH_TOOL = {
  name: 'tell_coach',
  title: 'Tell the coach',
  description:
    "Send what the person said to the project's coach, and get the coach's reply. Call it every time the person says anything about the project, including answers to the coach's questions. Send their words verbatim and in full, with the full text of any document, brief, email or notes they paste or attach. Never summarise or rephrase. Show the reply to the person exactly as written, and don't answer on the coach's behalf. Everything sent is shared with everyone on the project.",
  message:
    'Exactly what the person said, word for word, then the full text of anything they pasted or attached. Up to 20,000 characters: send a longer document in several calls, in order.',
  annotations: writes,
}

export const READ_ROOM_TOOL = {
  name: 'read_room',
  title: 'Read the project room',
  description:
    "Read what the project room holds: what each side has said, topic by topic, with anything not yet confirmed marked as proposed, then the open questions, most urgent first, including where the agency and the client don't line up yet. Call it when the person asks what has been said or agreed, what's still open, or where the sides disagree. Show it to them plainly. It never replaces telling the coach something.",
  topic: 'Only this topic. Leave it out for the whole room.',
  onlyOpenQuestions: 'True for just the open questions, without the facts.',
  annotations: readOnly,
}

export const TOPIC_LABELS: Record<Topic, string> = {
  background: 'Background',
  objective: 'Objective',
  audience: 'Audience',
  insight: 'Insight',
  kpis: 'KPIs',
  budget: 'Budget',
  deliverables: 'Deliverables',
  timeline: 'Timeline',
  sign_off: 'Sign off',
  legal_ip: 'Legal and IP',
  other: 'Other',
}

export const COACH_FAILED = "The coach couldn't get to that just now. Try again in a minute."
export const NO_PROJECT = 'This project room is empty: the project may have been removed.'
export const NO_FACTS = 'Nothing has been said about this yet.'
export const NO_OPEN_QUESTIONS = 'Nothing open right now.'
export const OPEN_QUESTIONS_HEADING = 'Still open, most urgent first'
export const PROPOSED = 'Proposed, not confirmed yet:'
export const NOT_CHECKED = "The coach hasn't checked these against each other yet."
export const CHECKED_UP_TO = (factRef: string) => `Checked up to ${factRef}. Anything newer is still being checked.`
