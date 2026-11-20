<script setup lang="ts">
import { PRIORITY_LABELS, toPriority } from '@day15/shared/priorities'
import type { Fact, Participant, Topic } from '@day15/shared/schema'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AlignmentCircle from './AlignmentCircle.vue'
import { getRoom } from './api'
import { overall, questionText, statusLine, topicStates, type Bucket, type RoomQuestion, type RoomView, type TopicState } from './circle'
import PairGlyph from './PairGlyph.vue'
import { changedTopics, fingerprints } from './talk'
import TalkDock from './TalkDock.vue'

const props = defineProps<{ projectId: string; people: Participant[] }>()

const REFRESH_MS = 8_000
const EMPTY: RoomView = { facts: [], openQuestions: [], asks: [] }

const room = ref<RoomView>(EMPTY)
const loaded = ref(false)
const error = ref('')
const selected = ref<Topic | null>(null)
const filter = ref<'all' | 'decided' | 'talked' | 'open'>('all')

const topics = computed(() => topicStates(room.value))
const summary = computed(() => overall(topics.value))
const filters = computed(() => [
  { id: 'all' as const, label: `All ${topics.value.length}` },
  { id: 'decided' as const, label: `Decided ${summary.value.decided}` },
  { id: 'talked' as const, label: `Talked about ${summary.value.talked}` },
  { id: 'open' as const, label: `Still open ${summary.value.open + summary.value.crack}` },
])
const shows: Record<typeof filter.value, Bucket[]> = {
  all: ['crack', 'open', 'talked', 'decided'],
  decided: ['decided'],
  talked: ['talked'],
  open: ['open', 'crack'],
}
const rows = computed(() => topics.value.filter((topic) => shows[filter.value].includes(topic.bucket)))

const names = computed(() => new Map(props.people.map((person) => [person.id, person.name])))
const latest = computed(() => room.value.facts[room.value.facts.length - 1] ?? null)

const dock = ref<InstanceType<typeof TalkDock> | null>(null)
const flashId = ref<Topic | null>(null)
const selectedState = computed(() => topics.value.find((topic) => topic.id === selected.value) ?? null)
/** What each topic held at the last read, so a refresh can tell what someone just changed. */
let seen: Map<Topic, string> | null = null
let flashTimer: ReturnType<typeof setTimeout> | undefined

/** Lens wording cites facts by their short ids, which mean nothing on this page. */
const plain = (text: string) => text.replace(/\s*\((?:[a-z]\d+(?:,\s*|\s+and\s+)?)+\)/gi, '')

function author(fact: Fact) {
  if (fact.authorKind === 'lens') return { name: 'A-Line', side: 'coach' }
  return { name: names.value.get(fact.participantId ?? 0) ?? `Someone on the ${fact.side} side`, side: fact.side ?? 'coach' }
}

const factStatus = (fact: Fact) =>
  fact.status === 'superseded' ? 'Replaced, from' : fact.authorKind === 'lens' ? 'Worked out by' : fact.status === 'confirmed' ? 'Confirmed by' : 'Proposed by'

const priority = (question: RoomQuestion) => PRIORITY_LABELS[toPriority(question.priority)]
const askedOf = (question: RoomQuestion) => ({ agency: 'For the agency', client: 'For the client', both: 'For both sides' })[question.askSide]

function chasing(question: RoomQuestion) {
  const asked = room.value.asks.filter((ask) => ask.questionId === question.id).map((ask) => names.value.get(ask.addressedTo))
  const known = [...new Set(asked.filter((name) => name !== undefined))]
  return known.length ? `A-Line has asked ${known.join(' and ')}.` : ''
}

async function load() {
  try {
    room.value = (await getRoom(props.projectId)).room
    error.value = ''
    const now = topicStates(room.value)
    const changed = changedTopics(seen, now)
    seen = fingerprints(now)
    if (changed.length) react(changed, now)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Something went wrong.'
  } finally {
    loaded.value = true
  }
}

