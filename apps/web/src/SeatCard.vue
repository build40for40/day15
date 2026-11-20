<script setup lang="ts">
import { MAX_NAME_LENGTH } from '@day15/shared/schema'

import type { Guest } from './onboarding'
import PersonMore from './PersonMore.vue'

defineProps<{
  /** "Client rep" or "Client procurement". */
  role: string
  /** What this seat does on the project, in a line. */
  does: string
  placeholder: string
  assumedCompany: string
  autofocus?: boolean
}>()

const person = defineModel<Guest>({ required: true })
</script>

<template>
  <section class="seat" :aria-label="role">
    <header>
      <h3>{{ role }}</h3>
      <p class="hint">{{ does }}</p>
    </header>
    <label>
      <span class="q">Their name</span>
      <input v-model="person.name" :data-focus="autofocus || undefined" :maxlength="MAX_NAME_LENGTH" autocomplete="off" :placeholder="placeholder" />
    </label>
    <label>
      <span class="q">Their job title</span>
      <input v-model="person.jobTitle" autocomplete="off" placeholder="Optional" />
    </label>
    <PersonMore v-model="person" :assumed-company="assumedCompany" skip-job-title />
    <label v-if="person.name.trim()" class="check">
      <input v-model="person.link" type="checkbox" />
      I'll send {{ person.name.trim().split(/\s+/)[0] }} their link
    </label>
  </section>
</template>

<style scoped>
.seat {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--paper);
}

header {
  display: grid;
}

h3 {
  margin: 0;
  font-size: 1.0625rem;
}

header .hint {
  margin: 0;
}

label {
  display: grid;
  gap: 0.35rem;
}

.q {
  font-weight: 600;
}

.hint {
  font-size: 0.875rem;
}

input:not([type]) {
  background: var(--card);
  font-size: 1.0625rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.check input {
  min-height: auto;
  width: 1.1rem;
  height: 1.1rem;
}
</style>
