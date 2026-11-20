<script setup lang="ts">
const emit = defineEmits<{ signIn: [] }>()
</script>

<template>
  <section class="sign-in">
    <p>
      You and your client just shook on a pitch. Before the budget gets spent, a coach has a quiet word with
      everyone, through their own AI, and finds the holes while they're still cheap to fill.
    </p>
    <p class="muted">Agencies sign in here to set up a project and invite the people in it.</p>
    <button type="button" @click="emit('signIn')">Sign in</button>
  </section>
</template>

<style scoped>
.sign-in {
  display: grid;
  gap: 0.75rem;
  max-width: 32rem;
}

p {
  margin: 0;
}
</style>
