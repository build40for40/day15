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

## Drafts that are not wired in yet

Two of Samira's files sit here for review. Nothing loads them, so they change nothing about how the app behaves.

- [`mother-agent.md`](mother-agent.md): her AIM for the one voice people talk to, which is the role `coach.md` plays today. It adds the signals from the project stories, a priority matrix with High, Medium and Low ratings and an overall health reading, and a way to explain an issue to one side discreetly. It assumes each side's conversation is private, which the shared room does not do today.
- [`personas/delivery-procurement-finance.md`](personas/delivery-procurement-finance.md): one persona covering what `cfo.md`, `delivery.md` and `procurement.md` cover between them, for a version with three lenses and not five.

Whether to move to three lenses, and how much of the mother agent goes into `coach.md`, is still to be decided between Samira and Ben.

## Who owns what

- **The five files in `personas/`** are Samira's. Each is one persona's Actor, Instructions and Mission, and nothing else. Changes to who a persona is, what it covers or what it asks go there.
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
- `{{previous}}` takes the lens's own last report without its conflicts and questions, the newest fact it had seen then (its watermark) and the ids of the facts that arrived since. A lens that has never reported is told everything is new.
- `{{open_questions}}` takes the lens's own open questions, each with its id (`q7`).
- `{{topics}}` takes the fixed list of fact topics.

A lens never addresses a person. It writes only for the coach, which is the one agent people talk to. It does not repeat one of its open questions: it names the one a changed conflict or question updates with `same_as`, and resolves the ones the room now settles with `resolved`. It always gives coverage in full.

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
      "note": "one sentence on why it matters",
      "same_as": "q7, only when this updates one of your open questions"
    }
  ],
  "questions": [
    {
      "ask": "agency | client",
      "find_out": "what the coach needs to learn",
      "because": "one sentence",
      "priority": 1,
      "topic": "one of the persona's topics",
      "same_as": "q8, only when this updates one of your open questions"
    }
  ],
  "resolved": ["q3"],
  "done": false,
  "proposed_facts": [
    { "topic": "budget", "statement": "Estimate: app store fees add a yearly cost.", "based_on": ["f1", "f9"] }
  ]
}
```

- **settled** means a stranger could read the answer and know what was meant. **thin** means it was touched but is vague, or uses a word the other side might read differently. **missing** means nobody has said it.
- **fundamental** means the project should not start until it is sorted (the two sides want different things, or one cannot give what the other needs). **workable** means a trade-off will fix it. **minor** means it only needs writing down.
- **priority** is a number with a label: high (1) for "ask this next", medium (2) for "soon", low (3) for "when there is a gap". Give the number.
- **done** is true when every topic is settled on both sides and there are no open conflicts.
- **same_as**, **topic** and **resolved** are optional. `same_as` names the lens's own open question that a conflict or question updates, and `resolved` lists the ones the room now settles. A report that says `done` resolves all of that lens's open questions.
- **proposed_facts** is optional, and most reports leave it empty. A lens proposes a fact only when it follows from facts in the room, which it cites in `based_on`, or when it is safe general knowledge it labels as an estimate. It may set `supersedes` only to replace an earlier lens fact, never what a person said.

## How the reports are used

After each coach turn, the coach's reply goes back to the person at once, and the project's room sets its alarm. The lenses run from that alarm, inside the room but outside any storage write, so the room keeps answering while they think.

1. Every round takes one snapshot of the room and runs all five lenses on it in parallel.
2. Each run is saved with its watermark and report as soon as that lens answers. A lens that errors, sends back something that isn't a report, or takes longer than its timeout is aborted and saved as failed, and the rest of the round carries on.
3. Saving a report turns its conflicts and questions into open questions (below), and keeps the report as it came for the record.
4. Proposed facts go into the room as proposed lens facts. The Worker drops any that cite no fact in the room, repeat a fact that still holds, or try to replace a person's words, and keeps at most three per report.
5. If a round added a fact, all five lenses run again on a fresh snapshot. There are never more than three rounds.
6. Only one set of rounds runs per room at a time. However many coach turns land while a set is running, exactly one more set runs after it, on the newer room.

### Open questions

Every conflict and question a lens raises becomes a row in the room's open questions, with an id like `q7`, and stays open until it is resolved, whichever report it came from.

- Priority has three levels, stored as a number and shown with its label: high (1) "ask this next", medium (2) "soon", low (3) "when there is a gap". The mapping lives in `packages/shared/src/priorities.ts`.
- A fundamental conflict starts high (1), a workable one medium (2) and a minor one low (3). A question keeps the priority its lens gave it. The coach may move any open question to another level.
- A conflict or question updates the lens's own open question it names in `same_as`, or one it already has for the same thing, and is added as a new row otherwise. An update can make a row more urgent, never less.
- A lens resolves its own open questions with `resolved`, or all of them by saying it is done. The coach resolves one when a person's answer settles it.

The coach works down the open questions for the person in front of it, most urgent first (by priority, conflicts before gaps, then oldest), from the lenses that person speaks for and the ones nobody on their side speaks for, and turns the first that fits into its one next ask. Only the coach asks people things.
