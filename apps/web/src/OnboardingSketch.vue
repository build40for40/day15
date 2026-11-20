<script setup lang="ts">
import { PERSONA_NAMES, SIDES, type Side } from '@day15/shared/schema'
import { computed } from 'vue'

import type { Seat } from './onboarding'

const props = defineProps<{
  projectName: string
  agencyName: string
  clientName: string
  seats: Seat[]
}>()

const sides = computed(() =>
  SIDES.map((side) => ({
    side,
    title: (side === 'agency' ? props.agencyName : props.clientName).trim() || (side === 'agency' ? 'Your agency' : 'The client'),
    named: Boolean((side === 'agency' ? props.agencyName : props.clientName).trim()),
    people: props.seats.filter((seat) => seat.details.side === side && seat.details.name),
  })),
)

const waiting = (side: Side) => (side === 'agency' ? 'Just you so far' : 'Waiting to hear who')
</script>

<template>
  <aside class="sketch" aria-label="Your project so far">
    <p class="eyebrow">Your project so far</p>
    <h3 :class="{ empty: !projectName.trim() }">{{ projectName.trim() || 'Untitled project' }}</h3>
    <p class="for">
      <template v-if="clientName.trim()">for {{ clientName.trim() }}</template>
      <template v-else>for a client you'll tell me about</template>
    </p>

    <div class="sides">
      <section v-for="column in sides" :key="column.side" :class="['side', column.side]">
        <h4 :class="{ empty: !column.named }">{{ column.title }}</h4>
        <TransitionGroup tag="ul" name="pop">
          <li v-for="seat in column.people" :key="seat.key">
            <span class="avatar" aria-hidden="true">{{ seat.details.name.charAt(0).toUpperCase() }}</span>
            <span class="who">
              <span class="name">{{ seat.details.name }}</span>
              <span class="role">{{ PERSONA_NAMES[seat.details.persona] }}{{ seat.you ? ', you' : '' }}</span>
            </span>
          </li>
        </TransitionGroup>
        <p v-if="column.people.length < (column.side === 'agency' ? 2 : 1)" class="slot">{{ waiting(column.side) }}</p>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.sketch {
  background: var(--card);
  border: 1px dashed var(--line);
  border-radius: 1rem;
  padding: 1.25rem;
  display: grid;
  gap: 0.25rem;
  align-content: start;
}

.eyebrow {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

h3 {
  margin: 0.25rem 0 0;
  font-family: ui-serif, Georgia, serif;
  font-size: 1.5rem;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

h3.empty,
h4.empty {
  color: var(--muted);
  font-weight: 400;
  font-style: italic;
}

.for {
  margin: 0 0 1rem;
  color: var(--muted);
  overflow-wrap: anywhere;
}

.sides {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
}

.side {
  display: grid;
  gap: 0.5rem;
  align-content: start;
  min-width: 0;
  padding-top: 0.75rem;
  border-top: 3px solid var(--line);
}

.side.agency {
  border-top-color: var(--accent);
}

h4 {
  margin: 0;
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--accent);
  color: #1c1d22;
  font-weight: 700;
  font-size: 0.875rem;
}

.client .avatar {
  background: transparent;
  border: 2px solid var(--ink);
  color: var(--ink);
}

.who {
  display: grid;
  min-width: 0;
  line-height: 1.25;
}

.name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.role {
  font-weight: 400;
  font-size: 0.8125rem;
  color: var(--muted);
}

.slot {
  margin: 0;
  padding: 0.5rem 0.6rem;
  border: 1px dashed var(--line);
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  color: var(--muted);
}

.pop-enter-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.pop-leave-active {
  transition: opacity 0.2s ease;
}

.pop-enter-from {
  opacity: 0;
  transform: translateY(0.5rem) scale(0.96);
}

.pop-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pop-enter-active,
  .pop-leave-active {
    transition: none;
  }
}
</style>
