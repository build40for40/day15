import type { Fact, Item, NewParticipant, Participant, PersonaReport, Topic } from '@day15/shared/schema'
import type { RoomStore } from './store'

/**
 * A made-up project for tests and demos: a juice brand commissioning a kids' game app. Every name is invented.
 * It hides four misalignments: what the budget covers, what "voice" means, who owns the IP, and feedback rounds.
 */
export const FIXTURE_PROJECT = {
  id: '00000000-0000-4000-8000-000000000015',
  name: 'Pipsqueak Juice: Orchard Dash',
  ownerId: 'user_fixture_owner',
}

const AGENCY = 'Make-Believe Studio'
const CLIENT = 'Pipsqueak Juice'

/** Alex speaks for two lenses. Nobody on the client side speaks for delivery. */
const PEOPLE = {
  alex: {
    name: 'Alex Example',
    persona: 'agency_lead',
    side: 'agency',
    jobTitle: 'Managing Director',
    organisation: AGENCY,
    lenses: ['agency', 'cfo'],
    notes: "Signs off the agency's quotes.",
  },
  dana: { name: 'Dana Placeholder', persona: 'delivery_lead', side: 'agency', jobTitle: 'Head of Delivery', organisation: AGENCY },
  casey: {
    name: 'Casey Sample',
    persona: 'marketing_lead',
    side: 'client',
    jobTitle: 'Brand Manager',
    organisation: CLIENT,
    notes: 'Reports to the brand board.',
  },
  robin: { name: 'Robin Fakeworth', persona: 'cfo', side: 'client', jobTitle: 'Finance Director', organisation: CLIENT },
  pat: { name: 'Pat Notreal', persona: 'procurement', side: 'client', jobTitle: 'Procurement Lead', organisation: CLIENT },
} satisfies Record<string, NewParticipant>

/** Someone the coach heard about, with no link. */
const MENTIONED: NewParticipant = {
  name: 'Morgan Madeup',
  persona: 'marketing_lead',
  side: 'client',
  jobTitle: 'Chair of the brand board',
  organisation: CLIENT,
  notes: 'Chairs the brand board that signs off every creative change.',
}

export type FixturePerson = keyof typeof PEOPLE

type FixtureFact = { topic: Topic; statement: string; quote: string; supersedes?: string }

const SAID: { by: FixturePerson; text: string; facts: Record<string, FixtureFact> }[] = [
  {
    by: 'alex',
    text:
      'Thanks for picking us! Our quote is £60k for the build of Orchard Dash: iOS and Android, five levels, and ' +
      'a talking voice character kids can chat with. That includes two rounds of feedback on designs. Hosting ' +
      'and app store fees sit outside that.',
    facts: {
      quoteCovers: {
        topic: 'budget',
        statement: "The agency's £60k quote covers building the app only. Hosting and app store fees are extra.",
        quote: 'Hosting and app store fees sit outside that.',
      },
      platforms: {
        topic: 'deliverables',
        statement: 'The app is for iOS and Android, with five levels.',
        quote: 'iOS and Android, five levels',
      },
      voiceCharacter: {
        topic: 'deliverables',
        statement: 'The agency plans a talking voice character that kids can chat with out loud.',
        quote: 'a talking voice character kids can chat with',
      },
      twoRounds: {
        topic: 'sign_off',
        statement: 'The quote includes two rounds of feedback on designs.',
        quote: 'two rounds of feedback on designs',
      },
    },
  },
  {
    by: 'dana',
    text:
      'We build on our own game engine, which we license to clients and keep the rights to. Timeline is 12 weeks ' +
      'from sign off.',
    facts: {
      engine: {
        topic: 'legal_ip',
        statement: 'The agency keeps the rights to its game engine and licenses it to the client.',
        quote: 'our own game engine, which we license to clients and keep the rights to',
      },
      twelveWeeks: { topic: 'timeline', statement: 'Delivery is 12 weeks from sign off.', quote: '12 weeks from sign off' },
    },
  },
  {
    by: 'casey',
    text:
      "It's for kids aged 6 to 10. The game has to have the Pipsqueak voice: cheeky, warm, never preachy. Launch " +
      'is the summer holidays. Our brand board signs off every creative change, and they meet once a month.',
    facts: {
      audience: { topic: 'audience', statement: 'The game is for kids aged 6 to 10.', quote: 'kids aged 6 to 10' },
      brandVoice: {
        topic: 'background',
        statement: 'The game must sound like the Pipsqueak brand: cheeky, warm and never preachy.',
        quote: 'the Pipsqueak voice: cheeky, warm, never preachy',
      },
      summer: { topic: 'timeline', statement: 'Launch is planned for the summer holidays.', quote: 'Launch is the summer holidays' },
      monthlyBoard: {
        topic: 'sign_off',
        statement: 'The brand board signs off every creative change and meets once a month.',
        quote: 'signs off every creative change, and they meet once a month',
      },
    },
  },
  {
    by: 'robin',
    text: 'Sixty thousand is the whole budget, fixed, and it has to cover everything for the first year, hosting included.',
    facts: {
      wholeBudget: {
        topic: 'budget',
        statement: "The client's £60k budget is fixed and must cover everything for the first year, hosting included.",
        quote: 'Sixty thousand is the whole budget, fixed',
      },
    },
  },
  {
    by: 'pat',
    text: 'Standard terms for us: we own all the IP outright, code and characters, on final payment.',
    facts: {
      ownAll: {
        topic: 'legal_ip',
        statement: 'The client expects to own all the IP outright, code and characters included, on final payment.',
        quote: 'we own all the IP outright, code and characters',
      },
    },
  },
  {
    by: 'casey',
    text: 'Small update: the brand board meets every two weeks now.',
    facts: {
      fortnightlyBoard: {
        topic: 'sign_off',
        statement: 'The brand board signs off every creative change and meets every two weeks.',
        quote: 'the brand board meets every two weeks now',
        supersedes: 'monthlyBoard',
      },
    },
  },
]

