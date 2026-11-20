<script setup lang="ts">
import { LENS_IDS, LENS_NAMES, type LensId } from '@day15/shared/lenses'
import { MAX_JOB_TITLE_LENGTH, MAX_NOTES_LENGTH, MAX_ORGANISATION_LENGTH } from '@day15/shared/schema'

export interface More {
  jobTitle: string
  organisation: string
  lenses: LensId[]
  notes: string
}

defineProps<{
  /** The company they'd be assumed to work for, shown as the placeholder. */
  assumedCompany: string
  /** Set to hide the job title, when it was already asked for above. */
  skipJobTitle?: boolean
}>()

const more = defineModel<More>({ required: true })
const emit = defineEmits<{ lensesTouched: [] }>()
</script>

<template>
  <details class="more">
    <summary>More about them <span class="hint">(optional, but it makes the coach sharper)</span></summary>
    <div class="body">
      <label v-if="!skipJobTitle">
        <span class="q">Job title</span>
        <input v-model="more.jobTitle" :maxlength="MAX_JOB_TITLE_LENGTH" autocomplete="off" placeholder="Head of Making Things Happen" />
      </label>
      <label>
        <span class="q">Company</span>
        <input v-model="more.organisation" :maxlength="MAX_ORGANISATION_LENGTH" autocomplete="off" :placeholder="assumedCompany || 'Their company'" />
        <span class="hint">Only if it's not {{ assumedCompany || 'their side' }}, like a freelancer or a parent company.</span>
      </label>
      <fieldset>
        <legend class="q">What do they care about most?</legend>
        <p class="hint">
          The coach has five advisers: money, delivery, agency, client and procurement. Tick whichever speak for what this
          person cares about. I've started you off from their role.
        </p>
        <div class="pills">
          <label v-for="lens in LENS_IDS" :key="lens" class="pill">
            <input v-model="more.lenses" type="checkbox" :value="lens" class="sr-only" @change="emit('lensesTouched')" />
            <span>{{ LENS_NAMES[lens] }}</span>
          </label>
        </div>
      </fieldset>
      <label>
        <span class="q">Anything the coach should know?</span>
        <textarea
          v-model="more.notes"
          rows="3"
          :maxlength="MAX_NOTES_LENGTH"
          placeholder="Who they report to, what they sign off, how they like their feedback"
        />
      </label>
    </div>
  </details>
</template>

<style scoped>
.more {
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: var(--card);
}

summary {
  cursor: pointer;
  padding: 0.75rem;
  min-height: 2.75rem;
  font-weight: 600;
  list-style-position: inside;
}

summary .hint {
  font-weight: 400;
}

.body {
  display: grid;
  gap: 1rem;
  padding: 0 0.75rem 0.75rem;
}

label,
fieldset {
  display: grid;
  gap: 0.35rem;
}

fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}

legend {
  padding: 0;
  margin-bottom: 0.35rem;
}

.q {
  font-weight: 600;
}

.hint {
  font-size: 0.875rem;
  margin: 0;
}

input:not([type]),
textarea {
  background: var(--paper);
  font-size: 1rem;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pill {
  display: block;
}

.pill span {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.pill input:checked + span {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
  font-weight: 600;
}

.pill input:focus-visible + span {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pill span {
    transition: none;
  }
}
</style>
