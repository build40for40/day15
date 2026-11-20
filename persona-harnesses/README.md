# Persona harnesses

Three persona harnesses feed the coach, which is the brain the persona files mention. Each one reads everything both sides have told the coach so far and reports back, through its own lens, what is settled, what is missing and where the two sides are heading for a row. The coach reads all three reports and decides what it asks next, following [`coach.md`](coach.md).

Neither the agency nor the client ever sees a persona, its name or its report. They only ever meet one warm coach.

| File | Persona | Protects |
| --- | --- | --- |
| `personas/client.md` | Client | The reason the project exists, and who it is for |
| `personas/agency.md` | Agency | The team's ability to do good work |
| `personas/procurement.md` | Procurement | That it can be built, is paid for and is written down. Covers the milestone items for scope, budget, onboarding and the contract |

`personas/cfo.md` and `personas/delivery.md` are no longer loaded: the procurement persona carries money and delivery now. They stay until Samira removes them.

## The mother agent

[`mother-agent.md`](mother-agent.md) is Samira's AIM for the one voice people talk to. The Worker loads it together with `coach.md`, and the two split the job:

- **The mother agent is how the coach thinks and speaks:** who it is and its limits as a mediator, its four phases and four tools, the signals it listens for from the project stories, its priority matrix and ratings, how it chooses and words the next ask, and when it explains something before asking.
- **`coach.md` is how the coach keeps the room:** taking facts from what a person says, corrections, confirmations and closing asks.

Where the two differ on what to ask, how to word it or how open to be about what the other side said, the mother agent wins. Where they differ on recording facts, `coach.md` wins. That rule is written once, in `workers/api/src/coach/prompt.ts`.

Three things come out of it:

- **An explanation before the question,** when the coach is educating. It is read once in the reply and is not stored with the ask.
- **The priority matrix:** the seven areas stand high, medium, low, aligned or unknown, worked out in code from the open questions (see "The matrix and health, worked out" below), not rated by the coach. The areas and weights live in `packages/shared/src/alignment.ts`.
- **The health reading,** worked out from that rollup, and absent until both sides have said something.

The coach sees both each turn. No tool, lens or page shows them to people. `mother-agent.md` still asks the coach to rate the areas itself, so the preamble in `prompt.ts` tells it they are worked out for it.

**Openness:** the mother agent's default is transparency, which fits a room shared with both sides by default: the coach may say what the other side said, fairly and in neutral words. What a person asks to keep private, the coach marks private, and it stays on their side (see "Private facts" below).

The file follows Samira's "A-line: Mother, agent instructions (draft v1)" card on Superthread: who Mother is, mediator not adviser, the four phases (interrogate, sort, find the cause, escalate), the four tools, tone of voice and what she produces.

[`milestones-reference.md`](milestones-reference.md) is the list the mother agent works through: 134 items across ten artifacts and nine milestones, with who answers each and which 56 are core. It comes from the "Milestones" page on Superthread and is loaded as reference beside `coach-reference.md`. It is a list for the coach to read: nothing in the room tracks an item's or a milestone's state yet.

## Who owns what

- **The files in `personas/` and `mother-agent.md`** are Samira's. Each is one persona's Actor, Instructions and Mission, and nothing else. Changes to who a persona is, what it covers or what it asks go there.
- **`wrapper.md` and everything in this README below the AIM section** are Ben's: the shared wrapper, the report format and how the coach uses the reports. So are `coach.md` and `coach-reference.md`, the coach's own harness. It may change to fit the architecture without the persona files needing to.

## AIM: Actor, Instructions, Mission

Every persona harness is written in the same three parts.

- **Actor:** who the persona is and what it protects.
- **Instructions:** the topics it must see settled, its red flags, the one thing it never lets slide, and what to find out from each side.
- **Mission:** the one thing it has to tell the brain, and how it knows it is done.

The shared wrapper below follows the same shape.

## The shared wrapper

Every persona harness runs as a lens inside the same wrapper, [`wrapper.md`](wrapper.md), which the Worker loads as it is (`workers/api/src/lenses/`).

