<script setup lang="ts">
import { TOPICS } from '@day15/shared/schema'

import AlignmentCircle from './AlignmentCircle.vue'
import { overall, topicStates, type RoomView } from './circle'

const emit = defineEmits<{ signIn: [] }>()

const said = (topic: string, side: string) => ({ topic, side, status: 'confirmed', basedOn: [] })
const open = (topic: string, priority: number, askSide: string) => ({ topic, priority, askSide, basedOn: [] })

const sample = topicStates({
  facts: [
    ...TOPICS.filter((topic) => topic !== 'legal_ip').map((topic) => said(topic, 'client')),
    ...TOPICS.filter((topic) => !['legal_ip', 'kpis', 'other'].includes(topic)).map((topic) => said(topic, 'agency')),
  ],
  openQuestions: [open('budget', 1, 'both'), open('timeline', 2, 'client'), open('audience', 2, 'agency')],
  asks: [],
} as unknown as RoomView)
const summary = overall(sample)
</script>

<template>
  <section class="sign-in">
    <div class="hero">
      <h2>The shape of your agreement.</h2>
      <p class="lede">
        You and your client just shook on a pitch. Before the budget gets spent, a coach has a quiet word with
        everyone, through their own AI, and finds the holes while they're still cheap to fill.
      </p>
      <p class="muted">Agencies sign in here to set up a project, invite the people in it and watch the circle close.</p>
      <button type="button" @click="emit('signIn')">Sign in</button>
    </div>
    <figure aria-label="A sample project's circle">
      <AlignmentCircle :topics="sample" :selected="null" :word="summary.word" detail="A sample project" inert />
    </figure>
  </section>
</template>

<style scoped>
.sign-in {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: clamp(20px, 4vw, 56px);
  align-items: center;
  padding-top: clamp(8px, 3vw, 40px);
}

.hero {
  display: grid;
  gap: 14px;
  justify-items: start;
}

h2 {
  margin: 0;
  font: 300 clamp(34px, 5.2vw, 58px) / 1.08 var(--serif);
  text-wrap: balance;
}

p {
  margin: 0;
}

.lede {
  font: 300 clamp(17px, 1.7vw, 20px) / 1.55 var(--serif);
  max-width: 38rem;
}

figure {
  margin: 0;
  min-width: 0;
  padding: 0 clamp(0px, 4vw, 40px);
}

@media (max-width: 860px) {
  .sign-in {
    grid-template-columns: 1fr;
  }

  figure {
    padding: 24px 30px;
  }
}
</style>
