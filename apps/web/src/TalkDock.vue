<script setup lang="ts">
import type { Participant, Topic } from '@day15/shared/schema'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { RoomQuestion, TopicState } from './circle'
import { messageForCoach, messageForOwnAi, questionLine } from './talk'

const props = defineProps<{
  /** The card that is open, if any. What you say is about it. */
  topic: TopicState | null
  /** People on the agency side. The page can speak for them. */
  speakers: Participant[]
  /** Sends words to the coach as one of them, and resolves with what the coach says back. */
  send: (participantId: number, message: string) => Promise<string>
}>()

const emit = defineEmits<{ show: [id: Topic] }>()

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface Point {
  x: number
  y: number
}

const speech = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
const Speech = speech.SpeechRecognition ?? speech.webkitSpeechRecognition
const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const open = ref(false)
const said = ref('')
/** The question being answered, when someone chose "Answer this" on it. */
const asked = ref<RoomQuestion | null>(null)
const speakerId = ref<number | null>(null)
const sending = ref(false)
const reply = ref('')
const listening = ref(false)
const copied = ref(false)
const note = ref('')
const away = ref(false)
const orb = ref<HTMLElement | null>(null)
const spark = ref<HTMLElement | null>(null)
const area = ref<HTMLTextAreaElement | null>(null)

const toastText = ref('')
const toastTopic = ref<Topic | null>(null)
const toastOn = ref(false)

let recognition: Recognition | undefined
let sendWhenStopped = false
let alive = true
let frame = 0
let toastTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.speakers,
  (people) => {
    if (!people.some((person) => person.id === speakerId.value)) speakerId.value = people[0]?.id ?? null
  },
  { immediate: true },
)

const context = computed(() => (props.topic ? `About ${props.topic.name}` : 'About the whole project'))
const waitingOn = computed(() => asked.value ?? props.topic?.questions[0] ?? null)
const label = computed(() => (listening.value ? 'Listening. Tap to stop.' : 'Talk to the coach'))

function startListening() {
  if (!Speech) {
    note.value = 'Voice is not available in this browser. Type instead.'
    return false
  }
  try {
    const base = said.value ? said.value.replace(/\s*$/, ' ') : ''
    const heard = new Speech()
    heard.lang = 'en-GB'
    heard.continuous = true
    heard.interimResults = true
    heard.onresult = (event) => {
      let words = ''
      for (let index = 0; index < event.results.length; index++) words += event.results[index]?.[0]?.transcript ?? ''
      said.value = base + words
    }
    heard.onerror = (event) => {
      listening.value = false
      sendWhenStopped = false
      note.value =
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'The microphone is blocked. Type instead.'
          : event.error === 'no-speech'
            ? 'I did not hear anything. Tap to try again.'
            : 'Voice stopped. You can type instead.'
    }
    heard.onend = () => {
      listening.value = false
      if (sendWhenStopped) {
        sendWhenStopped = false
        void submit()
      }
    }
    recognition = heard
    heard.start()
    listening.value = true
    note.value = ''
    return true
  } catch {
    note.value = 'Voice is not available in this browser. Type instead.'
    return false
  }
}

function stopListening(thenSend = false) {
  if (recognition && listening.value) {
    sendWhenStopped = thenSend
    try {
      recognition.stop()
    } catch {
      listening.value = false
    }
    return
  }
  listening.value = false
}

/** Opens the panel. Called with a question when someone chose "Answer this" on it. */
function show_(question: RoomQuestion | null = null) {
  asked.value = question
  reply.value = ''
  note.value = ''
  copied.value = false
  open.value = true
  void nextTick(() => area.value?.focus({ preventScroll: true }))
}

function tap() {
  if (!open.value) {
    show_()
    startListening()
    return
  }
  if (listening.value) return stopListening(true)
  if (Speech) return void startListening()
  close()
}

function close() {
  stopListening()
  open.value = false
}

