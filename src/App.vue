<script setup lang="ts">
import { computed, ref } from 'vue'

import BrainView from './coach/BrainView.vue'
import CoachChat from './coach/CoachChat.vue'
import { OTHER_SIDE, PARTIES, type Party } from './coach/schema'

const params = new URLSearchParams(window.location.search)
const projectId = ref(params.get('p') ?? '')
const party = ref(PARTIES.find((option) => option === params.get('as')))
// The team's behind-the-scenes view. Nothing on the page links to it.
const brain = params.get('as') === 'brain'
const failed = ref(false)
const copied = ref(false)

const linkFor = (side: Party) => `?p=${projectId.value}&as=${side}`

const otherSide = computed(() => (party.value ? OTHER_SIDE[party.value] : undefined))
const otherLink = computed(() =>
  otherSide.value ? new URL(linkFor(otherSide.value), window.location.href).href : '',
)

/** Starts a new project and sits this person down on their side of it. */
async function begin(side: Party) {
  failed.value = false
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/projects`, { method: 'POST' })
    if (!response.ok) throw new Error(`The API answered ${response.status}`)
    projectId.value = ((await response.json()) as { id: string }).id
    party.value = side
    window.history.replaceState(null, '', linkFor(side))
  } catch {
    failed.value = true
  }
}

async function copyLink() {
  await navigator.clipboard.writeText(otherLink.value)
  copied.value = true
}
</script>

<template>
  <main :class="{ wide: brain }">
    <h1>Expectation Manager</h1>

    <template v-if="projectId && brain">
      <p class="lede">
        Behind the scenes: which hat the coach had on for each question, and why. Neither side ever sees this.
      </p>
      <BrainView :project-id="projectId" />
    </template>

    <template v-else-if="projectId && party && otherSide">
      <p class="lede">
        You're here for the <strong>{{ party }}</strong> side. The coach asks you things worth settling now, before
        anyone spends the budget finding out the hard way.
      </p>
      <aside>
        <p>
          The {{ otherSide }} gets their own quiet chat. Send them this link:
          <a :href="otherLink">{{ otherLink }}</a>
        </p>
        <button type="button" @click="copyLink">{{ copied ? 'Copied' : 'Copy link' }}</button>
      </aside>
      <CoachChat :key="party" :party="party" :project-id="projectId" />
    </template>

    <template v-else-if="projectId">
      <p class="lede">You've been sent a project. Which side are you on?</p>
      <nav>
        <a v-for="side in PARTIES" :key="side" :href="linkFor(side)">I'm the {{ side }}</a>
      </nav>
    </template>

    <template v-else>
      <p class="lede">
        A coach has a quiet word with each side of a project, one at a time, and finds the holes while they're
        still cheap to fill.
      </p>
      <p>Start a project. Which side are you on?</p>
      <nav>
        <button v-for="side in PARTIES" :key="side" type="button" @click="begin(side)">I'm the {{ side }}</button>
      </nav>
      <p v-if="failed" role="alert">That didn't work. Is the API running?</p>
    </template>
  </main>
</template>

<style scoped>
main {
  max-width: 40rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

main.wide {
  max-width: 70rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.75rem;
  line-height: 1.2;
}

.lede {
  margin: 0 0 1.5rem;
  color: var(--muted);
}

nav {
  display: grid;
  gap: 0.75rem;
}

nav a,
nav button {
  display: flex;
  align-items: center;
  min-height: 56px;
  padding: 0 1.25rem;
  border: 1px solid var(--ink);
  border-radius: 0.75rem;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

aside {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  border: 1px dashed var(--line);
  border-radius: 0.75rem;
  font-size: 0.9rem;
}

aside p {
  margin: 0;
  overflow-wrap: anywhere;
}

aside a {
  color: inherit;
}

aside button {
  justify-self: start;
  min-height: 44px;
  padding: 0 1rem;
  border: 1px solid var(--ink);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}
</style>
