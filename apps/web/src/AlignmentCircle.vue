<script setup lang="ts">
import type { Topic } from '@day15/shared/schema'
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

import type { Coverage, TopicState } from './circle'

const props = defineProps<{
  topics: TopicState[]
  selected: Topic | null
  /** What sits in the middle. */
  word: string
  detail: string
}>()

const emit = defineEmits<{ select: [id: Topic] }>()

const WIDTH = 760
const HEIGHT = 736
const CX = 380
const CY = 368
const INNER = 112
const OUTER = 236
const LABEL = OUTER + 26
const TEAL = '#46d6c8'
const ORANGE = '#ffae6b'
const GREEN = '#5de0a8'
const MIDNIGHT = '#070b14'

const uid = useId()
const moves = typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

const angle = (index: number) => -Math.PI / 2 + (index * Math.PI * 2) / props.topics.length
const point = (radius: number, a: number) => ({ x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) })
const between = (from: { x: number; y: number }, to: { x: number; y: number }, at: number) => ({
  x: from.x + (to.x - from.x) * at,
  y: from.y + (to.y - from.y) * at,
})

const target = computed(() =>
  props.topics.map((topic) => INNER + (OUTER - INNER) * (topic.lit ? Math.min(1, (1 - topic.score) / 0.7) : 0.5)),
)
const radius = ref(moves ? props.topics.map(() => INNER + (OUTER - INNER) * 0.5) : [...target.value])

function ball(level: Coverage, colour: string) {
  if (level === 'missing') return { fill: MIDNIGHT, 'fill-opacity': 1, stroke: colour }
  return { fill: colour, 'fill-opacity': level === 'settled' ? 1 : 0.38, stroke: colour }
}

const spokes = computed(() =>
  props.topics.map((topic, index) => {
    const a = angle(index)
    const r = radius.value[index] ?? target.value[index]!
    const inner = point(INNER, a)
    const outer = point(r, a)
    const gap = r - INNER
    const selected = props.selected === topic.id
    const merged = topic.bucket === 'decided' && gap < 6
    const grow = Math.min(1, gap / 22)
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'
    const label = point(LABEL, a)
    return {
      topic,
      selected,
      inner,
      outer,
      gradient: `${uid}-spoke-${index}`,
      width: selected ? 3 : 2,
      hidden: gap < 3,
      crack: topic.bucket === 'crack' ? { from: between(inner, outer, 0.5), to: between(inner, outer, 0.64) } : null,
      dash: topic.bucket === 'crack' || topic.bucket === 'decided' ? undefined : topic.bucket === 'talked' && topic.lit ? '6 6' : '1.5 8',
      opacity: !topic.lit ? 0.28 : { decided: 0.95, talked: 0.85, crack: 1, open: 0.55 }[topic.bucket],
      agency: { ...ball(topic.coverage.agency, merged ? GREEN : TEAL), r: 11 - 2.5 * grow + (selected ? 1.5 : 0) },
      client: {
        ...ball(topic.coverage.client, merged ? GREEN : ORANGE),
        r: 6.8 + 3.7 * grow + (selected ? 1.5 : 0),
        'stroke-opacity': topic.lit ? 1 : 0.4,
        'stroke-dasharray': topic.lit ? undefined : '2 3',
      },
      label: {
        x: label.x + (anchor === 'start' ? 6 : anchor === 'end' ? -6 : 0),
        y: label.y + (sin > 0.5 ? 12 : sin < -0.5 ? -6 : 4),
        anchor,
      },
    }
  }),
)

const guides = computed(() =>
  props.topics.map((_, index) => ({ from: point(INNER + 14, angle(index)), to: point(OUTER + 6, angle(index)) })),
)

const blob = computed(() => {
  const points = spokes.value.filter((spoke) => spoke.topic.lit).map((spoke) => spoke.outer)
  const n = points.length
  if (n < 3) return null
  const xy = (p: { x: number; y: number }) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  let path = `M${xy(points[0]!)}`
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [points[(i - 1 + n) % n]!, points[i]!, points[(i + 1) % n]!, points[(i + 2) % n]!]
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    path += `C${xy(c1)},${xy(c2)},${xy(p2)}`
  }
  return `${path}Z`
})

const orb = ref<HTMLElement | null>(null)
const dust = ref<HTMLCanvasElement | null>(null)
let frameId = 0
let observer: ResizeObserver | undefined

watch(target, (next) => {
  if (!moves) radius.value = [...next]
})

