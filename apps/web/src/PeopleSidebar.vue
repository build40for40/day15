<script setup lang="ts">
import type { Participant } from '@day15/shared/schema'

import type { Project } from './api'

defineProps<{
  projects: Project[]
  project: Project
  /** A person's id, or `add` while adding someone. */
  selected: number | 'add' | null
}>()

const emit = defineEmits<{ select: [id: number]; add: []; switchProject: [id: string]; newProject: [] }>()

function marker(person: Participant): { label: string; kind: string } {
  if (person.hasLink) return { label: 'Has a link', kind: 'linked' }
  if (person.addedBy === 'coach') return { label: 'Mentioned, no link', kind: 'mentioned' }
  return { label: 'No link', kind: 'unlinked' }
}
</script>

<template>
  <nav class="sidebar" aria-label="People in this project">
    <div class="project">
      <label v-if="projects.length > 1" class="switch">
        Project
        <select :value="project.id" @change="emit('switchProject', ($event.target as HTMLSelectElement).value)">
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <h2 v-else>{{ project.name }}</h2>
      <button type="button" class="quiet" @click="emit('newProject')">New project</button>
    </div>

    <button type="button" class="add" :aria-pressed="selected === 'add'" @click="emit('add')">Add person</button>

    <p v-if="project.participants.length === 0" class="hint">Nobody here yet. Add the first person and get the party started.</p>

    <ul>
      <li v-for="person in project.participants" :key="person.id">
        <button
          type="button"
          class="person"
          :class="{ current: selected === person.id }"
          :aria-current="selected === person.id ? 'true' : undefined"
          @click="emit('select', person.id)"
        >
          <span class="name">{{ person.name }}</span>
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
  gap: 0.75rem;
  align-content: start;
  min-width: 0;
}

.project {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 0.5rem;
}

.project h2 {
  margin: 0;
  font-size: 1.125rem;
  overflow-wrap: anywhere;
}

.switch {
  display: grid;
  gap: 0.25rem;
  font-size: 0.875rem;
  flex: 1 1 10rem;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
}

.person {
  width: 100%;
  display: grid;
  gap: 0.1rem;
  text-align: left;
  background: var(--card);
  color: var(--ink);
  font-weight: 400;
}

.person.current {
  border-color: var(--ink);
  box-shadow: inset 4px 0 0 var(--accent);
}

.name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.title {
  color: var(--muted);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.marker {
  font-size: 0.75rem;
  color: var(--muted);
}

.marker::before {
  content: '';
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  margin-right: 0.35rem;
  border: 1px solid var(--muted);
}

.marker.linked::before {
  background: var(--accent);
  border-color: var(--accent);
}

.marker.mentioned::before {
  border-style: dashed;
}
</style>
