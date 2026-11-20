# Persona harnesses

Five persona harnesses feed the coach, which is the brain the persona files mention. Each one reads everything both sides have told the coach so far and reports back, through its own lens, what is settled, what is missing and where the two sides are heading for a row. The coach reads all five reports and decides what it asks next, following [`coach.md`](coach.md).

Neither the agency nor the client ever sees a persona, its name or its report. They only ever meet one warm coach.

| File | Persona | Protects |
| --- | --- | --- |
| `personas/client.md` | Client | The reason the project exists, and who it is for |
| `personas/agency.md` | Agency | The team's ability to do good work |
| `personas/cfo.md` | CFO | The money |
| `personas/procurement.md` | Procurement | The agreement, and the bad day |
| `personas/delivery.md` | Delivery | The promise being buildable |

## The mother agent

[`mother-agent.md`](mother-agent.md) is Samira's AIM for the one voice people talk to. The Worker loads it together with `coach.md`, and the two split the job:

- **The mother agent is how the coach thinks and speaks:** who it is, the signals it listens for from the project stories, what is at stake, its priority matrix and ratings, how it chooses and words the next ask, and when it explains something before asking.
- **`coach.md` is how the coach keeps the room:** taking facts from what a person says, corrections, confirmations and closing asks.

Where the two differ on what to ask, how to word it or how to treat what the other side said, the mother agent wins. Where they differ on recording facts, `coach.md` wins. That rule is written once, in `workers/api/src/coach/prompt.ts`.

Three things come out of it:

- **An explanation before the question,** when the coach is educating. It is read once in the reply and is not stored with the ask.
- **The priority matrix:** with every turn the coach rates the seven areas high, medium, low or aligned. The areas, weights and sums live in `packages/shared/src/alignment.ts`.
- **The health reading,** worked out in code from those ratings, and absent until both sides have said something.

The matrix and the reading are kept in the room but are not part of the room snapshot, so no tool, lens or page shows them. Only the coach reads them back, on its next turn. A view for the team does not exist yet.

**Still to settle between Samira and Ben:** the mother agent assumes each side's conversation is private, and tells the coach never to quote or hint at what the other side said. The room is shared, and `read_room` shows every fact to everyone, so today the coach is discreet in a room that is not.

## A draft that is not wired in

[`personas/delivery-procurement-finance.md`](personas/delivery-procurement-finance.md) is one persona covering what `cfo.md`, `delivery.md` and `procurement.md` cover between them, for a version with three lenses and not five. Nothing loads it.

## Who owns what

- **The five files in `personas/` and `mother-agent.md`** are Samira's. Each is one persona's Actor, Instructions and Mission, and nothing else. Changes to who a persona is, what it covers or what it asks go there.
- **`wrapper.md` and everything in this README below the AIM section** are Ben's: the shared wrapper, the report format and how the coach uses the reports. So are `coach.md` and `coach-reference.md`, the coach's own harness. It may change to fit the architecture without the persona files needing to.

## AIM: Actor, Instructions, Mission

Every persona harness is written in the same three parts.

- **Actor:** who the persona is and what it protects.
- **Instructions:** the topics it must see settled, its red flags, the one thing it never lets slide, and what to find out from each side.
- **Mission:** the one thing it has to tell the brain, and how it knows it is done.

The shared wrapper below follows the same shape.

## The shared wrapper

Every persona harness runs as a lens inside the same wrapper, [`wrapper.md`](wrapper.md), which the Worker loads as it is (`workers/api/src/lenses/`).

Each lens call is one prompt in two parts. The whole data room comes first, rendered by `renderRoom` in `workers/api/src/room/render.ts`: every fact on its own line in id order, then the people (with the lenses each speaks for) and the open asks. It is the same text for all five lenses in a round, so it caches well. The wrapper comes after it, with three slots:

- `{{persona}}` takes the persona file.
- `{{previous}}` takes the lens's own last report, the newest fact it had seen then (its watermark) and the ids of the facts that arrived since. A lens that has never reported is told everything is new.
- `{{topics}}` takes the fixed list of fact topics.

A lens never addresses a person. It writes only for the coach, which is the one agent people talk to. It does not repeat a conflict or question from its last report unless a fact that arrived since changes it, but always gives coverage in full.

## What every persona harness sends back

```json
{
  "coverage": [
    { "topic": "one of the persona's topics", "agency": "settled | thin | missing", "client": "settled | thin | missing" }
  ],
  "conflicts": [
    {
      "topic": "",
      "agency_said": "their words (f3)",
      "client_said": "their words (f9)",
      "severity": "fundamental | workable | minor",
      "note": "one sentence on why it matters"
    }
  ],
  "questions": [
    { "ask": "agency | client", "find_out": "what the coach needs to learn", "because": "one sentence", "priority": 1 }
  ],
  "done": false,
  "proposed_facts": [
    { "topic": "budget", "statement": "Estimate: app store fees add a yearly cost.", "based_on": ["f1", "f9"] }
  ]
}
```

- **settled** means a stranger could read the answer and know what was meant. **thin** means it was touched but is vague, or uses a word the other side might read differently. **missing** means nobody has said it.
- **fundamental** means the project should not start until it is sorted (the two sides want different things, or one cannot give what the other needs). **workable** means a trade-off will fix it. **minor** means it only needs writing down.
- **priority** is 1 for "ask this next", 2 for "soon", 3 for "when there is a gap".
- **done** is true when every topic is settled on both sides and there are no open conflicts.
- **proposed_facts** is optional, and most reports leave it empty. A lens proposes a fact only when it follows from facts in the room, which it cites in `based_on`, or when it is safe general knowledge it labels as an estimate. It may set `supersedes` only to replace an earlier lens fact, never what a person said.

## How the reports are used

After each coach turn, the Worker runs the lenses in rounds, outside the Durable Object so slow model calls never hold up the room.

1. Every round takes one snapshot of the room and runs its lenses on it in parallel. Round 1 runs all five.
2. Each run is saved with its watermark and report. A lens that errors or sends back something that isn't a report is saved as failed, and the rest of the round carries on.
3. Proposed facts go into the room as proposed lens facts. The Worker drops any that cite no fact in the room, repeat a fact that still holds, or try to replace a person's words, and keeps at most three per report.
4. If a round added a fact, the lenses that added one run again on a fresh snapshot. The others sit out. There are never more than three rounds.
5. Only one set of rounds runs per room at a time. A coach turn that lands while rounds are running makes that set go once more when it finishes.

The coach reads the room and each lens's latest report, and turns what they say into its one next ask for the person in front of it. Only the coach asks people things.
