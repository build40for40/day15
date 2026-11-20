# Day 15

A 40 for 40 app: Expectation Manager, which helps an agency and a client find the holes in a project before the budget is spent. Built with Vue 3, TypeScript and Vite, and served by a Cloudflare Worker.

## Today: Day 15

Special guest day. Agency plans are full of holes at the start, and the blind spots turn up once the money has gone. This talks to each side on its own, finds where they disagree, and helps them sort it out early.

What's here so far:

1. **Pick your side.** Agency or client, each with its own link.
2. **Describe the project.** A few sentences in your own words.
3. **Answer the coach.** It asks one question at a time through a lens you choose (money, delivery, agency, client or procurement).

Not built yet: saving anything, comparing the two sides, and the project truth document.

## Develop

```sh
npm install
cp .dev.vars.example .dev.vars   # then add your ANTHROPIC_API_KEY
npm run dev                      # Vite and the Worker API together, at http://localhost:5173/day15/
npm run fake                     # or the page with a fake API, no key needed
```

## Check

```sh
npm test          # unit tests, colocated as *.test.ts
npm run build     # type-check and production build
```

## Deploy

Live at https://build40for40.com/day15/. Merging to `main` deploys it, and every pull request gets a public preview link in a comment.