Each lens call is one prompt in two parts. The whole data room comes first, rendered by `renderRoom` in `workers/api/src/room/render.ts`: every fact on its own line in id order, then the people (with the lenses each speaks for) and the open asks. It is the same text for all three lenses in a round, so it caches well. The wrapper comes after it, with three slots:

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
      "priority": 1,
      "note": "one sentence on why it matters",
      "area": "one of the seven alignment areas",
      "same_as": "q7, only when this updates one of your open questions",
      "rests_on_private": false
    }
  ],
  "questions": [
    {
      "ask": "agency | client",
      "find_out": "what the coach needs to learn",
      "because": "one sentence",
      "priority": 1,
      "topic": "one of the persona's topics",
      "area": "one of the seven alignment areas",
      "same_as": "q8, only when this updates one of your open questions",
      "rests_on_private": false
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
- **priority**, on every conflict and question, is the one scale, defined once in `packages/shared/src/priorities.ts` and always shown with its label. High (1): the two sides want different things, or one cannot give what the other needs, and the project should not start until it is sorted. Medium (2): they differ, but a trade-off or a decision would fix it. Low (3): they agree in substance and it only needs writing down, or one detail is loose. These are the meanings the mother agent gives her ratings. The old words fundamental, workable and minor are read as 1, 2 and 3 wherever they turn up, including in reports stored before this scale, and only the number is stored.
- **rests_on_private** is optional: true when a conflict or question rests on a private fact, which the lens then leaves out of its wording.
- **done** is true when every topic is settled on both sides and there are no open conflicts.
- **area** is optional: one of the seven areas of the mother agent's priority matrix (`packages/shared/src/alignment.ts`), which the wrapper lists. When a lens leaves it out, the Worker takes the area most of the cited facts' topics map to (`TOPIC_AREA` in `packages/shared/src/areas.ts`), else the lens's usual area. Dependencies and ownership has no topic of its own, so only a lens that says so puts a question there.
- **same_as**, **topic** and **resolved** are optional. `same_as` names the lens's own open question that a conflict or question updates, and `resolved` lists the ones the room now settles. A report that says `done` resolves all of that lens's open questions.
- **proposed_facts** is optional, and most reports leave it empty. A lens proposes a fact only when it follows from facts in the room, which it cites in `based_on`, or when it is safe general knowledge it labels as an estimate. It may set `supersedes` only to replace an earlier lens fact, never what a person said.

## How the reports are used

After each coach turn, the coach's reply goes back to the person at once, and the project's room sets its alarm. The lenses run from that alarm, inside the room but outside any storage write, so the room keeps answering while they think.

1. Every round takes one snapshot of the room and runs all three lenses on it in parallel.
2. Each run is saved with its watermark and report as soon as that lens answers. A lens that errors, sends back something that isn't a report, or takes longer than its timeout is aborted and saved as failed, and the rest of the round carries on.
3. Saving a report turns its conflicts and questions into open questions (below), and keeps the report as it came for the record.
4. Proposed facts go into the room as proposed lens facts. The Worker drops any that cite no fact in the room, repeat a fact that still holds, or try to replace a person's words, and keeps at most three per report.
5. If a round added a fact, all three lenses run again on a fresh snapshot. There are never more than three rounds.
6. Only one set of rounds runs per room at a time. However many coach turns land while a set is running, exactly one more set runs after it, on the newer room.

### Open questions

Every conflict and question a lens raises becomes a row in the room's open questions, with an id like `q7`, and stays open until it is resolved, whichever report it came from.

- Each open question has the priority its lens gave it, and takes the new one whenever the lens updates it. The coach may move any open question to another level, resolve one, or raise one of its own when it hears a signal no lens has raised (a gap with no lens, routed like any other).
- A conflict or question updates the lens's own open question it names in `same_as`, or one it already has for the same thing, and is added as a new row otherwise.
- A lens resolves its own open questions with `resolved`, or all of them by saying it is done. The coach resolves one when a person's answer settles it.

The coach works down the open questions for the person in front of it, most urgent first (by priority, then the area's rank in the matrix, then conflicts before gaps, then oldest), from the lenses that person speaks for and the ones nobody on their side speaks for, and turns the first that fits into its one next ask. Only the coach asks people things.

### The matrix and health, worked out

The mother agent's area matrix is a rollup of the open questions, not a second judgement. An area stands at the priority of its most urgent open question. With nothing open it is aligned when both sides have said something in it, and unknown when one side or both has not. The health reading comes from that rollup with the weights and rules in `packages/shared/src/alignment.ts`, counting unknown as low, and there is none until both sides have said something. Facts keep their topic, what a statement is about. Questions are filed by area, what needs aligning. `TOPIC_AREA` is the only bridge between the two.

### Private facts

What a person tells the coach is shared with both sides by default. When they ask for something to be kept private, the coach marks those facts private: only that person's side, the coach and the lenses see them. A lens never puts a private fact's content in its wording, and flags anything resting on one with `rests_on_private`. People see the room through one side view that leaves out the other side's private facts, any lens fact resting on one, and the wording of any open question resting on one.

### Lens ids from before there were three

Rooms made before the three lenses still hold the ids `cfo` and `cto` in a person's lenses, in lens runs, in open questions and in asks. They are read as `procurement` wherever they are read (`currentLens` in `packages/shared/src/lenses.ts`), and lists are folded so each lens appears once. Stored rows are never rewritten. People keep their five seats: the procurement, CFO and delivery lead seats all default to the procurement lens.
