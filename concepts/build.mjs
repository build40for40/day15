// Inlines shared/engine.js into every concepts/src/*.html (at <!--ENGINE-->) and writes concepts/dist/*.html
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const engine = readFileSync(join(here, 'shared/engine.js'), 'utf8')
mkdirSync(join(here, 'dist'), { recursive: true })
for (const f of readdirSync(join(here, 'src')).filter((n) => n.endsWith('.html'))) {
  const html = readFileSync(join(here, 'src', f), 'utf8')
  if (!html.includes('<!--ENGINE-->')) { console.warn('no <!--ENGINE--> marker in', f); continue }
  writeFileSync(join(here, 'dist', f), html.replace('<!--ENGINE-->', () => '<script>\n' + engine + '\n</script>'))
  console.log('built', f)
}