/** Someone talked to the coach: light up what changed, and let the glow fly there from the dock. */
function react(ids: Topic[], now: TopicState[]) {
  const first = ids[0]
  if (!first) return
  flashId.value = first
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashId.value = null
  }, 1800)
  const names = ids.map((id) => now.find((topic) => topic.id === id)?.name ?? id)
  const list = names.length > 2 ? `${names[0]}, ${names[1]} and ${names.length - 2} more` : names.join(' and ')
  dock.value?.announce(`${list} just changed in the room.`, first)
  void dock.value?.fly(first)
}

function pick(id: Topic, fromCircle = false) {
  selected.value = selected.value === id && !fromCircle ? null : id
  if (fromCircle && !shows[filter.value].includes(topics.value.find((topic) => topic.id === id)!.bucket)) filter.value = 'all'
}

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  void load()
  timer = setInterval(() => {
    if (!document.hidden) void load()
  }, REFRESH_MS)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(flashTimer)
})

watch(
  () => props.projectId,
  () => {
    room.value = EMPTY
    seen = null
    loaded.value = false
    selected.value = null
    void load()
  },
)
</script>

<template>
  <div class="circle-view">
    <div class="stagecol">
      <AlignmentCircle :topics="topics" :selected="selected" :word="loaded ? summary.word : 'One sec...'" :detail="loaded ? summary.detail : ''" @select="pick($event, true)" />

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div v-else class="ticker" aria-live="polite">
        <template v-if="latest">
          <span class="who" :class="author(latest).side">{{ author(latest).name }}</span>
          <span><span class="to">Latest in the room</span>{{ latest.statement }}</span>
        </template>
        <template v-else-if="loaded">
          <span class="who coach">A-Line</span>
          <span>
            <span class="to">Nothing in the room yet</span>
            The circle grows as people talk to the coach. Send everyone their link from the People tab and watch it take shape.
          </span>
        </template>
      </div>

      <div class="key" aria-label="How to read the circle">
        <h3>How to read it</h3>
        <ul>
          <li>
            <svg viewBox="0 0 40 24" aria-hidden="true"><circle cx="20" cy="12" r="9" fill="#5de0a8" /><circle cx="20" cy="12" r="5.5" fill="#5de0a8" stroke="#07120c" stroke-width="1.2" /></svg>
            <span><b>Dots on top of each other turn green.</b> Both sides have said their piece and nothing is open.</span>
          </li>
          <li>
            <svg viewBox="0 0 40 24" aria-hidden="true"><circle cx="6" cy="12" r="5" fill="#46d6c8" /><circle cx="34" cy="12" r="6" fill="#ffae6b" /><line x1="11" y1="12" x2="28" y2="12" stroke="#c9d1e0" stroke-width="1.6" stroke-dasharray="5 4" /></svg>
            <span><b>Dashed spoke.</b> Being worked out. The further apart, the less aligned.</span>
          </li>
          <li>
            <svg viewBox="0 0 40 24" aria-hidden="true"><circle cx="6" cy="12" r="5" fill="#46d6c8" /><circle cx="34" cy="12" r="6" fill="#070b14" stroke="#ffae6b" stroke-width="1.6" /><line x1="11" y1="12" x2="28" y2="12" stroke="#8a96b0" stroke-width="1.8" stroke-dasharray="1.5 5" stroke-linecap="round" /></svg>
            <span><b>Dotted spoke.</b> One side hasn't said anything yet.</span>
          </li>
          <li>
            <svg viewBox="0 0 40 24" aria-hidden="true"><circle cx="5" cy="12" r="4.5" fill="#46d6c8" /><circle cx="35" cy="12" r="5.5" fill="#ffae6b" /><line x1="10" y1="12" x2="16" y2="12" stroke="#fff4e6" stroke-width="1.8" /><line x1="24" y1="12" x2="30" y2="12" stroke="#fff4e6" stroke-width="1.8" /><circle cx="20" cy="12" r="3.5" fill="none" stroke="#fff4e6" stroke-width="1.4" /></svg>
            <span><b>Broken spoke.</b> A deal-breaker. Sort it before work starts.</span>
          </li>
        </ul>
      </div>

      <div class="legend">
        <span><i class="dot agency" />Agency</span>
        <span><i class="dot client" />Client</span>
        <span><i class="dot coach" />A-Line, the coach</span>
      </div>
    </div>

    <div class="listcol">
      <div class="seg" role="group" aria-label="Filter decisions">
        <button v-for="option in filters" :key="option.id" type="button" :aria-pressed="filter === option.id" @click="filter = option.id">
          {{ option.label }}
        </button>
      </div>

      <ul class="rows">
        <li v-for="topic in rows" :key="topic.id" class="item" :class="{ open: selected === topic.id, flash: flashId === topic.id }" :data-row="topic.id">
          <button type="button" class="head" :aria-expanded="selected === topic.id" @click="pick(topic.id)">
            <PairGlyph :topic="topic" />
            <span>
              <span class="name">{{ topic.name }}</span>
              <span class="sub">{{ plain(statusLine(topic)) }}</span>
            </span>
            <span class="badges">
              <span v-if="topic.bucket === 'crack'" class="pill crack">Deal-breaker</span>
              <span v-else-if="topic.bucket === 'decided'" class="pill decided">Decided</span>
              <span v-if="topic.questions.length" class="pill count">{{ topic.questions.length }} open</span>
              <svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </span>
          </button>

          <div v-if="selected === topic.id" class="body">
            <section>
              <h4>Facts</h4>
              <ul>
                <li v-for="fact in topic.facts" :key="fact.id" class="fact" :class="{ replaced: fact.status === 'superseded' }">
                  <span class="txt">{{ fact.statement }}</span>
                  <span class="meta">
                    <span>{{ factStatus(fact) }}</span>
                    <span class="tag"><i class="dot" :class="author(fact).side" />{{ author(fact).name }}</span>
                    <span v-if="fact.private" class="pill">Private to your side</span>
                  </span>
                </li>
                <li v-if="!topic.facts.length" class="empty">Nothing stated yet.</li>
              </ul>
            </section>

            <section>
              <h4>Open questions</h4>
              <ul>
                <li v-for="question in topic.questions" :key="question.id" class="q">
                  <span class="meta">
                    <span class="prio" :class="priority(question)">{{ priority(question) }}</span>
                    <span class="tag">{{ askedOf(question) }}</span>
                  </span>
                  <span class="txt">{{ plain(questionText(question)) }}</span>
                  <span v-if="question.agencySaid" class="said"><i class="dot agency" />{{ plain(question.agencySaid) }}</span>
                  <span v-if="question.clientSaid" class="said"><i class="dot client" />{{ plain(question.clientSaid) }}</span>
                  <span v-if="question.because" class="meta">{{ plain(question.because) }}</span>
                  <span v-if="chasing(question)" class="meta">{{ chasing(question) }}</span>
                </li>
                <li v-if="!topic.questions.length" class="empty">Nothing open.</li>
              </ul>
            </section>
          </div>
        </li>
        <li v-if="!rows.length" class="empty none">Nothing here yet.</li>
      </ul>
    </div>

    <TalkDock ref="dock" :topic="selectedState" @show="pick($event, true)" />
  </div>
