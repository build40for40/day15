import { readFile } from 'node:fs/promises'

import { defineConfig } from 'vitest/config'

import { modelEnv } from './env'

if (!modelEnv().ANTHROPIC_API_KEY) {
  console.error(
    'Coach evals need a real model. Set ANTHROPIC_API_KEY in the environment or in workers/api/.dev.vars.\nScores are unmeasured.',
  )
  process.exit(2)
}

export default defineConfig({
  root: new URL('..', import.meta.url).pathname,
  plugins: [
    {
      name: 'markdown-as-text',
      async load(id) {
        if (id.endsWith('.md')) return `export default ${JSON.stringify(await readFile(id, 'utf8'))}`
      },
    },
  ],
  test: { environment: 'node', include: ['evals/**/*.eval.ts'], testTimeout: 240_000, hookTimeout: 60_000 },
})
