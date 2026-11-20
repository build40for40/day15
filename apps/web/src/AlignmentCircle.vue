<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { CSS, HTML, mount } from './alignment-circle'

const host = ref<HTMLElement | null>(null)
let stop: (() => void) | undefined

onMounted(() => {
  if (!host.value) return
  try {
    const root = host.value.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>${CSS}</style>${HTML}`
    stop = mount(root)
  } catch {
    // The overview is a picture, so if it cannot draw the rest of the app carries on.
  }
})

onBeforeUnmount(() => stop?.())
</script>

<template>
  <div ref="host" class="circle-host" aria-label="Alignment overview" />
</template>

<style scoped>
.circle-host {
  display: block;
  min-width: 0;
}
</style>
