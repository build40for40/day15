# Day 15

Day 15 of 40 for 40, built live on Twitch on Friday 20 November 2026. It's the special guest day, so the problem comes from the guest rather than the pool. The pick is "Expectation Manager". Work is tracked on the Superthread `day15` board and the "Day 15" page.

- **Form factor:** an MCP server that people reach from their own AI client (Claude, ChatGPT), plus one small web page where an agency sets projects up. It lives at `a-line.build40for40.com`. The old `day15.build40for40.com` and `build40for40.com/day15` addresses redirect there.
- **Name:** the product is "A-Line", and that's what people see on the page and in their AI client. The repo, the Worker, the packages, the bindings and the Durable Object classes keep the `day15` name.

Shared 40 for 40 context lives in `../AGENTS.md`.

## How it works

An agency and a client have just agreed a pitch and have about a week to get brief, scope and budget signed off. Everyone involved talks to one coach, through their own AI client, and the coach finds the blind spots and misread jargon before work starts.

```text
person in Claude or ChatGPT
  -> MCP server at /mcp/<key>
  -> COACH: takes facts from what they said, closes asks, replies with one next ask
  -> DATA ROOM (one ProjectRoom Durable Object per project)
  -> five LENSES in parallel, on one snapshot, in the background
  -> reports back in the room, which the coach reads on its next turn
```

- **Persona:** the seat a real person fills on a project (agency lead, marketing lead, procurement, CFO, delivery lead), on a side (agency or client).
- **People:** everyone involved in a project, whether or not they can talk to the coach. Each has a name, job title, organisation, side, persona, notes (who they report to, what they sign off), and the lenses that speak for what they care about. Lenses default to the persona's own lens (`PERSONA_LENS`) but need not match it. Only people with a link can connect over MCP. The agency owner adds people on the setup page, and the coach adds people who come up in conversation, with no link.
- **Data room:** the shared memory for one project, in the ProjectRoom's built-in SQLite. No privacy tiers yet: everything is shared, but every row records who added it and their side.
- **Lens:** a headless simulation of a persona, built from the files in `persona-harnesses/`. A lens reads the whole room and writes a report (coverage, conflicts, questions, done) plus optional proposed facts. Lenses never address people.
- **Coach:** the one agent people talk to. In one turn it reads the room and the latest lens reports, takes facts from what the person just said, closes any ask they answered, adds anyone they named who isn't on the people list yet, and replies with what it noted plus one next ask for that person, sometimes with a short explanation before the ask. Only the coach asks people things.
- **Routing:** a lens's asks go to the people on the relevant side whose lenses include it. When nobody on a side who has a link speaks for a lens, its asks may go to anyone on that side, marked as nobody's, and the coach tells agency-side people about the gap rather than inventing an owner. The selection is `askCandidates` in `workers/api/src/coach/select.ts`, and the coach's prompt shows who speaks for each lens on each side.

### The room

| Table | What it holds |
| --- | --- |
| `participants` | The people list: name, job title, organisation, side, persona, lenses, notes, whether they have a link, who added them (`owner` or `coach`), when they were removed, and a SHA-256 hash of their key's secret |
| `items` | What each person said or pasted, word for word |
| `facts` | One statement each, under a topic, with its status and where it came from |
| `lens_runs` | Each lens run: lens, round, watermark (highest fact id it saw), report |
| `asks` | What the coach needs from one person, open until answered or dropped |

