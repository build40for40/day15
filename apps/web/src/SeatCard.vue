<script setup lang="ts">
import { MAX_NAME_LENGTH, PERSONA_LENS, PERSONAS } from '@day15/shared/schema'
import { ref, watch } from 'vue'

import { PERSONA_NUDGES, roleName, type Guest } from './onboarding'
import PersonMore from './PersonMore.vue'

const props = defineProps<{
  /** The seat's name, like "Client rep". Not needed when the role can be chosen. */
  role?: string
  /** What this seat does on the project, in a line. */
  does?: string
  placeholder: string
  assumedCompany: string
  autofocus?: boolean
  /** Extra teammates pick their own role and can be removed. */
  extra?: boolean
}>()

const emit = defineEmits<{ remove: [] }>()
const person = defineModel<Guest>({ required: true })

// Until someone ticks an adviser by hand, the advisers follow the role.
const touched = ref(false)
watch(
  () => person.value.persona,
  (persona) => {
    if (!touched.value) person.value.lenses = [PERSONA_LENS[persona]]
  },
)
</script>

<template>
  <section class="seat" :aria-label="role ?? roleName(person.persona, person.side)">
    <header>
      <template v-if="extra">
        <label class="role-pick">
          <span class="q">Their role</span>
          <select v-model="person.persona">
            <option v-for="persona in PERSONAS" :key="persona" :value="persona">{{ roleName(persona, person.side) }}</option>
          </select>
        </label>
        <p class="nudge">{{ PERSONA_NUDGES[person.persona] }}</p>
      </template>
      <template v-else>
        <h3>{{ role }}</h3>
        <p v-if="does" class="hint">{{ does }}</p>
        <p class="nudge">{{ PERSONA_NUDGES[person.persona] }}</p>
      </template>
    </header>
    <label>
      <span class="q">Their name</span>
      <input v-model="person.name" :data-focus="autofocus || undefined" :maxlength="MAX_NAME_LENGTH" autocomplete="off" :placeholder="placeholder" />
    </label>
    <label>
      <span class="q">Their job title</span>
      <input v-model="person.jobTitle" autocomplete="off" placeholder="Optional" />
    </label>
    <PersonMore v-model="person" :assumed-company="assumedCompany" skip-job-title @lenses-touched="touched = true" />
    <div class="foot">
      <label v-if="person.name.trim()" class="check">
        <input v-model="person.link" type="checkbox" />
        I'll send {{ person.name.trim().split(/\s+/)[0] }} their link
      </label>
      <button v-if="extra" type="button" class="quiet small" :aria-label="`Remove ${person.name.trim() || 'this person'}`" @click="emit('remove')">
        Remove
      </button>
    </div>
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
  background: color-mix(in srgb, var(--midnight) 55%, transparent);
}

header {
  display: grid;
  gap: 0.15rem;
}

h3 {
  margin: 0;
  font-size: 1.0625rem;
}

header .hint {
  margin: 0;
}

.nudge {
  margin: 0;
  font-size: 0.875rem;
  font-style: italic;
  color: var(--accent);
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
  background: var(--raise);
  font-size: 1.0625rem;
}

.role-pick select {
  background: var(--raise);
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.foot .quiet {
  margin-left: auto;
}

.small {
  min-height: 2.25rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.875rem;
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
