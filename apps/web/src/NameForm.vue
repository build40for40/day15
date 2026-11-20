<script setup lang="ts">
import { MAX_NAME_LENGTH } from '@day15/shared/schema'
import { ref } from 'vue'

defineProps<{ heading: string; label: string; placeholder: string; submitLabel: string; busy: boolean }>()

const emit = defineEmits<{ submit: [name: string] }>()

const name = ref('')

function submit() {
  emit('submit', name.value.trim())
  name.value = ''
}
</script>

<template>
  <form class="name-form" @submit.prevent="submit">
    <h2>{{ heading }}</h2>
    <input v-model="name" required :maxlength="MAX_NAME_LENGTH" :placeholder="placeholder" :aria-label="label" />
    <button type="submit" :disabled="busy || !name.trim()">{{ submitLabel }}</button>
  </form>
</template>

<style scoped>
.name-form {
  display: grid;
  gap: 14px;
  justify-items: start;
  max-width: 32rem;
  padding-top: clamp(8px, 3vw, 40px);
}

h2 {
  margin: 0;
  font: 300 clamp(28px, 4vw, 42px) / 1.1 var(--serif);
}

input {
  width: 100%;
}
</style>
