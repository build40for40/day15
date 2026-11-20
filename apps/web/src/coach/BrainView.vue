<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import type { LensId } from '@day15/shared/lenses'
import { brainViewSchema, PARTIES, type BrainView } from '@day15/shared/schema'

const props = defineProps<{ projectId: string }>()

const HATS: Record<LensId, string> = {
  cfo: 'Money',
  cto: 'Delivery',
  agency: 'Agency',
  client: 'Client',
  procurement: 'Procurement',
}

const view = ref<BrainView | null>(null)
const failed = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/projects/${props.projectId}/brain`)
    if (!response.ok) throw new Error(`The API answered ${response.status}`)
    view.value = brainViewSchema.parse(await response.json())
    failed.value = false
  } catch {
    failed.value = true
  }
}

onMounted(() => {
  load()
  timer = setInterval(load, 5000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <p v-if="failed" role="alert">Can't read that project's brain. Check the link.</p>
  <p v-else-if="!view">Opening the brain…</p>
  <div v-else class="sides">
    <section v-for="party in PARTIES" :key="party">
      <h2>{{ party }} side</h2>
      <p v-if="!view[party]" class="quiet">Hasn't spoken to the coach yet.</p>
      <template v-else>
        <p class="quiet">"{{ view[party]!.project }}"</p>
        <ol>
          <li v-for="(turn, index) in view[party]!.turns" :key="index">
            <p><span class="hat">{{ HATS[turn.lens] }}</span> {{ turn.question }}</p>
            <p v-if="turn.rationale" class="rationale">{{ turn.rationale }}</p>
            <p class="said">{{ turn.answer }}</p>
          </li>
          <li v-if="view[party]!.pending" class="waiting">
            <p><span class="hat">{{ HATS[view[party]!.pending!.lens] }}</span> {{ view[party]!.pending!.question }}</p>
            <p class="rationale">{{ view[party]!.pending!.rationale }}</p>
            <p class="quiet">Waiting for their answer.</p>
          </li>
        </ol>
      </template>
    </section>
  </div>
</template>

<style scoped>
.sides {
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  text-transform: capitalize;
}

ol {
  display: grid;
  gap: 1rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

li {
  display: grid;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--card);
}

.waiting {
  border-style: dashed;
}

p {
  margin: 0;
  overflow-wrap: anywhere;
}

.hat {
  display: inline-block;
  margin-right: 0.25rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  background: var(--accent);
  color: #1c1d22;
  font-size: 0.8rem;
  vertical-align: 0.1em;
}

.rationale {
  padding-left: 0.75rem;
  border-left: 3px solid var(--accent);
  font-size: 0.9rem;
}

.said,
.quiet {
  color: var(--muted);
}
</style>
