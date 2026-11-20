# Day 15

A 40 for 40 app: Expectation Manager, which helps an agency and a client find the holes in a project before the budget is spent. Built with Vue 3, TypeScript and Vite, and served by a Cloudflare Worker. It's a pnpm workspace: the app is in `apps/web/`, the Worker in `workers/api/`, and the schemas they share in `packages/shared/`.

## Today: Day 15

Special guest day. Agency plans are full of holes at the start, and the blind spots turn up once the money has gone. This talks to each side on its own, finds where they disagree, and helps them sort it out early.

What's here so far:

1. **Start a project and pick your side.** Agency or client. You get a link to send to the other side.
2. **Describe the project.** A few sentences in your own words.
3. **Answer the coach.** It asks one question at a time. Behind the scenes it picks an angle (money, delivery, agency, client or procurement) from what both sides have said so far, and never tells you which.

Not built yet: spotting where the two sides disagree, and the project truth document.

## Develop

```sh
pnpm install
cp workers/api/.dev.vars.example workers/api/.dev.vars   # then add your ANTHROPIC_API_KEY
pnpm dev    # Vite and the Worker API together, at http://localhost:5173/day15/
pnpm fake   # or the page with a fake API, no key needed
```

## Check

```sh
pnpm test    # unit tests, colocated as *.test.ts
pnpm build   # type-check and production build
```

## Deploy

Live at https://build40for40.com/day15/. Merging to `main` deploys it, and every pull request gets a public preview link in a comment.