const CFO_REPORT: PersonaReport = {
  coverage: [
    { topic: 'What the price covers', agency: 'settled', client: 'settled' },
    { topic: 'Contingency', agency: 'missing', client: 'missing' },
  ],
  conflicts: [
    {
      topic: 'What the price covers',
      agency_said: 'Hosting and app store fees sit outside that.',
      client_said: 'it has to cover everything for the first year, hosting included',
      severity: 'fundamental',
      note: 'They are pricing two different projects.',
    },
  ],
  questions: [{ ask: 'client', find_out: 'what happens if hosting pushes the total past £60k', because: 'Nobody holds a cushion.', priority: 1 }],
  done: false,
}

export interface Fixture {
  people: Record<FixturePerson, { participant: Participant; secret: string }>
  mentioned: Participant
  items: Item[]
  facts: Record<string, Fact>
}

/** Fills an empty room with the fixture project. Works on a RoomStore, or a ProjectRoom stub, since they match. */
export async function seedFixture(
  room: Pick<RoomStore, 'create' | 'addParticipant' | 'addMentioned' | 'addItem' | 'addFacts' | 'saveLensRun' | 'addAsk'>,
): Promise<Fixture> {
  await room.create(FIXTURE_PROJECT)
  const people = {} as Fixture['people']
  for (const [handle, person] of Object.entries(PEOPLE)) {
    const { participant, secret } = await room.addParticipant(person)
    people[handle as FixturePerson] = { participant, secret: secret! }
  }
  const [mentioned] = await room.addMentioned([MENTIONED])

  const items: Item[] = []
  const facts: Record<string, Fact> = {}
  for (const said of SAID) {
    const participantId = people[said.by].participant.id
    const item = await room.addItem(participantId, said.text)
    items.push(item)
    const added = await room.addFacts(
      Object.values(said.facts).map((fact) => ({
        authorKind: 'person' as const,
        participantId,
        sourceItemId: item.id,
        sourceQuote: fact.quote,
        status: 'confirmed' as const,
        topic: fact.topic,
        statement: fact.statement,
        supersedes: fact.supersedes ? facts[fact.supersedes]!.id : undefined,
      })),
    )
    Object.keys(said.facts).forEach((key, index) => (facts[key] = added[index]!))
  }

  const run = await room.saveLensRun({ lens: 'cfo', round: 1, watermark: facts.wholeBudget!.id, report: CFO_REPORT, status: 'done' })
  const [budgetGap] = await room.addFacts([
    {
      authorKind: 'lens',
      lensRunId: run.id,
      basedOn: [facts.quoteCovers!.id, facts.wholeBudget!.id],
      topic: 'budget',
      statement: 'The two sides read the £60k differently: the build only for the agency, everything for a year for the client.',
    },
  ])
  facts.budgetGap = budgetGap!

  await room.addAsk({
    addressedTo: people.casey.participant.id,
    ask: 'When you say the Pipsqueak voice, do you mean how the game sounds and writes, or a character kids talk to out loud?',
    because: 'Voice could mean brand tone or a talking feature, and they cost very different amounts.',
    lens: 'client',
  })

  return { people, mentioned: mentioned!, items, facts }
}
