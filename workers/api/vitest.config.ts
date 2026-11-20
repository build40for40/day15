import { readFile } from 'node:fs/promises'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      // Wrangler bundles .md files as text (see `rules` in wrangler.jsonc). This does the same for tests.
      name: 'markdown-as-text',
      async load(id) {
        if (id.endsWith('.md')) return `export default ${JSON.stringify(await readFile(id, 'utf8'))}`
      },
    },
  ],
  test: { environment: 'node' },
})
