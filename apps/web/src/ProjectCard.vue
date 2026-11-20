<script setup lang="ts">
import { PERSONAS, PERSONA_NAMES, SIDES, type Persona, type Side } from '@day15/shared/schema'
import { reactive, ref } from 'vue'

import { addPerson, freshAddress, type Project } from './api'

const props = defineProps<{ project: Project }>()

const addresses = reactive<Record<number, string>>({})
const copied = ref<number | null>(null)
const name = ref('')
const persona = ref<Persona>('agency_lead')
const side = ref<Side>('agency')
const busy = ref(false)
const error = ref('')

async function guard(run: () => Promise<void>) {
  busy.value = true
  error.value = ''
  try {
    await run()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Something went wrong.'
  } finally {
    busy.value = false
  }
}

const add = () =>
  guard(async () => {
    const { participant, address } = await addPerson(props.project.id, {
      name: name.value,
      persona: persona.value,
      side: side.value,
    })
    props.project.participants.push(participant)
    addresses[participant.id] = address
    name.value = ''
  })

const renew = (id: number) =>
  guard(async () => {
    addresses[id] = (await freshAddress(props.project.id, id)).address
  })

async function copy(id: number) {
  const address = addresses[id]
  if (!address) return
  try {
    await navigator.clipboard.writeText(address)
    copied.value = id
  } catch {
    error.value = 'Your browser would not copy it. Select the address and copy it by hand.'
  }
}
</script>

<template>
  <section class="project">
    <h3>{{ project.name }}</h3>

    <p v-if="project.participants.length === 0" class="muted">Nobody here yet. Add the first person below.</p>

    <ul class="people">
      <li v-for="person in project.participants" :key="person.id" class="person">
        <p class="who">
          <strong>{{ person.name }}</strong>
          <span class="muted">{{ PERSONA_NAMES[person.persona] }}, {{ person.side }} side</span>
        </p>

        <template v-if="addresses[person.id]">
          <input class="address" readonly :value="addresses[person.id]" aria-label="MCP address" @focus="($event.target as HTMLInputElement).select()" />
          <button type="button" @click="copy(person.id)">{{ copied === person.id ? 'Copied' : 'Copy address' }}</button>
          <p class="hint">In Claude: Settings, Connectors, Add custom connector, paste the address.</p>
          <p class="hint">In ChatGPT: Settings, Connectors, add a custom connector with the address.</p>
          <p class="hint">It works like a password: anyone holding it speaks as {{ person.name }}.</p>
        </template>
        <template v-else>
          <p class="hint">We only keep a scrambled copy, so we can't show this address again.</p>
          <button type="button" class="quiet" :disabled="busy" @click="renew(person.id)">Get a fresh address</button>
          <p class="hint">The old one stops working the moment you do.</p>
        </template>
      </li>
    </ul>

    <form class="add" @submit.prevent="add">
      <h4>Add a person</h4>
      <label>
        Name
        <input v-model="name" required maxlength="80" autocomplete="off" />
      </label>
      <label>
        Persona
        <select v-model="persona">
          <option v-for="p in PERSONAS" :key="p" :value="p">{{ PERSONA_NAMES[p] }}</option>
        </select>
      </label>
      <label>
        Side
        <select v-model="side">
          <option v-for="s in SIDES" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
      <button type="submit" :disabled="busy || !name.trim()">Add and get their address</button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.project {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-top: 1rem;
}

h3,
h4 {
  margin: 0 0 0.5rem;
}

.people {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.person {
  border-top: 1px solid var(--line);
  padding-top: 0.75rem;
  display: grid;
  gap: 0.5rem;
}

.who {
  margin: 0;
  display: grid;
}

.hint,
.muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.875rem;
}

.address {
  width: 100%;
  font: 0.8125rem ui-monospace, monospace;
}

.add {
  display: grid;
  gap: 0.75rem;
  border-top: 1px solid var(--line);
  padding-top: 0.75rem;
}

label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.875rem;
}

input,
select,
button {
  font: inherit;
  padding: 0.6rem 0.75rem;
  min-height: 2.75rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: var(--paper);
  color: var(--ink);
  min-width: 0;
}

button {
  background: var(--accent);
  color: #1c1d22;
  font-weight: 600;
  cursor: pointer;
}

button.quiet {
  background: transparent;
  color: var(--ink);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  color: light-dark(#a3231b, #ff8f86);
  margin: 0.75rem 0 0;
}
</style>
