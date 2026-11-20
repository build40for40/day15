<script setup lang="ts">
import { computed } from 'vue'

import type { Coverage, TopicState } from './circle'

const props = defineProps<{ topic: TopicState }>()

const TEAL = '#46d6c8'
const ORANGE = '#ffae6b'
const GREEN = '#5de0a8'

const glyph = computed(() => {
  const { topic } = props
  const gap = topic.lit ? Math.round(34 * Math.min(1, (1 - topic.score) / 0.7)) : 18
  const merged = gap < 4
  const done = merged && topic.bucket === 'decided'
  const ball = (level: Coverage, colour: string) => ({
    fill: level === 'missing' ? '#070b14' : colour,
    'fill-opacity': level === 'thin' ? 0.38 : 1,
    stroke: colour,
  })
  return {
    from: 27 - gap / 2,
    to: 27 + gap / 2,
    gap,
    merged,
    crack: topic.bucket === 'crack',
    dash: topic.bucket === 'decided' ? undefined : topic.bucket === 'talked' && topic.lit ? '3 3' : '1 4',
    agency: { ...ball(topic.coverage.agency, done ? GREEN : TEAL), r: merged ? 9 : 6.5 },
    client: {
      ...ball(topic.coverage.client, done ? GREEN : ORANGE),
      r: merged ? 5.5 : 6.5,
      'stroke-opacity': topic.lit ? 1 : 0.45,
      'stroke-dasharray': topic.lit ? undefined : '2 2',
    },
  }
})
</script>

<template>
  <svg class="pair" viewBox="0 0 54 22" aria-hidden="true">
    <template v-if="!glyph.merged">
      <template v-if="glyph.crack">
        <line :x1="glyph.from" y1="11" :x2="glyph.from + glyph.gap * 0.4" y2="11" stroke="#fff4e6" stroke-width="1.6" />
        <line :x1="glyph.from + glyph.gap * 0.62" y1="11" :x2="glyph.to" y2="11" stroke="#fff4e6" stroke-width="1.6" />
      </template>
      <line v-else :x1="glyph.from" y1="11" :x2="glyph.to" y2="11" stroke="#8a96b0" stroke-width="1.6" :stroke-dasharray="glyph.dash" />
    </template>
    <circle :cx="glyph.from" cy="11" v-bind="glyph.agency" stroke-width="1.5" />
    <circle :cx="glyph.to" cy="11" v-bind="glyph.client" stroke-width="1.5" />
  </svg>
</template>

<style scoped>
.pair {
  width: 100%;
  height: 22px;
  overflow: visible;
}
</style>
