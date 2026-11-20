<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue'

import { newTeammate, type Draft } from './onboarding'
import SeatCard from './SeatCard.vue'

// The draft is the flow's own reactive object, edited in place.
const props = defineProps<{ draft: Draft; agencyName: string }>()
const root = useTemplateRef<HTMLElement>('root')

async function add(side: 'agency' | 'client') {
  props.draft.guests.push(newTeammate(props.draft, side))
  await nextTick()
  const cards = root.value?.querySelectorAll(`[data-team="${side}"] .seat`)
  cards?.[cards.length - 1]?.querySelector<HTMLInputElement>('input')?.focus()
}

function drop(key: number) {
  props.draft.guests.splice(props.draft.guests.findIndex((guest) => guest.key === key), 1)
}

const on = (side: 'agency' | 'client') => props.draft.guests.filter((guest) => guest.side === side)
</script>

<template>
  <div ref="root" class="teams">
    <section class="team agency" data-team="agency" aria-label="Your agency team">
      <h3>Your agency team</h3>
      <p class="hint">You're the agency rep. Add anyone else on your side who works on this or signs things off.</p>
      <p class="you">
        <span class="avatar" aria-hidden="true">{{ (draft.yourName.trim() || 'Y').charAt(0).toUpperCase() }}</span>
        <span>
          <strong>{{ draft.yourName.trim() || 'You' }}</strong> (you)
          <small>{{ draft.yourJobTitle.trim() || 'Agency rep' }}</small>
        </span>
      </p>
      <SeatCard
        v-for="guest in on('agency')"
        :key="guest.key"
        :model-value="guest"
        extra
        placeholder="Someone on your team"
        :assumed-company="agencyName"
        @update:model-value="Object.assign(guest, $event)"
        @remove="drop(guest.key)"
      />
      <button type="button" class="quiet add" @click="add('agency')">+ Add someone from your agency</button>
    </section>

    <section class="team client" data-team="client" aria-label="Your client's team">
      <h3>Your client's team</h3>
      <p class="hint">Create a profile for each person. You'll send them their own link at the end.</p>
      <SeatCard
        v-model="draft.clientRep"
        role="Client rep"
        does="Owns the brief on the client side"
        placeholder="Your day-to-day contact"
        :assumed-company="draft.clientName.trim()"
        autofocus
      />
      <SeatCard
        v-model="draft.procurementRep"
        role="Client procurement"
        does="Handles terms, contracts and budget sign-off"
        placeholder="Who handles the contract"
        :assumed-company="draft.clientName.trim()"
      />
      <SeatCard
        v-for="guest in on('client')"
        :key="guest.key"
        :model-value="guest"
        extra
        placeholder="Someone on the client team"
        :assumed-company="draft.clientName.trim()"
        @update:model-value="Object.assign(guest, $event)"
        @remove="drop(guest.key)"
      />
      <button type="button" class="quiet add" @click="add('client')">+ Add someone from the client</button>
    </section>
  </div>
</template>

<style scoped>
.teams {
  display: grid;
  gap: 1.5rem;
}

.team {
  display: grid;
  gap: 0.85rem;
  padding-top: 1rem;
  border-top: 3px solid var(--line);
}

.team.agency {
  border-top-color: var(--agency);
}

.team.client {
  border-top-color: var(--client);
}

h3 {
  margin: 0;
  font-size: 1.2rem;
}

.hint {
  margin: 0;
  font-size: 0.875rem;
}

.you {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
  padding: 0.75rem 1rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
}

.you small {
  display: block;
  color: var(--muted);
}

.avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--agency);
  color: var(--on-accent);
  font-weight: 700;
  font-size: 0.875rem;
}

.add {
  justify-self: start;
  border-style: dashed;
}
</style>
