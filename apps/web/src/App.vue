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
      <h1 class="mark">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3.2a12.8 12.8 0 1 1-9.6 4.3" fill="none" stroke="#f7ecd2" stroke-width="1.6" stroke-linecap="round" />
          <circle cx="16" cy="16" r="3" fill="#ff9c91" />
          <circle cx="6.1" cy="7.9" r="2.2" fill="#46d6c8" />
        </svg>
        A-Line
      </h1>
      <p v-if="team" class="team">{{ team.name }}</p>
      <button v-if="signedIn" type="button" class="quiet" @click="signOut()">Sign out</button>
    </header>

    <p v-if="loading" class="muted">One sec...</p>

    <SignInScreen v-else-if="!signedIn" @sign-in="signIn()" />

    <template v-else>
      <OnboardingFlow v-if="!team || !projects.length" :team="team" @finish="finishOnboarding" />

      <ProjectWorkspace v-else :initial-projects="projects" />


      <p class="warning">
        Heads up: what people tell the coach is shared with both sides by default. Tell the coach "keep this
        private" and it stays on your side. It's an experiment, so keep anything truly confidential out of it.
      </p>
    </template>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>
main {
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 max(20px, env(safe-area-inset-right, 0px)) 56px max(20px, env(safe-area-inset-left, 0px));
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding-block: 22px 18px;
}

.mark {
  margin: 0;
  font: 400 28px/1 var(--serif);
  letter-spacing: 0.01em;
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.mark svg {
  width: 26px;
  height: 26px;
}

.team {
  margin: 0;
  flex: 1;
  font-size: 13px;
  color: var(--dim);
  overflow-wrap: anywhere;
}

header button {
  margin-left: auto;
}

.warning {
  max-width: 46rem;
  margin: 40px 0 0;
  padding: 2px 0 2px 12px;
  border-left: 2px solid var(--coral);
  font-size: 13px;
  color: var(--dim);
}
</style>
