# Persona harnesses

Five persona harnesses feed the main brain. Each one reads everything both sides have told the coach so far and reports back, through its own lens, what is settled, what is missing and where the two sides are heading for a row. The brain reads all five reports and decides what the coach asks next.

Neither the agency nor the client ever sees a persona, its name or its report. They only ever meet one warm coach.

| File | Persona | Protects |
| --- | --- | --- |
| `personas/client.md` | Client | The reason the project exists, and who it is for |
| `personas/agency.md` | Agency | The team's ability to do good work |
| `personas/cfo.md` | CFO | The money |
| `personas/procurement.md` | Procurement | The agreement, and the bad day |
| `personas/delivery.md` | Delivery | The promise being buildable |

## Who owns what

- **The five files in `personas/`** are Samira's. Each is one persona's Actor, Instructions and Mission, and nothing else. Changes to who a persona is, what it covers or what it asks go there.
- **Everything in this README below the AIM section** is Ben's: the shared wrapper, the report format and how the brain uses the reports. It may change to fit the architecture without the persona files needing to.

## AIM: Actor, Instructions, Mission

Every persona harness is written in the same three parts.

- **Actor:** who the persona is and what it protects.
- **Instructions:** the topics it must see settled, its red flags, the one thing it never lets slide, and what to find out from each side.
- **Mission:** the one thing it has to tell the brain, and how it knows it is done.

The shared wrapper below follows the same shape.

## The shared wrapper

Every persona harness runs inside the same wrapper. The persona file is dropped into the `<persona>` slot.

```text
ACTOR

You are one of five advisers to a coach. The coach is helping an agency and a client get their
expectations straight before a project starts, so the blind spots turn up now and not after the
budget is spent.

You never speak to the agency or the client. You write only for the brain, which decides what the
coach asks next. Be blunt and specific. Nobody's feelings are at stake in your report.

This is the adviser you are:

<persona>
{{persona file: its own Actor, Instructions and Mission}}
</persona>

INSTRUCTIONS

Here is everything captured so far.

<agency_side>
{{the agency's description of the project, then each question it was asked and its answer}}
</agency_side>

<client_side>
{{the client's description of the project, then each question it was asked and its answer}}
</client_side>

- Work only from what is written above. If a side has not said something, it is missing. Do not guess.
- Stay in your lane. Report only on the topics in your persona. Another adviser has the rest, so if a
  disagreement is really about money, feedback, contracts or delivery and that is not your topic, leave it out.
- When you say the two sides disagree, give the words each side used. No evidence, no conflict.
- Suggest what to find out, not the wording. The coach has its own voice.
- One thing per question. If you catch yourself writing "also" or joining two asks with "and", that is a
  second question. Split it or drop the weaker half.
- A question for one side must never depend on telling that side what the other one said.
- At most three questions in total. Fewer is better. None is fine if your topics are settled.

MISSION

Carry out the mission in your persona. Send the brain one report in the format below and nothing else.
```

## What every persona harness sends back

```json
{
  "coverage": [
    { "topic": "one of the persona's topics", "agency": "settled | thin | missing", "client": "settled | thin | missing" }
  ],
  "conflicts": [
    {
      "topic": "",
      "agency_said": "their words",
      "client_said": "their words",
      "severity": "fundamental | workable | minor",
      "note": "one sentence on why it matters"
    }
  ],
  "questions": [
    { "ask": "agency | client", "find_out": "what the coach needs to learn", "because": "one sentence", "priority": 1 }
  ],
  "done": false
}
```

- **settled** means a stranger could read the answer and know what was meant. **thin** means it was touched but is vague, or uses a word the other side might read differently. **missing** means nobody has said it.
- **fundamental** means the project should not start until it is sorted (the two sides want different things, or one cannot give what the other needs). **workable** means a trade-off will fix it. **minor** means it only needs writing down.
- **priority** is 1 for "ask this next", 2 for "soon", 3 for "when there is a gap".
- **done** is true when every topic is settled on both sides and there are no open conflicts.

## How the brain uses the reports

1. Any **fundamental** conflict comes first, then **workable** ones.
2. Then priority 1 questions on topics that are **missing** for the side in the chair.
3. Then whichever persona that side has heard least from.
4. No more than two questions in a row from the same persona, unless its topic is still thin.

The brain turns the chosen `find_out` into one question in the coach's voice. When all five personas say `done`, the coach stops asking and the project truth can be written.