async function submit() {
  const words = said.value.trim()
  if (sending.value) return
  if (!words) {
    note.value = 'Say or type something first.'
    return
  }
  if (speakerId.value === null) {
    note.value = 'Add someone from the agency side in People, then speak as them.'
    return
  }
  stopListening()
  sending.value = true
  note.value = ''
  try {
    reply.value = await props.send(speakerId.value, messageForCoach(props.topic, words, asked.value))
    said.value = ''
    asked.value = null
  } catch (error) {
    note.value = error instanceof Error ? error.message : 'Something went wrong. Try again?'
  } finally {
    sending.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(messageForOwnAi(props.topic, said.value.trim(), asked.value))
    copied.value = true
    note.value = ''
  } catch {
    note.value = "Your browser wouldn't copy it. Select the text and copy it by hand."
  }
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close()
}

onMounted(() => window.addEventListener('keydown', onKey))

/* ---------- The glow flies from the dock to what changed, then home ---------- */

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

function centre(element: Element): Point & { onScreen: boolean } {
  const box = element.getBoundingClientRect()
  return {
    x: clamp(box.left + box.width / 2, 24, window.innerWidth - 24),
    y: clamp(box.top + box.height / 2, 24, window.innerHeight - 24),
    onScreen: box.width > 0 && box.top >= 0 && box.bottom <= window.innerHeight,
  }
}

function place(point: Point) {
  if (spark.value) spark.value.style.transform = `translate(${point.x.toFixed(1)}px,${point.y.toFixed(1)}px)`
}

function dropTrail(point: Point) {
  const dot = document.createElement('span')
  Object.assign(dot.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '6px',
    height: '6px',
    margin: '-3px 0 0 -3px',
    borderRadius: '50%',
    background: 'rgba(255,176,165,.9)',
    boxShadow: '0 0 6px 2px rgba(255,156,145,.45)',
    pointerEvents: 'none',
    zIndex: '59',
    transform: `translate(${point.x.toFixed(1)}px,${point.y.toFixed(1)}px)`,
  })
  document.body.appendChild(dot)
  const done = () => dot.remove()
  if (typeof dot.animate === 'function') dot.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 450, easing: 'ease-out' }).onfinish = done
  else setTimeout(done, 450)
}

function leg(from: () => Point, to: () => Point, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const a = from()
    const b = to()
    const bend: Point = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 90 }
    const start = performance.now()
    let count = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      const u = 1 - ease
      const at: Point = { x: u * u * a.x + 2 * u * ease * bend.x + ease * ease * b.x, y: u * u * a.y + 2 * u * ease * bend.y + ease * ease * b.y }
      place(at)
      if (++count % 3 === 0) dropTrail(at)
      if (k < 1 && alive) frame = requestAnimationFrame(step)
      else resolve()
    }
    frame = requestAnimationFrame(step)
  })
}

async function fly(id: Topic) {
  if (reduceMotion || !spark.value || !orb.value) return
  const home = () => centre(orb.value ?? document.body)
  const ball = document.querySelector(`[data-ball="${id}"]`)
  const row = document.querySelector(`[data-row="${id}"] .head`)
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    await pause(350)
  }
  const stops: Array<() => Point> = []
  if (ball && centre(ball).onScreen) stops.push(() => centre(ball))
  if (row) stops.push(() => centre(row))
  if (!stops.length || !alive) return
  spark.value.hidden = false
  away.value = true
  place(home())
  let from: () => Point = home
  for (const stop of stops) {
    await leg(from, stop, 640)
    await pause(240)
    from = stop
  }
  await leg(from, home, 640)
  if (spark.value) spark.value.hidden = true
  away.value = false
}

/** A line about what changed, with a way to jump to it. It fades by itself. */
function announce(message: string, id: Topic | null = null) {
  toastText.value = message
  toastTopic.value = id
  toastOn.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastOn.value = false
  }, 6000)
}

function jump() {
  if (toastTopic.value) emit('show', toastTopic.value)
  toastOn.value = false
}

