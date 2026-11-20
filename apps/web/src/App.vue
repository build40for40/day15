<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { createProject, createTeam, getSession, type Project, type Team } from './api'
import { currentUser, signIn, signOut } from './auth'
import ProjectCard from './ProjectCard.vue'

const loading = ref(true)
const signedIn = ref(false)
const team = ref<Team | null>(null)
const projects = ref<Project[]>([])
const teamName = ref('')
const projectName = ref('')
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

async function load() {
  const session = await getSession()
  team.value = session.team
  projects.value = session.projects
}

onMounted(async () => {
  try {
    signedIn.value = Boolean(await currentUser())
    if (signedIn.value) await load()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Something went wrong.'
  } finally {
    loading.value = false
  }
})

const makeTeam = () =>
  guard(async () => {
    team.value = (await createTeam(teamName.value)).team
  })

const makeProject = () =>
  guard(async () => {
    projects.value.push((await createProject(projectName.value)).project)
    projectName.value = ''
  })
</script>

<template>
  <main>
    <header>
      <h1>A-Line</h1>
      <button v-if="signedIn" type="button" class="quiet" @click="signOut()">Sign out</button>
    </header>

    <p v-if="loading" class="muted">One sec...</p>

    <template v-else-if="!signedIn">
      <p>
        You and your client just shook on a pitch. Before the budget gets spent, a coach has a quiet word with
        everyone, through their own AI, and finds the holes while they're still cheap to fill.
      </p>
      <button type="button" @click="signIn()">Sign in</button>
    </template>

    <template v-else>
      <p class="warning">
        Heads up: everything added to a project is visible to everyone in it, both sides. Keep anything confidential
        out of it.
      </p>

      <form v-if="!team" class="stack" @submit.prevent="makeTeam">
        <h2>First, name your team</h2>
        <input v-model="teamName" required maxlength="80" placeholder="Your agency" aria-label="Team name" />
        <button type="submit" :disabled="busy || !teamName.trim()">Create team</button>
      </form>

      <template v-else>
        <h2>{{ team.name }}</h2>
        <form class="stack" @submit.prevent="makeProject">
          <input v-model="projectName" required maxlength="80" placeholder="A project, like Orchard Dash" aria-label="Project name" />
          <button type="submit" :disabled="busy || !projectName.trim()">Create project</button>
        </form>
        <p v-if="projects.length === 0" class="muted">No projects yet. Make one and invite the people in it.</p>
        <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
      </template>
    </template>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>
main {
  max-width: 40rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.2;
}

h2 {
  margin: 1.25rem 0 0.5rem;
  font-size: 1.25rem;
}

.muted {
  color: var(--muted);
}

.warning {
  background: var(--card);
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.stack {
  display: grid;
  gap: 0.75rem;
}

input,
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
}
</style>
