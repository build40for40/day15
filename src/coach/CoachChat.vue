<script setup lang="ts">
import { useObject } from '@ai-sdk/vue'
import { computed, ref } from 'vue'

import { LENSES, lensById, type LensId } from './lenses'
import { coachReplySchema, MAX_ANSWER_LENGTH, MAX_PROJECT_LENGTH, type Party, type Turn } from './schema'

const props = defineProps<{ party: Party }>()

const project = ref('')
const started = ref(false)
// Start in the person's own seat, then let them move around the table.
const lens = ref<LensId>(props.party)
const askedLens = ref<LensId>(lens.value)
const turns = ref<Turn[]>([])
const answer = ref('')

const { submit, object, isLoading, error, stop } = useObject({
  api: `${import.meta.env.BASE_URL}api/coach`,
  schema: coachReplySchema,
})

const question = computed(() => object.value?.question ?? '')

function askNext() {
  askedLens.value = lens.value
  submit({ party: props.party, lens: lens.value, project: project.value.trim(), turns: turns.value })
}

function start() {
  if (!project.value.trim()) return
  started.value = true
  askNext()
}

function reply() {
  const text = answer.value.trim()
  if (!text || !question.value || isLoading.value) return
  turns.value.push({ lens: askedLens.value, question: question.value, answer: text })
  answer.value = ''
  askNext()
}

function pickLens(id: LensId) {
  if (id === lens.value) return
  lens.value = id
  if (!started.value) return
  // Swap the question on the table for one from the new seat.
  if (isLoading.value) stop()
  askNext()
}
</script>

<template>
  <form v-if="!started" class="stack" @submit.prevent="start">
    <label for="project">First, what's the project? A few sentences in your own words will do.</label>
    <textarea id="project" v-model="project" rows="5" :maxlength="MAX_PROJECT_LENGTH" required />
    <button type="submit">Start</button>
  </form>

  <template v-else>
    <fieldset class="lenses">
      <legend>Whose chair is the coach sitting in?</legend>
      <button
        v-for="option in LENSES"
        :key="option.id"
        type="button"
        :aria-pressed="option.id === lens"
        @click="pickLens(option.id)"
      >
        {{ option.name }}
      </button>
      <p class="blurb">{{ lensById(lens).blurb }}</p>
    </fieldset>

    <ol v-if="turns.length" class="turns">
      <li v-for="(turn, index) in turns" :key="index">
        <p class="asked">
          <span class="tag">{{ lensById(turn.lens).name }}</span>
          {{ turn.question }}
        </p>
        <p class="said">{{ turn.answer }}</p>
      </li>
    </ol>

    <section class="now" aria-live="polite">
      <p v-if="error" role="alert">{{ error.message }}</p>
      <template v-else-if="question">
        <p class="asked">
          <span class="tag">{{ lensById(askedLens).name }}</span>
          {{ question }}
        </p>
        <p v-if="object?.why" class="why">{{ object.why }}</p>
      </template>
      <p v-else>The coach is thinking…</p>
    </section>

    <form class="stack" @submit.prevent="reply">
      <label for="answer">Your answer. Only the coach reads this.</label>
      <textarea id="answer" v-model="answer" rows="4" :maxlength="MAX_ANSWER_LENGTH" required />
      <button type="submit" :disabled="isLoading || !question">{{ isLoading ? 'Thinking…' : 'Answer' }}</button>
    </form>
  </template>
</template>

<style scoped>
.stack {
  display: grid;
  gap: 0.5rem;
}

textarea {
  width: 100%;
  padding: 0.75rem;
  font: inherit;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: var(--card);
  color: inherit;
}

button {
  min-height: 44px;
  padding: 0 1.25rem;
  font: inherit;
  border: 1px solid var(--ink);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink);
  cursor: pointer;
}

button[type='submit'],
button[aria-pressed='true'] {
  background: var(--ink);
  color: var(--paper);
}

button:disabled {
  opacity: 0.5;
  cursor: default;
}

.stack button {
  justify-self: start;
}

.lenses {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 0 1.5rem;
  padding: 0;
  border: 0;
}

.lenses legend {
  margin-bottom: 0.5rem;
  padding: 0;
}

.blurb {
  flex-basis: 100%;
  margin: 0;
  color: var(--muted);
}

.turns {
  display: grid;
  gap: 1rem;
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
}

.turns li {
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--line);
}

p {
  margin: 0;
  overflow-wrap: anywhere;
}

.said {
  margin-top: 0.25rem;
  color: var(--muted);
}

.now {
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--card);
  border: 1px solid var(--line);
}

.now .asked {
  font-size: 1.2rem;
  line-height: 1.35;
}

.why {
  margin-top: 0.5rem;
  color: var(--muted);
  font-size: 0.9rem;
}

.tag {
  display: inline-block;
  margin-right: 0.25rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  background: var(--accent);
  color: var(--ink);
  font-size: 0.8rem;
  vertical-align: 0.1em;
}
</style>
