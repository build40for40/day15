# Day 15

A 40 for 40 app: Expectation Manager, which helps an agency and a client find the holes in a project before the budget is spent. Everyone on the project talks to one coach from their own AI client (Claude, ChatGPT) through an MCP server, and the agency sets projects up on a small web page. Built with Vue 3, TypeScript and Vite, and served by a Cloudflare Worker. It's a pnpm workspace: the app is in `apps/web/`, the Worker in `workers/api/`, and the schemas they share in `packages/shared/`.

## Today: Day 15

Special guest day. Agency plans are full of holes at the start, and the blind spots turn up once the money has gone. An agency and a client have about a week after the pitch to agree brief, scope and budget. This gives each person their own coach that keeps asking the one question that matters most right now, while five behind-the-scenes lenses (money, delivery, agency, client and procurement) look for where the two sides have read the same words differently.

How it fits together:

1. **The agency signs in** and creates a project, then adds the people on both sides.
2. **Each person gets their own MCP address** to add to their AI client.
3. **They talk to the coach.** It notes facts from what they say, closes what they've answered and asks one next thing.
4. **The lenses read the whole room** after every turn and tell the coach what's missing or in conflict.

In place: the coach, the five lenses, the MCP tools (`open_room`, `tell_coach`, `read_room`) and the agency setup page. Parked: privacy tiers, OAuth for invited people, file upload, voice and output documents.

## Develop

```sh
pnpm install
cp workers/api/.dev.vars.example workers/api/.dev.vars   # then add your ANTHROPIC_API_KEY
pnpm dev    # Vite and the Worker together, at http://localhost:5173/
```

## Check

```sh
pnpm typecheck
pnpm test    # unit tests, colocated as *.test.ts
pnpm build   # type-check and production build
```

## Deploy

Lives at https://day15.build40for40.com/, and the old https://build40for40.com/day15/ redirects there. Merging to `main` deploys it, and every pull request gets a public preview link in a comment.
