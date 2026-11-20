// Plays the whole script headless at high speed and checks all twelve sections end up green.
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const code = readFileSync(new URL('./engine.js', import.meta.url), 'utf8')
const ctx = { window: {}, document: { getElementById() { return null } }, console, setTimeout, clearTimeout, setInterval, clearInterval }
vm.createContext(ctx); vm.runInContext(code, ctx)
const EM = ctx.window.EM
console.log('beats', EM.BEATS.length)
const seen = {}
const s = EM.createSession({ autoplay: false, speed: 400 })
s.on((e) => { seen[e.type] = (seen[e.type] || 0) + 1; if (e.type === 'choice') setTimeout(() => s.choose(0), 5) })
s.play()
let guard = 0
await new Promise((r) => { const t = setInterval(() => { if (s.finished || ++guard > 300) { clearInterval(t); r() } }, 50) })
const p = s.progress()
console.log(seen, p, s.state.axioms.length + ' axioms')
const ex = EM.buildExports(s.state)
const j = JSON.stringify(ex)
console.log('exports', ex.map((x) => x.id).join(','), 'pending marks:', (j.match(/pending/g) || []).length)
process.exit(p.green === 12 ? 0 : 1)
