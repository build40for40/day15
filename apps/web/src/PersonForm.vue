<script setup lang="ts">
import { LENS_IDS, LENS_NAMES } from '@day15/shared/lenses'
import {
  MAX_JOB_TITLE_LENGTH,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_ORGANISATION_LENGTH,
  PERSONA_LENS,
  PERSONA_NAMES,
  PERSONAS,
  SIDES,
} from '@day15/shared/schema'
import { reactive, ref, watch } from 'vue'

import type { PersonDetails } from './api'

const props = defineProps<{
  initial: PersonDetails
  submitLabel: string
  busy: boolean
  /** While the lenses are untouched, they follow the persona. For new people only. */
  lensesFollowPersona?: boolean
}>()

const emit = defineEmits<{ submit: [details: PersonDetails] }>()

const draft = reactive<PersonDetails>({ ...props.initial, lenses: [...props.initial.lenses] })
const lensesTouched = ref(false)

watch(
  () => draft.persona,
  (persona) => {
    if (props.lensesFollowPersona && !lensesTouched.value) draft.lenses = [PERSONA_LENS[persona]]
  },
)

const submit = () => emit('submit', { ...draft, lenses: [...draft.lenses] })
</script>

<template>
  <form class="person-form" @submit.prevent="submit">
    <label>
      Name
      <input v-model="draft.name" name="name" required :maxlength="MAX_NAME_LENGTH" autocomplete="off" />
    </label>
    <label>
      Job title
      <input v-model="draft.jobTitle" name="jobTitle" :maxlength="MAX_JOB_TITLE_LENGTH" placeholder="Head of Making Things Happen" />
    </label>
    <label>
      Organisation
      <input v-model="draft.organisation" name="organisation" :maxlength="MAX_ORGANISATION_LENGTH" />
    </label>
    <div class="pair">
      <label>
        Side
        <select v-model="draft.side" name="side">
          <option v-for="side in SIDES" :key="side" :value="side">{{ side === 'agency' ? 'Agency' : 'Client' }}</option>
        </select>
      </label>
      <label>
        Persona
        <select v-model="draft.persona" name="persona">
          <option v-for="persona in PERSONAS" :key="persona" :value="persona">{{ PERSONA_NAMES[persona] }}</option>
        </select>
      </label>
    </div>
    <fieldset>
      <legend>Speaks for</legend>
      <p class="hint">Which of the coach's three advisers carry what this person cares about. Tick as many as fit.</p>
      <label v-for="lens in LENS_IDS" :key="lens" class="check">
        <input v-model="draft.lenses" type="checkbox" :value="lens" @change="lensesTouched = true" />
        {{ LENS_NAMES[lens] }}
      </label>
    </fieldset>
    <label>
      Notes
      <textarea
        v-model="draft.notes"
        name="notes"
        rows="3"
        :maxlength="MAX_NOTES_LENGTH"
        placeholder="Who they report to, what they sign off, how they like their feedback"
      />
    </label>
    <slot />
    <button type="submit" :disabled="busy || !draft.name.trim()">{{ submitLabel }}</button>
  </form>
</template>

<style scoped>
.person-form {
  display: grid;
  gap: 0.75rem;
}

label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.pair {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
}

fieldset {
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem 0.75rem;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  min-width: 0;
}

legend {
  font-size: 0.875rem;
  padding: 0 0.25rem;
}

fieldset .hint {
  flex-basis: 100%;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1rem;
}

.check input {
  min-height: auto;
  width: 1.1rem;
  height: 1.1rem;
}
</style>
