# Day 15

Day 15 of 40 for 40, built live on Twitch on Friday 20 November 2026. It's the special guest day, so the problem comes from the guest rather than the pool. The pick is "Expectation Manager". Work is tracked on the Superthread `day15` board and the "Day 15" page.

- **Form factor:** a web app, started from the kit's `web-app` template. It's at `build40for40.com/day15/` until the app has a name.
- **Name:** the app doesn't have one yet, so the repo is `day15` until it does. Once it's named, anything web-facing is served at `build40for40.com/<app>/`.

Shared 40 for 40 context lives in `../AGENTS.md`.

## Stack

- Vue 3 with `<script setup lang="ts">`, built with Vite.
- Vitest with jsdom and `@vue/test-utils`. Unit tests sit next to their source as `*.test.ts`. Tests for Worker code start with `// @vitest-environment node`.
- `@/` resolves to `src/`.
- The Worker in `worker/` serves the API under `/day15/api/*`. Everything else under `/day15/` is a static file from `dist/day15/`.
- Claude goes through the Vercel AI SDK (`ai` and `@ai-sdk/anthropic`, model `claude-sonnet-5-5`). `POST /day15/api/projects/<id>/coach` streams the coach's next question as structured output with `streamText` and `Output.object`, and the page reads it with `useObject` from `@ai-sdk/vue`. The zod schemas both sides share live in `src/coach/schema.ts`. Without an `ANTHROPIC_API_KEY` the endpoint answers 503.
- **Projects:** `POST /day15/api/projects` makes one and returns its id. Each side opens its own link, `?p=<id>&as=agency` or `?p=<id>&as=client`. `GET /day15/api/projects/<id>/<party>` returns that side's own description and turns, and only whether the other side has started.
- **Storage:** one `ProjectRoom` Durable Object per project (`worker/project-room.ts`, bound as `ROOMS`) holds what both sides have said. The logic is plain functions in `worker/room.ts` so tests run in Node. One side's words never go to the other side's browser.
- **The brain:** `worker/prompt.ts` builds the instructions from the five personas in `worker/personas.ts`, everything captured from both sides, and which hats each side has had. The model picks the hat and returns it as `lens` with the question. The page keeps `lens` on the turn and never shows it.
- Pass `onError` to every `streamText` and log only the error name: the default handler logs the whole request, which holds what the user typed.
- In the browser, build API URLs from `import.meta.env.BASE_URL` (`${import.meta.env.BASE_URL}api/...`), never a hard-coded `/api`.

## Commands

- `npm run dev`: Vite on port 5173 plus `wrangler dev` on 8787, with Vite proxying `/day15/api` to the Worker. Open http://localhost:5173/day15/. Copy `.dev.vars.example` to `.dev.vars` and add an `ANTHROPIC_API_KEY` first.
- `npm run fake`: Vite only, with `dev/fake-api.ts` standing in for the Worker, so the page clicks through with no key. Answers are canned, and production builds leave it out.
- `npm test`: unit tests.
- `npm run build`: type-check with `vue-tsc`, then build to `dist/day15/`.
- `npm run deploy`: build, then deploy to production as the `40for40` wrangler profile. CI does this on every push to `main`, so it's only needed by hand before CI has its token.
- Run wrangler as `npm run wrangler -- <args>`, never `npx wrangler`.

## Hosting

- A Cloudflare Worker named `day15` serves `dist/` as static assets on the `build40for40.com/day15` and `build40for40.com/day15/*` routes. Those routes run before the site's Worker, which owns the rest of the domain.
- Vite builds with `base: '/day15/'` into `dist/day15/`, so the asset paths match the URL path. `run_worker_first` sends only `/day15/api/*` to the Worker code.
- CI (`.github/workflows/ci.yml`) tests and builds every push and PR. Pushes to `main` deploy to production. PRs upload a preview version and comment its public `workers.dev` link, which is named after the branch.
- Deploys need the `CLOUDFLARE_API_TOKEN` secret on the repo. Without it CI still tests and builds, and skips deploying.
- The Worker needs the `ANTHROPIC_API_KEY` Cloudflare secret, set once with `npm run wrangler -- secret put ANTHROPIC_API_KEY`. Every Worker secret is listed, with an empty value, in `.dev.vars.example`. `ANTHROPIC_WORKSPACE_ID` is optional: set it only when the key isn't scoped to a workspace, and the Worker sends it as the `anthropic-workspace-id` header.

## The problem

Expectation Manager

From the "Day 15 - ideation" notes. It was picked from five ideas pitched by the guest.

- It responds to agency commissioning problems: early plans are "full of holes", and blind spots appear after the budget is spent.
- It coaches both sides, in a soft, friendly, mediated way, to interrogate good and bad outcomes upfront, such as must-have, nice-to-have and stretch goals.
- It has discrete conversations with each side, identifies conflicts and misalignments, workshops them, and escalates if they are fundamental.
- Comparators: relationships (kids as a deal breaker) and business deal breakers such as not paying the team.
- An existing company does this for co-founder relationships, using data on why startups break down for pre-mortems. Dating apps are also trying this early.
- It was described as a huge problem for every category, not just agencies.
- Data: it could start without data and build it through two- or three-sided interrogation. Government and public project data (NASA, pre-mortems) could be a source. There's a cold-start and chicken-and-egg risk.