- People are a directory, not facts, so their details are edited in place. Removing a person sets `removed_at` and never deletes the row, since facts and asks point at it: their key stops working at once, their open asks are dropped, they leave the people list and routing, and their facts stay. A person with no link has `has_link` 0 and a placeholder in `key_hash`, which older rooms keep as NOT NULL.
- Columns added after rooms already existed are added by `migrate` in `workers/api/src/room/schema.ts`, which checks the table's columns first, so it is safe on every start and on old rooms. It runs in a transaction.
- Facts are never edited. A changed fact is a new row that supersedes the old one, and the old one reads as `superseded`. Its `statedAs` keeps the status it was written with, so its line in the room text never changes.
- Every person fact points at the item and the quote it came from. Every lens fact points at the facts it was worked out from. Person and lens facts are always told apart.
- Every fact has a topic from a client brief template: background, objective, audience, insight, kpis, budget, deliverables, timeline, sign_off, legal_ip, other.
- Models see short per-project ids: `f12` a fact, `i3` an item, `p2` a person, `a4` an ask, `r5` a lens run.
- **Loading the room into a model:** no retrieval, the whole room every time, through the one renderer in `workers/api/src/room/render.ts`. One fact per line, each readable alone, in id order. Facts only ever grow at the end, so the start of the text stays the same between calls and caches well. A fact line names its person by id and the side stored on the fact, never by editable details, so editing someone never moves it. The people list comes after the facts, one current person per line, then the open asks. Room text goes first in a prompt, agent instructions after.
- **Lens rounds:** after each coach turn, all five lenses run in parallel on one snapshot. If a round adds proposed facts, another round runs, up to 3. They run in the Worker through `ctx.waitUntil`, never inside the Durable Object, so slow model calls never block the room. A lease in the room lets one set of rounds run at a time. The runtime cuts `waitUntil` off about 30 seconds after the response, so a set of rounds gets a 25 second budget (`LENS_ROUNDS_BUDGET_MS`): a round only starts with 8 seconds left, a model call still running at the end is aborted and saved as a failed run, and each lens's run is saved as soon as it answers. The lease runs out after a minute in case the runtime kills the Worker anyway. In practice that means round 1 and sometimes round 2, so moving lens rounds to a Durable Object alarm, a Queue or a Workflow is still an open decision.

### Who can get in

- **People on a project** reach the MCP server at `/mcp/<projectId>.<secret>`. Only the hash of the secret is stored, so the address is shown once when the person is given a link (or when their key is reset). People with no link, and removed people, can't get in. Workers invocation logs and traces are off in `wrangler.jsonc`, so request URLs, and the keys in them, stay out of Workers Logs. A room only creates its tables when its project is created, so guessed project ids leave nothing stored. One function, `identify` in `workers/api/src/mcp/identify.ts`, works out who is calling, so OAuth can replace the key later without touching the tools.
- **The agency owner** signs in with WorkOS AuthKit on the web page. The Worker checks the WorkOS access token with `jose`. One `TeamDirectory` Durable Object per owner, named by their WorkOS user id, holds the team name and its project list.

### Team API

The signed-in agency API under `/api`, every route behind the WorkOS Bearer token (401 without it). Projects come back with their current people as `participants`.

| Route | Body | Answer |
| --- | --- | --- |
| `GET /api/session` | | `{ userId, team, projects }` |
| `POST /api/team` | `{ name }` | `{ team }` |
| `GET /api/projects` | | `{ projects }` |
| `POST /api/projects` | `{ name }` | `{ project }` |
| `POST /api/projects/<id>/people` | `{ name, persona, side, jobTitle?, organisation?, lenses?, notes?, link? }` | 201 `{ participant, address }`, with `address` null when `link` is false |
| `PATCH /api/projects/<id>/people/<personId>` | any of `name, persona, side, jobTitle, organisation, lenses, notes` | `{ participant }` |
| `DELETE /api/projects/<id>/people/<personId>` | | `{ participant }`, with `removedAt` set |
| `POST /api/projects/<id>/people/<personId>/address` | | `{ participant, address }`: a fresh link, or a first one for someone with none |

The address is only ever in the answer that made it.

### MCP tools

- `open_room`: who you are, where the project stands, and what the coach most needs from you.
- `tell_coach`: free text in, the coach's reply out.
- `read_room`: facts and open conflicts, by topic.

### The setup page

`apps/web/src/`, phone first: on a phone the sidebar sits above the pane.

