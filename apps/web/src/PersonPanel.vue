<script setup lang="ts">
import type { Participant } from '@day15/shared/schema'
import { ref } from 'vue'

import type { PersonDetails } from './api'
import PersonForm from './PersonForm.vue'
import PersonLink from './PersonLink.vue'

const props = defineProps<{
  person: Participant
  address: string | null
  busy: boolean
}>()

const emit = defineEmits<{ save: [details: PersonDetails]; issue: []; remove: [] }>()

const confirming = ref(false)

const details = (): PersonDetails => ({
  name: props.person.name,
  jobTitle: props.person.jobTitle,
  organisation: props.person.organisation,
  side: props.person.side,
  persona: props.person.persona,
  lenses: props.person.lenses,
  notes: props.person.notes,
})
</script>

<template>
  <article class="panel">
    <header>
      <h2>{{ person.name }}</h2>
      <p v-if="person.jobTitle || person.organisation" class="muted">
        {{ [person.jobTitle, person.organisation].filter(Boolean).join(' at ') }}
      </p>
    </header>

    <PersonLink :person="person" :address="address" :busy="busy" @issue="emit('issue')" />

    <section aria-labelledby="details-heading">
      <h3 id="details-heading">Details</h3>
      <PersonForm :key="person.id" :initial="details()" submit-label="Save changes" :busy="busy" @submit="emit('save', $event)" />
    </section>

    <section class="remove">
      <button v-if="!confirming" type="button" class="danger" @click="confirming = true">Remove from project</button>
      <div v-else class="confirm" role="group" aria-label="Confirm removal">
        <p>
          Sure?<template v-if="person.hasLink"> {{ person.name }}'s link stops working right away.</template>
          Everything they already said stays in the room.
        </p>
        <button type="button" class="danger" :disabled="busy" @click="emit('remove')">Yes, remove them</button>
        <button type="button" class="quiet" @click="confirming = false">Keep them</button>
      </div>
    </section>
  </article>
</template>

<style scoped>
.panel {
  display: grid;
  gap: 1.5rem;
}

header h2 {
  margin: 0;
  font-size: 1.25rem;
  overflow-wrap: anywhere;
}

header p {
  margin: 0;
}

h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.remove {
  border-top: 1px solid var(--line);
  padding-top: 1rem;
}

.confirm {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.confirm p {
  flex-basis: 100%;
  margin: 0;
}
</style>
