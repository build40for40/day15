<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { createTeam, getSession, type Project, type Team } from './api'
import { currentUser, signIn, signOut } from './auth'
import NameForm from './NameForm.vue'
import ProjectWorkspace from './ProjectWorkspace.vue'
import SignInScreen from './SignInScreen.vue'

const loading = ref(true)
const signedIn = ref(false)
const team = ref<Team | null>(null)
const projects = ref<Project[]>([])
const busy = ref(false)
const error = ref('')

const message = (caught: unknown) => (caught instanceof Error ? caught.message : 'Something went wrong.')

onMounted(async () => {
  try {
    signedIn.value = Boolean(await currentUser())
    if (signedIn.value) {
      const session = await getSession()
      team.value = session.team
      projects.value = session.projects
    }
  } catch (caught) {
    error.value = message(caught)
  } finally {
    loading.value = false
  }
})

async function makeTeam(name: string) {
  busy.value = true
  error.value = ''
  try {
    team.value = (await createTeam(name)).team
  } catch (caught) {
    error.value = message(caught)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main>
    <header>
      <h1>A-Line</h1>
      <p v-if="team" class="team muted">{{ team.name }}</p>
      <button v-if="signedIn" type="button" class="quiet" @click="signOut()">Sign out</button>
    </header>

    <p v-if="loading" class="muted">One sec...</p>

    <SignInScreen v-else-if="!signedIn" @sign-in="signIn()" />

    <template v-else>
      <p class="warning">
        Heads up: everything added to a project is visible to everyone in it, both sides. Keep anything confidential
        out of it.
      </p>

      <NameForm
        v-if="!team"
        heading="First, name your team"
        label="Team name"
        placeholder="Your agency"
        submit-label="Create team"
        :busy="busy"
        @submit="makeTeam"
      />

      <ProjectWorkspace v-else :initial-projects="projects" />
    </template>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>
main {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.2;
}

.team {
  margin: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

header button {
  margin-left: auto;
}

.warning {
  background: var(--card);
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin: 0 0 1.5rem;
}
</style>
