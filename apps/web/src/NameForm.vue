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
  gap: 0.75rem;
}

h2 {
  margin: 0;
  font-size: 1.25rem;
}
</style>
