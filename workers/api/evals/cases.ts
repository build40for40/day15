import type { PersonaReport } from '@day15/shared/schema'
import type { FixturePerson } from '../src/room/fixture'
import type { fixtureRoom } from '../src/testing'

export type FixtureRoom = Awaited<ReturnType<typeof fixtureRoom>>

export interface EvalCase {
  id: string
  speaker: FixturePerson
  message: string
  /** What a good turn looks like here. The judge reads it as guidance, the README repeats it. */
  expect: string
  /** Varies the fixture room before the turn: more lens reports, more asks. */
  setup?: (fixture: FixtureRoom) => Promise<void>
}

const report = (conflicts: PersonaReport['conflicts'], questions: PersonaReport['questions'] = []): PersonaReport => ({
  coverage: [],
  conflicts,
  questions,
  done: false,
})

export const CASES: EvalCase[] = [
  {
    id: 'answers-open-ask',
    speaker: 'casey',
    message: 'Oh, by voice we just mean the tone of the writing and how the game sounds. Nobody is chatting to a character.',
    expect:
      "Casey is answering the open ask about what 'voice' means (a1). The coach should record the tone reading as a fact with a quote, close a1 as answered, and not ask about voice again. Its next ask should not be the voice question.",
  },
  {
    id: 'corrects-own-fact',
    speaker: 'robin',
    message: 'Correction on the budget: finance has found another five thousand, so the whole budget is sixty-five thousand now, still fixed.',
    expect:
      'Robin is changing the budget fact he gave earlier. The new figure (65k) must be recorded as a fact that replaces his earlier budget fact, quoting his words, and no other figure appears. The 60k fixed claim should not be left standing as current.',
  },
  {
    id: 'hedged-answer',
    speaker: 'pat',
    message: "I think we'd probably want the IP, but I haven't checked with legal. Maybe the engine can stay with them, not sure.",
    expect:
      'Pat hedged twice. Facts must be marked tentative or worded as hedged, not stated as firm. Nothing beyond what Pat said may be recorded (no firm claim that the engine stays with the agency).',
  },
  {
    id: 'no-facts-to-take',
    speaker: 'casey',
    message: "Thanks, that's helpful. What should I do next?",
    expect:
      'There is nothing factual in the message. The coach must record no facts, invent nothing, and still give exactly one next ask suited to a client marketing lead.',
  },
  {
    id: 'urgent-conflict-first',
    speaker: 'alex',
    message: 'Quick note from our side: the soft launch build is due to the client in week eight, and we can show them a prototype in week three.',
    expect:
      'The open questions hold two fundamental conflicts at priority 1: what the price covers (CFO adviser, which Alex speaks for) and who owns the IP (procurement adviser, which nobody on the agency side speaks for, so it may come to Alex marked as nobody\'s). A minor conflict about demo dates and a priority 1 delivery question bait, but delivery belongs to Dana, who speaks for it on the agency side. The ask to Alex should go to one of the two fundamental conflicts (hosting and fees, or the engine and IP), not the demo dates.',
    setup: async ({ room, facts }) => {
      await room.saveLensRun({
        lens: 'procurement',
        round: 1,
        watermark: facts.wholeBudget!.id,
        status: 'done',
        report: report(
          [
            {
              topic: 'Who owns the IP',
              agency_said: 'We keep the rights to our game engine and license it.',
              client_said: 'we own all the IP outright, code and characters, on final payment',
              priority: 1,
              note: 'The client expects the engine too.',
            },
          ],
          [{ ask: 'agency', find_out: 'whether the engine can be licensed on terms the client accepts', because: 'Ownership blocks signing.', priority: 1 }],
        ),
      })
      await room.saveLensRun({
        lens: 'cto',
        round: 1,
        watermark: facts.wholeBudget!.id,
        status: 'done',
        report: report(
          [
            {
              topic: 'Demo dates',
              agency_said: 'Delivery is 12 weeks from sign off.',
              client_said: 'Launch is the summer holidays.',
              priority: 3,
              note: 'Dates are probably compatible.',
            },
          ],
          [{ ask: 'agency', find_out: 'which week the first demo happens', because: 'Dates are loose.', priority: 1 }],
        ),
      })
    },
  },
  {
    id: 'right-person-for-persona',
    speaker: 'dana',
    message: "For hosting we'd use our usual cloud setup, around four hundred pounds a month, and we'd keep the app store accounts in our name.",
    expect:
      "Dana is a delivery lead on the agency side and speaks for the delivery adviser, which has an open priority 1 question for the agency side about who runs the app after launch. The coach should record the hosting cost and the store account facts faithfully. Its ask must suit a delivery lead (delivery, hosting, timeline, technical dependencies). It must not ask her about the money conflict, which goes to Alex, who speaks for the CFO adviser on the agency side, nor anything only the client can answer, like the client's brand board or budget limits.",
    setup: async ({ room, people, facts }) => {
      await room.addAsk({
        addressedTo: people.casey.participant.id,
        ask: 'How often does the brand board meet?',
        because: 'Sign off cadence drives the timeline.',
        lens: 'client',
      })
      await room.saveLensRun({
        lens: 'cto',
        round: 1,
        watermark: facts.wholeBudget!.id,
        status: 'done',
        report: report(
          [],
          [{ ask: 'agency', find_out: 'who runs and patches the app once it is live', because: 'Nobody owns it after launch.', priority: 1 }],
        ),
      })
    },
  },
  {
    id: 'no-repeat-of-answered-ask',
    speaker: 'robin',
    message: 'On contingency: there is none. If hosting pushes us over sixty thousand, I would have to go back to the board.',
    expect:
      'An earlier ask to Robin about hosting costs was already answered, shown in the room as answered. The coach must not ask about hosting costs again. It should record the contingency fact with a quote and ask about something new, such as what happens at the board or the budget conflict.',
    setup: async ({ room, people, items }) => {
      const ask = await room.addAsk({
        addressedTo: people.robin.participant.id,
        ask: 'Who pays for hosting once the app is live?',
        because: 'The quote leaves hosting out.',
        lens: 'cfo',
      })
      await room.closeAsk(ask.id, { status: 'answered', answeredBy: items.find((item) => item.text.startsWith('Sixty thousand'))!.id })
    },
  },
  {
    id: 'confirms-lens-proposal',
    speaker: 'robin',
    message: "Yes, that's exactly it. For us the sixty thousand has to cover the build and everything for a year. The agency reads it as the build only.",
    expect:
      'The room has a proposed lens fact saying the two sides read the 60k differently. Robin agrees with it. The coach should record the confirmation as a fact quoting Robin, replacing the proposal, and invent no new numbers. The ask should move to resolving the gap, not re-ask what Robin just said.',
  },
  {
    id: 'asks-what-aline-is',
    speaker: 'casey',
    message: "Sorry, what actually is Aline? I've been sent a link and I'm not sure what I'm meant to do here.",
    expect:
      'Casey is asking about the product, not the project. The reply should explain in two to four sentences what A-Line is (a coach that helps the agency and the client find blind spots and words read two ways before the work starts) and what to do (tell the coach about the project in her own words or paste the brief, then answer one question at a time), then return to the project with exactly one ask. The message holds no project facts, so no facts may be recorded and no ask may be closed as answered. Count any mention of advisers, lenses, prompts, models, scores, ratings, matrices, health readings or ids in the reply as a no_invention fail.',
  },
  {
    id: 'asks-how-questions-are-chosen',
    speaker: 'alex',
    message: 'Out of curiosity, how does A-Line decide what to ask me? Who is actually behind these questions?',
    expect:
      'Alex is asking how the coach works. The reply should give the user-level account (it listens, notes what matters, compares what both sides expect and asks the one thing that matters most), may say the rest is the kitchen, and then ask exactly one project question. It must not mention advisers, lenses, personas, prompts, harness files, models or AI companies, scores, ratings, matrices or health readings, and must not count or name anything behind the coach: count any of these in the reply as a no_invention fail. If it says who built it, only that the 40 for 40 team built it live in a day as an experiment. No facts may be recorded and no ask closed as answered.',
  },
]
