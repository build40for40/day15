<script setup lang="ts">
import { useObject } from '@ai-sdk/vue'
import { computed, onMounted, ref } from 'vue'

import {
  coachReplySchema,
  MAX_ANSWER_LENGTH,
  MAX_PROJECT_LENGTH,
  mySideSchema,
  type Party,
  type Turn,
} from '@day15/shared/schema'

const props = defineProps<{ party: Party; projectId: string }>()

const base = `${import.meta.env.BASE_URL}api/projects/${props.projectId}`

const loaded = ref(false)
const missing = ref(false)
const started = ref(false)
const project = ref('')
const turns = ref<Turn[]>([])
const answer = ref('')

const { submit, object, isLoading, error } = useObject({ api: `${base}/coach`, schema: coachReplySchema })

const question = computed(() => object.value?.question ?? '')

/** Asks for the next question, handing over the answer just given, if there is one. */
function askNext(turn?: Turn) {
  submit({ party: props.party, project: project.value.trim(), turn })
}

// Pick up where this side left off, so a refresh or a shared link doesn't start again.
onMounted(async () => {
  try {
    const response = await fetch(`${base}/${props.party}`)
    if (!response.ok) throw new Error(`The API answered ${response.status}`)
    const mine = mySideSchema.parse(await response.json())
    if (mine.project) {
      project.value = mine.project
      turns.value = mine.turns
      started.value = true
      askNext()
    }
  } catch {
    missing.value = true
  }
  loaded.value = true
})

function start() {
  if (!project.value.trim()) return
  started.value = true
  askNext()
}

function reply() {
  const text = answer.value.trim()
  const lens = object.value?.lens
  if (!text || !question.value || !lens || isLoading.value) return
  const turn: Turn = { lens, question: question.value, answer: text }
  turns.value.push(turn)
  answer.value = ''
  askNext(turn)
}
</script>

<template>
  <p v-if="!loaded">Finding your seat…</p>
  <p v-else-if="missing" role="alert">That project link doesn't lead anywhere. Check it, or start a new one.</p>

  <form v-else-if="!started" class="stack" @submit.prevent="start">
    <label for="project">First, what's the project? A few sentences in your own words will do.</label>
    <textarea id="project" v-model="project" rows="5" :maxlength="MAX_PROJECT_LENGTH" required />
    <button type="submit">Start</button>
  </form>

  <template v-else>
    <ol v-if="turns.length" class="turns">
      <li v-for="(turn, index) in turns" :key="index">
        <p class="asked">{{ turn.question }}</p>
        <p class="said">{{ turn.answer }}</p>
      </li>
    </ol>

    <section class="now" aria-live="polite">
      <p v-if="error" role="alert">{{ error.message }}</p>
      <template v-else-if="question">
        <p class="asked">{{ question }}</p>
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
  justify-self: start;
  min-height: 44px;
  padding: 0 1.25rem;
  font: inherit;
  border: 1px solid var(--ink);
  border-radius: 999px;
  background: var(--ink);
  color: var(--paper);
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: default;
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
</style>
