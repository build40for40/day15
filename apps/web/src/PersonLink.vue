<script setup lang="ts">
import type { Participant } from '@day15/shared/schema'
import { ref, watch } from 'vue'

const props = defineProps<{
  person: Participant
  /** Only known right after the link was made. */
  address: string | null
  busy: boolean
}>()

const emit = defineEmits<{ issue: [] }>()

const copied = ref(false)
const copyFailed = ref(false)

watch(
  () => props.address,
  () => {
    copied.value = false
    copyFailed.value = false
  },
)

async function copy() {
  if (!props.address) return
  try {
    await navigator.clipboard.writeText(props.address)
    copied.value = true
  } catch {
    copyFailed.value = true
  }
}
</script>

<template>
  <section class="link" aria-labelledby="link-heading">
    <h3 id="link-heading">Their link to the coach</h3>

    <template v-if="address">
      <input class="address" readonly :value="address" aria-label="MCP address" @focus="($event.target as HTMLInputElement).select()" />
      <button type="button" @click="copy">{{ copied ? 'Copied' : 'Copy link' }}</button>
      <p v-if="copyFailed" class="error" role="alert">Your browser wouldn't copy it. Select the link and copy it by hand.</p>
      <p class="hint">Grab it now: we only keep a scrambled copy, so this is the one and only showing.</p>
      <p class="hint">In Claude: Settings, Connectors, Add custom connector, paste the link.</p>
      <p class="hint">In ChatGPT: Settings, Connectors, add a custom connector with the link.</p>
      <p class="hint">It works like a password: anyone holding it talks to the coach as {{ person.name }}.</p>
    </template>

    <template v-else-if="person.hasLink">
      <p class="hint">They've got a link. We only keep a scrambled copy, so we can't show it again.</p>
      <button type="button" class="quiet" :disabled="busy" @click="emit('issue')">Get a new link</button>
      <p class="hint">The old one stops working the moment you do.</p>
    </template>

    <template v-else>
      <p class="hint">
        No link yet<template v-if="person.addedBy === 'coach'">: the coach heard about them in conversation</template>.
        They can't talk to the coach until they have one.
      </p>
      <button type="button" :disabled="busy" @click="emit('issue')">Give them a link</button>
    </template>
  </section>
</template>

<style scoped>
.link {
  display: grid;
  gap: 0.5rem;
}

h3 {
  margin: 0;
  font-size: 1rem;
}

.address {
  width: 100%;
  font: 0.8125rem ui-monospace, monospace;
}

.error {
  margin: 0;
}
</style>