</template>

<style scoped>
.circle-view {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
  gap: clamp(20px, 3.4vw, 52px);
  align-items: start;
}

.stagecol {
  position: sticky;
  top: 14px;
  display: grid;
  gap: 14px;
  min-width: 0;
}

.listcol {
  min-width: 0;
  display: grid;
  gap: 14px;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ticker {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-height: 52px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(11, 18, 32, 0.7);
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.who {
  flex: none;
  max-width: 45%;
  font: 600 12px/1.2 var(--sans);
  color: #08101c;
  padding: 5px 9px;
  border-radius: 999px;
  margin-top: 1px;
}

.who.agency {
  background: var(--teal);
}

.who.client {
  background: var(--orange);
}

.who.coach {
  background: var(--coral);
}

.to {
  color: var(--dim);
  font-size: 12px;
  display: block;
  margin-bottom: 2px;
}

.key {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
  background: rgba(11, 18, 32, 0.55);
}

.key h3 {
  font: italic 300 18px/1.2 var(--serif);
  color: var(--lit);
  margin: 0 0 10px;
}

.key ul {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px 20px;
}

.key li {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  align-items: center;
  font-size: 13px;
  line-height: 1.4;
  color: var(--dim);
}

.key li svg {
  width: 40px;
  height: 24px;
  overflow: visible;
}

.key b {
  color: var(--lit);
  font-weight: 500;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  font-size: 13px;
  color: var(--dim);
}

.legend span,
.tag,
.said {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.said {
  align-items: baseline;
  font-size: 14px;
}

.rows {
  display: grid;
}

.item {
  border-top: 1px solid var(--line);
}

.item:last-child {
  border-bottom: 1px solid var(--line);
}

.head {
  all: unset;
  cursor: pointer;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 16px 6px;
  width: 100%;
  box-sizing: border-box;
}

.head:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -2px;
  border-radius: 8px;
}

.name {
  display: block;
  font: 400 21px/1.2 var(--serif);
  color: var(--lit);
  transition: color 0.2s;
}

.head:hover .name,
.item.open .name {
  color: #fff;
}

.sub {
  display: block;
  font-size: 13px;
  color: var(--dim);
  margin-top: 2px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.badges {
  display: flex;
  gap: 6px;
  align-items: center;
}

.chev {
  width: 16px;
  height: 16px;
  transition: transform 0.25s;
  color: var(--dim);
}

.item.open .chev {
  transform: rotate(90deg);
}

.body {
  display: grid;
  gap: 18px;
  padding: 2px 6px 22px 74px;
  animation: open-in 0.28s ease-out;
}

@keyframes open-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.body h4 {
  font: 600 13px var(--sans);
  color: var(--dim);
  margin: 0 0 8px;
}

.body ul {
  display: grid;
  gap: 12px;
}

.fact,
.q {
  display: grid;
  gap: 4px;
  font-size: 14.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.txt {
  font: 400 17px/1.45 var(--serif);
  color: var(--lit);
}

.fact.replaced .txt {
  text-decoration: line-through;
  color: var(--dim);
}

.meta {
  font-size: 12.5px;
  color: var(--dim);
  display: flex;
  gap: 6px 12px;
  flex-wrap: wrap;
  align-items: center;
}

.prio {
  font: 600 11.5px/1 var(--sans);
  padding: 4px 8px;
  border-radius: 999px;
  text-transform: capitalize;
}

.prio.high {
  background: var(--lit);
  color: #1a1408;
}

.prio.medium {
  border: 1px solid var(--lit);
  color: var(--lit);
}

.prio.low {
  border: 1px solid var(--line-2);
  color: var(--dim);
}

.empty {
  color: var(--dim);
  font-size: 14px;
}

.empty.none {
  padding: 16px 6px;
}

.error {
  margin: 0;
}

@media (max-width: 980px) {
  .circle-view {
    grid-template-columns: 1fr;
  }

  .stagecol {
    position: static;
  }

  .body {
    padding-left: 6px;
  }
}

@media (max-width: 520px) {
  .head {
    grid-template-columns: 44px minmax(0, 1fr) auto;
    gap: 10px;
  }

  .name {
    font-size: 19px;
  }

  .pill.count {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .body {
    animation: none;
  }
}
.item.flash .head {
  animation: row-flash 1.6s ease-out;
  border-radius: 8px;
}

@keyframes row-flash {
  0% {
    background: rgba(255, 156, 145, 0.28);
  }
  100% {
    background: transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .item.flash .head {
    animation: none;
    background: rgba(255, 156, 145, 0.18);
  }
}
</style>
