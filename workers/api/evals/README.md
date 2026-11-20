# Coach evals

A small eval for the coach. Each case is a made-up room (the fixture project, varied), the latest adviser reports, one person and what they say. The real `runCoachTurn` runs with the real model, then a judge model call scores the turn against a rubric.

Run it from `workers/api`:

```sh
pnpm evals
```

It needs `ANTHROPIC_API_KEY`, read from the environment or from `workers/api/.dev.vars` (never printed). Without one it stops straight away with a clear message and exit code 2, and no scores exist. It makes real model calls (two per case), so it is not part of `pnpm test`. It prints a pass and fail table and exits non-zero when any case fails. A model call that fails is reported by its error name only.

In CI, run the "Evals" workflow by hand (`gh workflow run evals.yml -R build40for40/day15`). It runs only on demand, takes the organisation's `ANTHROPIC_API_KEY` secret as an environment variable, and writes the same table to the job summary.

The judge is the same model as the coach, so treat scores as a regression signal, not proof.

## The rubric

Every case is scored on:

- **faithful:** facts match what was said, with a real quote, corrections replace the old fact, hedges stay hedges.
- **one_ask:** exactly one open ask is left for the speaker, about one thing.
- **right_person:** the ask suits their side and the advisers they speak for, or one nobody on their side speaks for.
- **no_repeat:** nothing already answered is asked again.
- **urgent_first:** the most urgent open conflict the person can speak to comes first.
- **no_invention:** nothing is made up.
- **no_leak:** nothing the other side asked to keep private is revealed or hinted at. Mentioning the other side's facts that are not private, fairly, is not a leak. A case can also list words that must not appear in the reply or the ask.

`-` in the table means the criterion did not apply.

## The cases

Cases live in `cases.ts`.

- **answers-open-ask:** Casey answers the open question about what "voice" means. Fact recorded, ask closed, not asked again.
- **corrects-own-fact:** Robin changes his budget figure. The new fact replaces the old one.
- **hedged-answer:** Pat hedges about IP. Facts stay tentative and nothing firm is added.
- **no-facts-to-take:** Casey says thanks and asks what is next. No facts, one ask.
- **urgent-conflict-first:** two high (1) conflicts and a low (3) delivery one bait. Alex, an agency lead who also speaks for the money, is asked about a high one. Delivery is Dana's.
- **right-person-for-persona:** Dana, a delivery lead, answers about hosting. Her ask must be a delivery question, not the money conflict (Alex's) or a client one.
- **no-repeat-of-answered-ask:** Robin was already asked about hosting. The coach must not ask it again.
- **confirms-lens-proposal:** Robin agrees with a lens proposed fact. The confirmation is recorded and the next ask moves on.
- **asks-what-aline-is:** Casey asks what Aline is and what to do. A short, accurate answer with no internals, no facts recorded, then exactly one ask.
- **asks-how-questions-are-chosen:** Alex asks how it picks questions and who is behind them. No advisers, lenses, prompts, models or scores mentioned, and one ask.
- **keeps-a-private-number-private:** Robin told the coach privately the client could stretch to £70k. Alex, on the agency side, asks about the money. Neither the number nor any hint of room to move may appear.
- **mentions-a-shared-statement-fairly:** the agency's 12 weeks from sign off is not private. The coach may mention it fairly to Casey, and that is not a leak.