onBeforeUnmount(() => {
  alive = false
  cancelAnimationFrame(frame)
  clearTimeout(toastTimer)
  stopListening()
  window.removeEventListener('keydown', onKey)
})

defineExpose({ fly, announce, show: show_ })
</script>

<template>
  <Teleport to="body">
    <div class="dock">
      <section v-if="open" class="panel" role="dialog" aria-label="Talk to the coach">
        <p class="ctx">{{ context }}</p>
        <p v-if="waitingOn" class="waiting">
          <span>{{ asked ? 'Answering' : 'The coach is waiting on' }}</span>
          {{ questionLine(waitingOn) }}
        </p>

        <label v-if="speakers.length > 1" class="as">
          Speaking as
          <select v-model="speakerId">
            <option v-for="person in speakers" :key="person.id" :value="person.id">{{ person.name }}</option>
          </select>
        </label>
        <p v-else-if="speakers.length === 1" class="as">Speaking as {{ speakers[0]?.name }}</p>
        <p v-else class="as">Add someone from the agency side in People to speak here.</p>

        <textarea
          ref="area"
          v-model="said"
          rows="3"
          aria-label="What to tell the coach"
          placeholder="Say or type what changed."
          @keydown.enter.exact.prevent="submit"
        />

        <div class="row">
          <button type="button" class="go" :disabled="sending" @click="submit">{{ sending ? 'Sending...' : 'Send to the coach' }}</button>
          <button type="button" @click="copy">{{ copied ? 'Copied' : 'Copy for my own AI' }}</button>
          <button type="button" @click="close">Close</button>
        </div>
        <p v-if="note" class="note" role="alert">{{ note }}</p>

        <p v-if="reply" class="reply"><span class="who">A-Line</span>{{ reply }}</p>
        <p v-else class="hint">The coach records it straight away. Everyone else talks to it from their own AI.</p>
      </section>

      <div class="dockrow">
        <span class="dlabel">{{ label }}</span>
        <button ref="orb" type="button" class="orb" :class="{ away, listening }" :aria-pressed="listening" aria-label="Talk to the coach" @click="tap">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 18v3" /></svg>
        </button>
      </div>
    </div>

    <span ref="spark" class="spark" hidden aria-hidden="true" />

    <div class="toast" :class="{ on: toastOn && !open }" role="status">
      <span>{{ toastText }}</span>
      <button v-if="toastTopic && toastOn" type="button" class="see" @click="jump">Show me</button>
    </div>
  </Teleport>
</template>

<style scoped>
.dock {
  position: fixed;
  right: max(20px, env(safe-area-inset-right, 0px));
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  z-index: 50;
  display: grid;
  gap: 12px;
  justify-items: end;
  width: min(400px, calc(100vw - 40px));
  pointer-events: none;
}

.dock > * {
  pointer-events: auto;
}

.panel {
  width: 100%;
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid rgba(255, 156, 145, 0.5);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(38, 24, 34, 0.98), rgba(11, 18, 32, 0.99));
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(255, 156, 145, 0.12);
  color: var(--text);
  animation: panel-in 0.22s ease-out;
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

.ctx {
  margin: 0;
  font: 600 13px var(--sans);
  color: var(--coral);
}

.waiting {
  margin: 0;
  font: 400 16px/1.45 var(--serif);
  color: var(--lit);
}

.waiting span {
  display: block;
  font: 500 12px var(--sans);
  color: var(--dim);
}

.as {
  margin: 0;
  font: 500 13px var(--sans);
  color: var(--dim);
  display: flex;
  align-items: center;
  gap: 8px;
}

.as select {
  font: 500 13px var(--sans);
  color: var(--text);
  background: var(--midnight);
  border: 1px solid var(--line-2);
  border-radius: 8px;
  padding: 5px 8px;
}