- Signed out, `SignInScreen` offers WorkOS sign-in. Signed in with no team, `NameForm` names it.
- `ProjectWorkspace` holds the state: the projects, the current one, who is selected, and any address made this session. With no project yet it asks for one.
- `PeopleSidebar` lists the current project's people (name, job title, and whether they have a link or were only mentioned to the coach), with "Add person" at the top and a project switcher plus "New project".
- `PersonPanel` shows one person: `PersonLink` (copy the address while it's fresh, get a new link, or give them one), `PersonForm` to edit their details, and remove with a confirm step. Adding a person uses the same `PersonForm`, with lenses that follow the persona until ticked by hand.

## Worker secrets

Set each in production with `pnpm wrangler secret put <NAME>`, and locally in `workers/api/.dev.vars`. Every one is listed, empty, in `workers/api/.dev.vars.example`.

| Secret | Needed | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes, for the coach and the lenses | Without it the model-backed paths fail with `ModelUnavailableError` |
| `ANTHROPIC_WORKSPACE_ID` | Only if the key isn't scoped to a workspace | Sent as the `anthropic-workspace-id` header |
| `WORKOS_CLIENT_ID` | No | Overrides the WorkOS client the Worker picks from the request's host |

## Layout

A pnpm workspace with three packages. `pnpm-workspace.yaml` lists them, the only lockfile is the root `pnpm-lock.yaml`, and the pnpm version is pinned in the root `package.json`.

| Folder | Package | What it is |
| --- | --- | --- |
| `apps/web/` | `web` | The agency setup page: sign in, then one page with a sidebar of the project's people and a pane for the one selected |
| `workers/api/` | `api` | The Cloudflare Worker (`src/`), its `wrangler.jsonc` and `.dev.vars.example` |
| `packages/shared/` | `@day15/shared` | The zod schemas and types both sides import: `schema`, `lenses` and `refs` |

In `workers/api/src/`:

| Path | What it is |
| --- | --- |
| `index.ts` | Routes `/mcp/*` to the MCP server, `/api/*` to the team API, the old addresses to a redirect, and the rest to the static app |
| `contracts.ts` | The `Env` type and the signatures of the four entry points below |
| `room/` | The ProjectRoom Durable Object, its SQL, the renderer, the key helpers and a made-up fixture project |
| `directory/` | The TeamDirectory Durable Object |
| `coach/` | The coach: `coachTurn` and `openingBrief` |
| `lenses/` | The five lenses: `runLensRounds`, and the loader for the persona markdown |
| `mcp/` | The MCP server: `handleMcp` and `identify` |
| `team/` | The agency owner's signed-in API: `handleTeamApi` |
| `model.ts` | The one Anthropic model, its options, and the error-name-only logger |
| `testing.ts` | In-memory rooms and directories over `node:sqlite`, for tests only |

Run `pnpm install` from the root, and add a dependency with `pnpm --filter <package> add <dep>`. Never npm or yarn, and never a `package-lock.json`. A new dependency with an install script needs an entry under `allowBuilds` in `pnpm-workspace.yaml`. `@day15/shared` is consumed as TypeScript source through `workspace:*`, so it has no build step: a new file at `packages/shared/src/<name>.ts` is importable as `@day15/shared/<name>`.

## Stack

- Vue 3 with `<script setup lang="ts">`, built with Vite. `@workos-inc/authkit-js` for sign-in.
- Vitest with jsdom and `@vue/test-utils`. Unit tests sit next to their source as `*.test.ts`. Tests for Worker code start with `// @vitest-environment node`, and use `memoryRoom`, `fixtureRoom` and `memoryDirectory` from `workers/api/src/testing.ts` in place of the Durable Objects.
- In `apps/web`, `@/` resolves to `apps/web/src/`.
- The MCP server is stateless streamable HTTP, with `@modelcontextprotocol/server` and `createMcpHandler` from `agents`, the same approach as day 13 but without its OAuth provider.
- Claude goes through the Vercel AI SDK (`ai` and `@ai-sdk/anthropic`, model `claude-sonnet-5-5`), with structured output from `generateText` and `Output.object`. `workers/api/src/model.ts` builds the model. Without an `ANTHROPIC_API_KEY` it throws `ModelUnavailableError`: HTTP routes answer 503 and MCP tools a clear tool error.
- Log only the error name when a model call fails (`logModelError`): the full error holds the request, which holds what people typed.
- In the browser, build API URLs from `import.meta.env.BASE_URL` (`${import.meta.env.BASE_URL}api/...`), never a hard-coded `/api`.

## Commands

All from the repo root.

- `pnpm dev`: Vite on port 5173 plus `wrangler dev` on 8787, with Vite proxying `/api` and `/mcp` to the Worker. Open http://localhost:5173/. Copy `workers/api/.dev.vars.example` to `workers/api/.dev.vars` and add an `ANTHROPIC_API_KEY` first.
- `pnpm test`: unit tests in every package.
- `pnpm typecheck`: type-check every package (`vue-tsc` for the app, `tsc` for the Worker and the shared package).
- `pnpm build`: type-check, then build the app to `apps/web/dist/`.
- `pnpm run deploy` (not `pnpm deploy`, which is a pnpm built-in): build, then deploy to production as the `40for40` wrangler profile. CI does this on every push to `main`, so it's only needed by hand before CI has its token.
- Run wrangler as `pnpm wrangler <args>`, never `npx wrangler`. It runs in `workers/api/`, next to `wrangler.jsonc`.
- One package's script: `pnpm --filter web <script>`, `pnpm --filter api <script>`.

## Hosting

- A Cloudflare Worker named `day15` serves `a-line.build40for40.com` as a custom domain: the app at the root, the team API under `/api`, the MCP server under `/mcp`. Deploying creates the custom domain and its DNS record.
- It also keeps the `day15.build40for40.com` custom domain and the `build40for40.com/day15` and `build40for40.com/day15/*` routes, and redirects them (308) to the same path and query on `a-line.build40for40.com` (`workers/api/src/hosts.ts`). That includes `/mcp/<key>` and `/api/*`, and the redirect logs nothing, since the path can hold a person's key.
- Vite builds with `base: '/'` into `apps/web/dist/`. Static files are served with single-page-app fallback. `run_worker_first` is `true`, so every request reaches the Worker code first: that is what lets the old host redirect its static paths too.
- CI (`.github/workflows/ci.yml`) tests and builds every push and PR, through the shared `build40for40/actions` (`setup`, `deploy-worker`, `preview-worker`). Pushes to `main` deploy to production. PRs upload a preview version and comment its public `workers.dev` link, which is named after the branch.
- Deploys need the `CLOUDFLARE_API_TOKEN` secret on the repo. Without it CI still tests and builds, and skips deploying.
- The Worker needs the `ANTHROPIC_API_KEY` Cloudflare secret, set once with `pnpm wrangler secret put ANTHROPIC_API_KEY`. Every Worker secret is listed, with an empty value, in `workers/api/.dev.vars.example`. `ANTHROPIC_WORKSPACE_ID` is optional: set it only when the key isn't scoped to a workspace, and the Worker sends it as the `anthropic-workspace-id` header.
- Sign-in uses the shared WorkOS AuthKit application, picking the production client on `a-line.build40for40.com` and the staging client elsewhere, in both `apps/web/src/auth.ts` and `workers/api/src/team/auth.ts`. Each client needs `https://a-line.build40for40.com/` (and any preview origin) added as a redirect URI and origin.
- Durable Objects: `ProjectRoom` (`ROOMS`) and `TeamDirectory` (`TEAMS`), both SQLite-backed through the `v1` and `v2` migrations in `wrangler.jsonc`. There is no D1 and no R2.

## Persona harnesses

`persona-harnesses/` holds the five persona harnesses (client, agency, CFO, procurement, delivery) as plain markdown, with the shared wrapper and report format in its `README.md`. Each is written as AIM: Actor, Instructions, Mission. Samira owns the five persona files. Ben owns the shared wrapper, the report format and how they are wired in, so don't change those when asked to edit a persona. They are the lenses: the Worker bundles these files as they are (a `rules` entry in `wrangler.jsonc`, and a small plugin in `workers/api/vitest.config.ts` for tests), so editing a persona file changes what that lens does on the next deploy, with no code change. The `##` headings (Actor, Instructions, Mission) are checked by a test. Lens id `cto` is the delivery persona. The coach's harness is two files beside them: `mother-agent.md` (Samira's: how the coach thinks, chooses and words an ask, its priority matrix, and when it explains before asking) and `coach.md` (Ben's: how facts are recorded), with the background it leans on in `coach-reference.md`. `workers/api/src/coach/prompt.ts` says which wins where they differ. What the coach knows about A-Line itself (what it is, how to use it, who sees what, and what stays behind the curtain) is `about-a-line.md`, loaded last. With every turn the coach rates seven alignment areas; `packages/shared/src/alignment.ts` holds the areas and weights and works out the health reading, which is stored in the room's `meta` table, kept out of the room snapshot, and shown to nobody yet.

## Parked

Out of scope for now: privacy tiers (everything in a room is shared), OAuth for invited people, file upload, email nudges, clocks and milestones, a debate room, output documents (the project truth), voice, and any chat UI or visualisation in the web app.

## History

The first prototype was a web app with a chat UI, one coach wearing hidden hats chosen by the model, ElevenLabs voice agents and a visualisation. It has been replaced by the MCP coach over a shared data room with five headless lenses. Nothing of it is left in the code.

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

- **A coach with lenses.** One coach talks to everyone. Five lenses read the room and report to it, and the answers from both sides build the project truth.
- **Five lenses:** money (CFO), delivery (CTO), agency, client and procurement. Legal and compliance sit under procurement.
- **One voice.** People only ever meet the coach. Lenses never address people, and the person never knows which lens a question came from.
- **Everything through MCP.** People talk to the coach from their own AI client. No chat UI, no voice agent and no visualisation in the web app, which only sets projects up.
- **Keys in the address for now.** Only the agency signs in. Everyone else gets a personal MCP address, and the identity check sits in one function so OAuth can replace it later.

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