onMounted(() => {
  if (!moves) return
  const canvas = dust.value!
  const context = canvas.getContext('2d')
  const size = { width: 0, height: 0, ratio: 1 }
  const resize = () => {
    const box = canvas.getBoundingClientRect()
    size.ratio = Math.min(2, window.devicePixelRatio || 1)
    size.width = box.width
    size.height = box.height
    canvas.width = Math.round(box.width * size.ratio)
    canvas.height = Math.round(box.height * size.ratio)
  }
  resize()
  observer = new ResizeObserver(resize)
  observer.observe(canvas)

  const sprites = ['255,241,236', '255,156,145', '214,198,245'].map((rgb) => {
    const sprite = document.createElement('canvas')
    sprite.width = sprite.height = 32
    const paint = sprite.getContext('2d')!
    const gradient = paint.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, `rgba(${rgb},1)`)
    gradient.addColorStop(0.25, `rgba(${rgb},.55)`)
    gradient.addColorStop(1, `rgba(${rgb},0)`)
    paint.fillStyle = gradient
    paint.fillRect(0, 0, 32, 32)
    return sprite
  })
  interface Mote { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; sprite: HTMLCanvasElement; phase: number }
  const motes: Mote[] = []
  let lastMote = 0
  const at = { x: CX, y: CY - 70 }

  const frame = (now: number) => {
    const goal = target.value
    if (radius.value.some((r, i) => Math.abs(goal[i]! - r) > 0.05)) {
      radius.value = radius.value.map((r, i) => r + (goal[i]! - r) * 0.07)
    }

    const seconds = now / 1000
    const index = props.topics.findIndex((topic) => topic.id === props.selected)
    const to =
      index >= 0
        ? point((Math.max(radius.value[index]!, INNER + 30) + INNER) / 2 + Math.sin(seconds * 1.4) * 10, angle(index) + Math.sin(seconds * 0.9) * 0.05)
        : { x: CX + Math.cos(seconds * 0.35) * 70, y: CY + Math.sin(seconds * 0.35) * 56 }
    at.x += (to.x - at.x) * 0.05
    at.y += (to.y - at.y) * 0.05
    const x = (at.x / WIDTH) * size.width
    const y = (at.y / HEIGHT) * size.height
    if (orb.value) orb.value.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`

    if (context) {
      if (now - lastMote > 80 && motes.length < 50) {
        lastMote = now
        motes.push({
          x: x + (Math.random() - 0.5) * 12,
          y: y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 0.25,
          vy: -0.18 - Math.random() * 0.3,
          life: 0,
          max: 70 + Math.random() * 70,
          size: 7 + Math.random() * 10,
          sprite: sprites[Math.floor(Math.random() * sprites.length)]!,
          phase: Math.random() * 6.28,
        })
      }
      context.setTransform(size.ratio, 0, 0, size.ratio, 0, 0)
      context.clearRect(0, 0, size.width, size.height)
      context.globalCompositeOperation = 'lighter'
      for (let i = motes.length - 1; i >= 0; i--) {
        const mote = motes[i]!
        mote.life++
        mote.x += mote.vx + Math.sin((mote.life + mote.phase * 20) / 18) * 0.15
        mote.y += mote.vy
        if (mote.life > mote.max) {
          motes.splice(i, 1)
          continue
        }
        context.globalAlpha = Math.sin((mote.life / mote.max) * Math.PI) * 0.85
        context.drawImage(mote.sprite, mote.x - mote.size / 2, mote.y - mote.size / 2, mote.size, mote.size)
      }
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
    }
    frameId = requestAnimationFrame(frame)
  }
  frameId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  observer?.disconnect()
})
</script>

<template>
  <div class="stage">
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" role="group" aria-label="Alignment circle: each spoke joins an agency ball and a client ball">
      <defs>
        <radialGradient :id="`${uid}-blob`" cx="50%" cy="50%" r="50%">
          <stop offset="0" :stop-color="ORANGE" stop-opacity="0.02" />
          <stop offset="1" :stop-color="ORANGE" stop-opacity="0.2" />
        </radialGradient>
        <filter :id="`${uid}-glow`" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter :id="`${uid}-soft`" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
        <linearGradient
          v-for="spoke in spokes"
          :id="spoke.gradient"
          :key="spoke.gradient"
          gradientUnits="userSpaceOnUse"
          :x1="spoke.inner.x"
          :y1="spoke.inner.y"
          :x2="spoke.outer.x + 0.01"
          :y2="spoke.outer.y + 0.01"
        >
          <stop offset="0" :stop-color="TEAL" />
          <stop offset="1" :stop-color="ORANGE" />
        </linearGradient>
      </defs>

      <circle :cx="CX" :cy="CY" :r="OUTER" fill="none" stroke="#1c2840" />
      <line v-for="(guide, index) in guides" :key="index" :x1="guide.from.x" :y1="guide.from.y" :x2="guide.to.x" :y2="guide.to.y" stroke="#8a96b0" stroke-opacity=".1" />
      <circle :cx="CX" :cy="CY" :r="INNER" fill="none" stroke="#f7ecd2" stroke-opacity=".34" stroke-dasharray="3 6" stroke-width="1.2" />

      <template v-if="blob">
        <path :d="blob" :fill="`url(#${uid}-blob)`" />
        <path :d="blob" fill="none" :stroke="ORANGE" stroke-width="5" stroke-opacity=".35" :filter="`url(#${uid}-soft)`" />
        <path :d="blob" fill="none" :stroke="ORANGE" stroke-width="1.8" stroke-linejoin="round" />
      </template>

      <g
        v-for="spoke in spokes"
        :key="spoke.topic.id"
        class="spoke"
        :class="{ sel: spoke.selected }"
        tabindex="0"
        role="button"
        :aria-label="spoke.topic.name"
        :aria-pressed="spoke.selected"
        @click="emit('select', spoke.topic.id)"
        @keydown.enter.prevent="emit('select', spoke.topic.id)"
        @keydown.space.prevent="emit('select', spoke.topic.id)"
      >
        <line :x1="spoke.inner.x" :y1="spoke.inner.y" :x2="spoke.outer.x" :y2="spoke.outer.y" stroke="transparent" stroke-width="30" stroke-linecap="round" />
        <template v-if="spoke.crack">
          <line :x1="spoke.inner.x" :y1="spoke.inner.y" :x2="spoke.crack.from.x" :y2="spoke.crack.from.y" :stroke="`url(#${spoke.gradient})`" :stroke-width="spoke.width" stroke-linecap="round" />
          <line :x1="spoke.crack.to.x" :y1="spoke.crack.to.y" :x2="spoke.outer.x" :y2="spoke.outer.y" :stroke="`url(#${spoke.gradient})`" :stroke-width="spoke.width" stroke-linecap="round" />
          <circle
            class="break"
            :cx="(spoke.crack.from.x + spoke.crack.to.x) / 2"
            :cy="(spoke.crack.from.y + spoke.crack.to.y) / 2"
            r="9"
            fill="none"
            stroke="#fff4e6"
            stroke-width="1.6"
            :filter="`url(#${uid}-glow)`"
          />
        </template>
        <line
          v-else-if="!spoke.hidden"
          :x1="spoke.inner.x"
          :y1="spoke.inner.y"
          :x2="spoke.outer.x"
          :y2="spoke.outer.y"
          :stroke="`url(#${spoke.gradient})`"
          :stroke-width="spoke.width"
          :stroke-opacity="spoke.opacity"
          :stroke-dasharray="spoke.dash"
          stroke-linecap="round"
        />
        <text class="lab" :x="spoke.label.x" :y="spoke.label.y" :text-anchor="spoke.label.anchor">{{ spoke.topic.label }}</text>
        <circle :cx="spoke.inner.x" :cy="spoke.inner.y" v-bind="spoke.agency" stroke-width="1.8" :filter="`url(#${uid}-glow)`" />
        <circle :cx="spoke.outer.x" :cy="spoke.outer.y" v-bind="spoke.client" stroke-width="1.8" :filter="`url(#${uid}-glow)`" />
      </g>
    </svg>
    <canvas ref="dust" aria-hidden="true" />
    <div class="center">
      <span class="state">{{ word }}</span>
      <span class="pct">{{ detail }}</span>
    </div>
    <span v-if="moves" ref="orb" class="glow" aria-hidden="true" />
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  aspect-ratio: 1 / 0.97;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}

svg,
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

svg {
  overflow: visible;
}

canvas {
  pointer-events: none;
  z-index: 2;
}

.center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 30%;
  text-align: center;
  pointer-events: none;
  display: grid;
  gap: 4px;
  z-index: 1;
  padding: 22px 8px;
  background: radial-gradient(closest-side, rgba(7, 11, 20, 0.92), rgba(7, 11, 20, 0.6) 65%, rgba(7, 11, 20, 0));
}

.state {
  font: italic 300 clamp(15px, 2.2vw, 24px) / 1.15 var(--serif);
  color: var(--lit);
  text-wrap: balance;
}

.pct {
  font-size: clamp(11px, 1.2vw, 13px);
  color: var(--dim);
}

.spoke {
  cursor: pointer;
  outline: none;
}

.spoke circle {
  transition: fill 0.6s ease, stroke 0.6s ease;
}

.lab {
  font: 500 13px var(--sans);
  fill: var(--dim);
  transition: fill 0.2s;
}

.spoke:hover .lab,
.spoke.sel .lab {
  fill: var(--lit);
}

.spoke.sel .lab {
  font-weight: 600;
}

.spoke:focus-visible .lab {
  fill: var(--gold);
  text-decoration: underline;
}

.break {
  transform-box: fill-box;
  transform-origin: center;
  animation: throb 1.8s ease-in-out infinite alternate;
}

@keyframes throb {
  from {
    transform: scale(0.6);
  }
  to {
    transform: scale(1.25);
  }
}

.glow {
  position: absolute;
  left: 0;
  top: 0;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 3;
  will-change: transform;
  background: #fff1ec;
  box-shadow:
    0 0 10px 4px rgba(255, 228, 220, 0.55),
    0 0 34px 14px rgba(255, 156, 145, 0.34),
    0 0 70px 30px rgba(201, 182, 240, 0.14);
}

@media (max-width: 520px) {
  .lab {
    font-size: 21px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .break {
    animation: none;
  }
}
</style>
