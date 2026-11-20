<script setup lang="ts">
import type { Participant } from '@day15/shared/schema'

defineProps<{
  people: Participant[]
  /** A person's id, or `add` while adding someone. */
  selected: number | 'add' | null
}>()

const emit = defineEmits<{ select: [id: number]; add: [] }>()

function marker(person: Participant): { label: string; kind: string } {
  if (person.hasLink) return { label: 'Has a link', kind: 'linked' }
  if (person.addedBy === 'coach') return { label: 'Mentioned, no link', kind: 'mentioned' }
  return { label: 'No link', kind: 'unlinked' }
}
</script>

<template>
  <nav class="sidebar" aria-label="People in this project">
    <button type="button" class="add" :aria-pressed="selected === 'add'" @click="emit('add')">Add person</button>

    <p v-if="people.length === 0" class="hint">Nobody here yet. Add the first person and get the party started.</p>

    <ul>
      <li v-for="person in people" :key="person.id">
        <button
          type="button"
          class="person"
          :class="{ current: selected === person.id }"
          :aria-current="selected === person.id ? 'true' : undefined"
          @click="emit('select', person.id)"
        >
          <span class="name"><i class="dot" :class="person.side" />{{ person.name }}</span>
          <span v-if="person.jobTitle" class="title">{{ person.jobTitle }}</span>
          <span class="marker" :class="marker(person).kind">{{ marker(person).label }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.sidebar {
  display: grid;
  gap: 12px;
  align-content: start;
  min-width: 0;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
}

li {
  border-top: 1px solid var(--line);
}

li:last-child {
  border-bottom: 1px solid var(--line);
}

.person {
  width: 100%;
  display: grid;
  gap: 2px;
  text-align: left;
  padding: 12px 10px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--text);
  font-weight: 400;
}

.person:hover:not(:disabled) {
  background: rgba(17, 26, 46, 0.6);
}

.person.current {
  background: var(--raise);
  box-shadow: inset 0 0 0 1px var(--line-2);
}

.name {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font: 400 19px/1.25 var(--serif);
  color: var(--lit);
  overflow-wrap: anywhere;
}

.title,
.marker {
  padding-left: 17px;
  font-size: 13px;
  color: var(--dim);
  overflow-wrap: anywhere;
}

.marker {
  font-size: 12px;
}

.marker.linked {
  color: var(--done);
}
</style>
