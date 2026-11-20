# Coach evals

A small eval for the coach. Each case is a made-up room (the fixture project, varied), the latest adviser reports, one person and what they say. The real `runCoachTurn` runs with the real model, then a judge model call scores the turn against a rubric.

Run it from `workers/api`:

```sh
pnpm evals
```

It needs `ANTHROPIC_API_KEY`, read from the environment or from `workers/api/.dev.vars` (never printed). Without one it stops straight away with a clear message and exit code 2, and no scores exist. It makes real model calls (two per case), so it is not part of `pnpm test`. It prints a pass and fail table and exits non-zero when any case fails.

The judge is the same model as the coach, so treat scores as a regression signal, not proof.

## The rubric

Every case is scored on:

- **faithful:** facts match what was said, with a real quote, corrections replace the old fact, hedges stay hedges.
- **one_ask:** exactly one open ask is left for the speaker, about one thing.
- **right_person:** the ask suits their persona and side.
- **no_repeat:** nothing already answered is asked again.
- **urgent_first:** the most severe conflict the person can speak to comes first.
- **no_invention:** nothing is made up.

`-` in the table means the criterion did not apply.

## The cases

Cases live in `cases.ts`.

- **answers-open-ask:** Casey answers the open question about what "voice" means. Fact recorded, ask closed, not asked again.
- **corrects-own-fact:** Robin changes his budget figure. The new fact replaces the old one.
- **hedged-answer:** Pat hedges about IP. Facts stay tentative and nothing firm is added.
- **no-facts-to-take:** Casey says thanks and asks what is next. No facts, one ask.
- **urgent-conflict-first:** two fundamental conflicts and a minor one bait. Alex, an agency lead, is asked about a fundamental one.
- **right-person-for-persona:** Dana, a delivery lead, answers about hosting. Her ask must be a delivery question, not a client one.
- **no-repeat-of-answered-ask:** Robin was already asked about hosting. The coach must not ask it again.
- **confirms-lens-proposal:** Robin agrees with a lens proposed fact. The confirmation is recorded and the next ask moves on.
- **asks-what-aline-is:** Casey asks what Aline is and what to do. A short, accurate answer with no internals, no facts recorded, then exactly one ask.
- **asks-how-questions-are-chosen:** Alex asks how it picks questions and who is behind them. No advisers, lenses, prompts, models or scores mentioned, and one ask.
