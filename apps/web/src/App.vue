<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { getSession, type Project, type Team } from './api'
import { currentUser, signIn, signOut } from './auth'
import OnboardingFlow from './OnboardingFlow.vue'
import ProjectWorkspace from './ProjectWorkspace.vue'
import SignInScreen from './SignInScreen.vue'

const loading = ref(true)
const signedIn = ref(false)
const team = ref<Team | null>(null)
const projects = ref<Project[]>([])
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

function finishOnboarding(madeTeam: Team, project: Project) {
  team.value = madeTeam
  projects.value = [project]
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
        Heads up: what people tell the coach is shared with both sides by default. Tell the coach "keep this
        private" and it stays on your side. It's an experiment, so keep anything truly confidential out of it.
      </p>

      <OnboardingFlow v-if="!team || !projects.length" :team="team" @finish="finishOnboarding" />

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
