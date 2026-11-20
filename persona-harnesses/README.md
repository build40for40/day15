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
- **`wrapper.md` and everything in this README below the AIM section** are Ben's: the shared wrapper, the report format and how the brain uses the reports. It may change to fit the architecture without the persona files needing to.

## AIM: Actor, Instructions, Mission

Every persona harness is written in the same three parts.

- **Actor:** who the persona is and what it protects.
- **Instructions:** the topics it must see settled, its red flags, the one thing it never lets slide, and what to find out from each side.
- **Mission:** the one thing it has to tell the brain, and how it knows it is done.

The shared wrapper below follows the same shape.

## The shared wrapper

Every persona harness runs inside the same wrapper.

The wrapper itself is [`wrapper.md`](wrapper.md), which the Worker loads as it is. It has three slots: `{{persona}}` takes a persona file, and `{{agency_side}}` and `{{client_side}}` take each side's description of the project followed by every question it was asked and its answer.


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
