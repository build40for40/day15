<script setup lang="ts">
import type { Participant } from '@day15/shared/schema'
import { computed, ref, watch } from 'vue'

import { inviteMessage, whatsappUrl } from './invite'

const props = defineProps<{
  person: Participant
  projectName: string
  /** Only known right after the link was made. */
  address: string | null
  busy: boolean
}>()

const emit = defineEmits<{ issue: [] }>()

const message = computed(() =>
  props.address ? inviteMessage({ personName: props.person.name, projectName: props.projectName, address: props.address }) : null,
)

const copied = ref(false)
const copyFailed = ref(false)

watch(
  message,
  () => {
    copied.value = false
    copyFailed.value = false
  },
)

async function copy() {
  if (!message.value) return
  try {
    await navigator.clipboard.writeText(message.value)
    copied.value = true
  } catch {
    copyFailed.value = true
  }
}
</script>

<template>
  <section class="link" aria-labelledby="link-heading">
    <h3 id="link-heading">Their link to the coach</h3>

    <template v-if="message">
      <p class="hint">Send {{ person.name }} this. It has their link and how to plug it into Claude or ChatGPT.</p>
      <p class="message">{{ message }}</p>
      <div class="actions">
        <button type="button" @click="copy">{{ copied ? 'Copied' : 'Copy prompt' }}</button>
        <a class="share" :href="whatsappUrl(message)" target="_blank" rel="noopener">WhatsApp</a>
      </div>
      <p v-if="copyFailed" class="error" role="alert">Your browser wouldn't copy it. Select the message and copy it by hand.</p>
      <p class="hint">Send it now: we only keep a scrambled copy of the link, so this is the one and only showing.</p>
      <p class="hint">The link works like a password: anyone holding it talks to the coach as {{ person.name }}.</p>
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

.message {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-left: 3px solid var(--accent);
  background: var(--paper);
  font-size: 0.875rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.share {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  color: var(--ink);
  font-weight: 600;
  text-decoration: none;
}

.error {
  margin: 0;
}
</style>