**Open questions**

- Generic or specific (agency-focused, for example). The group tends to do better when specific.
- Possible legal ratification.
- Learn from mediation structure (12 steps, for example) or let the system set its own rules.

## Decided

- **A coach with lenses.** One coach talks to both parties. It works through different lenses, and each lens teases out its own questions. The answers from both sides build the project truth.
- **Five lenses:** money (CFO), delivery (CTO), agency, client and procurement. Legal and compliance sit under procurement.
- **One voice.** The lenses are hats on one warm coach, not five characters.
- **The brain picks the lens,** from what has already been captured from both parties. The person never knows which lens is on.

## From the brief and plan

A summary of the team's planning call, from the Superthread "Day 15 - plan & brief" page. That page is the source. Nothing here is decided unless it says so, and there is no MVP yet.

### The 5 W's so far

- **Who:** agency.
- **Why:** blind spots.
- **When:** pitch won.
- **Where, what, how:** still blank.

### Scope and purpose

- It sits at project initiation and scoping, after the pitch. The client picks a route, then budget and scope are negotiated.
- Likely individual connections rather than a room. Discreet conversations take the sting out of difficult topics while the overall impact is managed.
- The aim is not a straitjacket but space in the project. Pre-empting problems builds confidence and a spirit of partnership.
- It is also about better, more informed decisions, not only softening difficult conversations.
- Likely users: both agency and client. Finance cares about the risk of projects going wrong. The idea could extend to any studio or firm commissioning work against a fixed scope (labour and materials).

### Process ideas

- Get everything on the table: probing questions that surface missing items, since most people miss a lot.
- Sort items into categories, then check for conflict, misalignment and alignment, report back, and work through reframing or conflict resolution pre-emptively.
- Role-play lenses (marketing, compliance, finance, legal) to find unknown unknowns. Agents with specific lenses could "hash it out" (the chair prompt).
- Account for how communication is received (direct feedback or softer).
- Agree principles for disagreement, since unknowns can't all be found: a stop word ("pineapple"), an "emergency chair", and protocols for budget or creative misalignment.
- Anchor on ambition and what success or "done" looks like, and revisit the North Star.
- Include learning, since misalignment often comes from not understanding jargon ("voice agent", for example). Provide a safe way to ask and educate on cost, complexity and market.
- Trade-offs: optional feature lists, where fitting 10 things into the budget means losing some. Watch for scope creep and contingency (20%, for example).
- Idea: voice notes while falling asleep elicit candid answers (from a previous show).

### Project truth, the output

- Described as a canonical "project truth" or source of truth, about the spirit and expectations rather than scope details. Contracts and procurement documents emerge from it.
- It could be a Word document or a set of about 10 axioms, with a hierarchy of decisions (integrity against creative output, for example).
- It should stay adaptable and be refreshed at milestones. "Be clear on the goal, be loose on how you get there."
- Updating it could propagate across an agentic architecture.
- Possibly separate the initial agreement from an ongoing-conversation system, starting with simple, clean one-pass projects.
- A structured document that starts unpopulated, like a table of contents. Items turn green when both sides agree, and amber when signed off by one side. New sections can grow, with a sense of progress.
- A comment-style interaction, like intelligent Google Docs comments that translate between sides, and a "discuss" option alongside approve.
- Different output templates for legal, procurement and client.

### Real-world constraints

- Agency work runs in campaigns and OKR cycles, with tangible "done" criteria and tight timelines. Clients have little time to agree things (days, not weeks), and handoffs create friction.
- Procurement is a barrier for both client and agency. The history and context could be served to stakeholders, through links or a podcast-style explanation.
- Client briefing could be improved with an AI question-asker that finds missing questions. Clients could drop in links and folders, or a voice note. Also noted: understand the client's personal goals.
- Unresolved: whether sensitive information raises privacy concerns (a bespoke sandbox may suit enterprise), and whether to build agency and client entry points or only the client side.
- Whether AI makes a visible document necessary: it may serve as a conceptual anchor, with a backend "brain" structure. A "headless" version has no human. Alternatively a persona such as a grandma or an Irish voice, with a playful voice-agent demo.

### MVP

None yet. A simple one that came up: copy an agency brief template (brand challenge, communication objective, market and brand context, customer insight, goal clarity) that both sides agree, with new subheadings inferred as comments are made.

### Initial units of work

Each has a card on the `day15` board.

- User stories (agency and clients).
- Lenses (CFO, CTO, agency, clients, procurement).
- Project truth: the final output brief.
- Data gathering: onboarding, input templates, example projects.
