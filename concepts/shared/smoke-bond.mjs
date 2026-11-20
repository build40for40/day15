import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const html = readFileSync(new URL('../dist/bond-lab.html', import.meta.url), 'utf8')
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
const mk = () => new Proxy(function () {}, {
  get: (t, k) => k === 'then' ? undefined : k === Symbol.toPrimitive ? () => 0 : k === 'getContext' ? () => mk() : k === 'getBoundingClientRect' ? () => ({ width: 760, height: 480 }) : k === 'measureText' ? () => ({ width: 40 }) : k === 'length' ? 0 : mk(),
  apply: () => mk(), set: () => true })
const frames = []
const win = { devicePixelRatio: 2, matchMedia: () => ({ matches: false }), addEventListener() {}, ResizeObserver: undefined }
const ctx = { window: win, document: { getElementById: () => mk(), createElement: () => mk(), createTextNode: () => mk(), head: mk() }, console, setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (f) => { frames.push(f) }, Math, Date, JSON, parseInt, Object, Array, String, Number }
win.window = win; Object.assign(win, { requestAnimationFrame: ctx.requestAnimationFrame })
vm.createContext(ctx)
vm.runInContext(scripts[0], ctx)
const EM = ctx.window.EM; const orig = EM.createSession
EM.createSession = (o) => { const s = orig({ ...o, speed: 200 }); s.on((e) => { if (e.type === 'choice') setTimeout(() => s.choose(1), 20) }); globalThis.__s = s; return s }
vm.runInContext(scripts[1], ctx)
let ts = 0, n = 0
while (!(globalThis.__s.finished) && n < 20000) { const f = frames.splice(0); ts += 16; f.forEach((fn) => fn(ts)); n++; await new Promise((r) => setTimeout(r, 2)) }
for (let i = 0; i < 120; i++) { ts += 16; frames.splice(0).forEach((fn) => fn(ts)) }
console.log('frames', n, 'finished', globalThis.__s.finished, globalThis.__s.progress())
process.exit(0)