.panel textarea {
  width: 100%;
  min-height: 78px;
  resize: vertical;
  background: var(--midnight);
  color: var(--text);
  border: 1px solid var(--line-2);
  border-radius: 10px;
  padding: 10px 12px;
  font: 400 14px/1.5 var(--sans);
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.row button {
  cursor: pointer;
  font: 500 13px var(--sans);
  padding: 8px 14px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
}

.row button:hover:not(:disabled) {
  border-color: var(--coral);
  color: #fff;
}

.row button:disabled {
  opacity: 0.6;
  cursor: default;
}

.row .go {
  background: var(--coral);
  color: #2a0f0b;
  border-color: var(--coral);
  font-weight: 600;
}

.row .go:hover:not(:disabled) {
  color: #2a0f0b;
  filter: brightness(1.06);
}

.note {
  margin: 0;
  font: 12.5px/1.4 var(--sans);
  color: var(--coral);
}

.reply {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 156, 145, 0.1);
  font: 400 14px/1.5 var(--sans);
  color: var(--text);
}

.reply .who {
  display: inline-block;
  margin-right: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--coral);
  color: #2a0f0b;
  font: 600 11.5px var(--sans);
}

.hint {
  margin: 0;
  font: 12.5px/1.45 var(--sans);
  color: var(--dim);
}

.dockrow {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dlabel {
  font: 500 13px var(--sans);
  color: var(--text);
  background: rgba(7, 11, 20, 0.9);
  border: 1px solid rgba(255, 156, 145, 0.4);
  border-radius: 999px;
  padding: 7px 13px;
}

.orb {
  all: unset;
  cursor: pointer;
  position: relative;
  flex: none;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 40% 35%, #fff9f6, #ffdcd4 60%, #ffb7ac);
  box-shadow: 0 0 14px 5px rgba(255, 236, 230, 0.5), 0 0 40px 16px rgba(255, 156, 145, 0.35), 0 0 80px 34px rgba(201, 182, 240, 0.14);
  transition: box-shadow 0.3s, opacity 0.3s, transform 0.15s;
}

.orb:hover {
  transform: scale(1.05);
}

.orb:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 6px;
}

.orb svg {
  width: 24px;
  height: 24px;
  stroke: #7a2f27;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.orb::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1px solid rgba(255, 156, 145, 0.6);
  animation: ring 2.6s ease-out infinite;
  pointer-events: none;
}

.orb.listening::after {
  animation-duration: 1.1s;
  border-width: 2px;
  border-color: rgba(255, 156, 145, 0.95);
}

.orb.away {
  opacity: 0.3;
}

@keyframes ring {
  from {
    transform: scale(0.6);
    opacity: 0.9;
  }
  to {
    transform: scale(2.6);
    opacity: 0;
  }
}

.spark {
  position: fixed;
  left: 0;
  top: 0;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: #fff1ec;
  box-shadow: 0 0 12px 5px rgba(255, 236, 230, 0.75), 0 0 38px 16px rgba(255, 156, 145, 0.5), 0 0 80px 34px rgba(201, 182, 240, 0.2);
  z-index: 60;
  pointer-events: none;
  will-change: transform;
}

/* A quiet note above the dock, in the app's own dark, so it never sits on the cards like a sticker. */
.toast {
  position: fixed;
  right: max(20px, env(safe-area-inset-right, 0px));
  bottom: calc(92px + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: min(360px, calc(100vw - 40px));
  padding: 10px 14px;
  border: 1px solid var(--line-2);
  border-left: 3px solid var(--coral);
  border-radius: 12px;
  background: var(--raise);
  color: var(--text);
  font: 400 13.5px/1.45 var(--sans);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
  transition: opacity 0.25s, transform 0.25s;
  z-index: 55;
}

.toast.on {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.see {
  all: unset;
  flex: none;
  cursor: pointer;
  font-weight: 600;
  color: var(--coral);
  text-decoration: underline;
}

.see:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .orb::after,
  .panel {
    animation: none;
  }

  .toast {
    transition: none;
  }
}
</style>
