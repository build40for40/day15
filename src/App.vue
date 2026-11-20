<script setup lang="ts">
import CoachChat from './coach/CoachChat.vue'
import { PARTIES, type Party } from './coach/schema'

const asked = new URLSearchParams(window.location.search).get('as')
const party = PARTIES.find((option) => option === asked) as Party | undefined
</script>

<template>
  <main>
    <h1>Expectation Manager</h1>

    <template v-if="party">
      <p class="lede">
        You're here for the <strong>{{ party }}</strong> side. The coach will ask you things the other lot would
        want to know, before anyone spends the budget finding out the hard way.
      </p>
      <CoachChat :party="party" />
    </template>

    <template v-else>
      <p class="lede">
        A coach has a quiet word with each side of a project, one at a time, and finds the holes while they're
        still cheap to fill.
      </p>
      <p>Which side are you on?</p>
      <nav>
        <a href="?as=agency">I'm the agency</a>
        <a href="?as=client">I'm the client</a>
      </nav>
    </template>
  </main>
</template>

<style scoped>
main {
  max-width: 40rem;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
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

a {
  display: flex;
  align-items: center;
  min-height: 56px;
  padding: 0 1.25rem;
  border: 1px solid var(--ink);
  border-radius: 0.75rem;
  background: var(--card);
  color: var(--ink);
  font-weight: 600;
  text-decoration: none;
}
</style>
