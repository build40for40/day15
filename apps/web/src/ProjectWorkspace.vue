<script setup lang="ts">
import type { Participant } from '@day15/shared/schema'
import { computed, reactive, ref } from 'vue'

import {
  addPerson,
  createProject,
  freshAddress,
  removePerson,
  updatePerson,
  type PersonDetails,
  type Project,
} from './api'
import AlignmentCircle from './AlignmentCircle.vue'
import NameForm from './NameForm.vue'
import PeopleSidebar from './PeopleSidebar.vue'
import PersonForm from './PersonForm.vue'
import PersonPanel from './PersonPanel.vue'

const props = defineProps<{ initialProjects: Project[] }>()

const projects = ref<Project[]>(props.initialProjects)
const currentId = ref<string | null>(projects.value[0]?.id ?? null)
const selected = ref<number | 'add' | 'project' | null>(null)
const addresses = reactive<Record<string, string>>({})
const giveLink = ref(true)
const busy = ref(false)
const error = ref('')

const project = computed(() => projects.value.find((p) => p.id === currentId.value) ?? null)
const person = computed(() =>
  typeof selected.value === 'number' ? (project.value?.participants.find((p) => p.id === selected.value) ?? null) : null,
)
const addressKey = (id: number) => `${currentId.value}:${id}`

const BLANK: PersonDetails = {
  name: '',
  jobTitle: '',
  organisation: '',
  side: 'agency',
  persona: 'agency_lead',
  lenses: ['agency'],
  notes: '',
}

async function guard(run: () => Promise<void>) {
  busy.value = true
  error.value = ''
  try {
    await run()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Something went wrong.'
  } finally {
    busy.value = false
  }
}

function choose(next: typeof selected.value) {
  error.value = ''
  giveLink.value = true
  selected.value = next
}

function replace(updated: Participant) {
  const people = project.value!.participants
  people.splice(people.findIndex((p) => p.id === updated.id), 1, updated)
}

const makeProject = (name: string) =>
  guard(async () => {
    const created = (await createProject(name)).project
    projects.value.push(created)
    currentId.value = created.id
    choose('add')
  })

function switchProject(id: string) {
  currentId.value = id
  choose(null)
}

const add = (details: PersonDetails) =>
  guard(async () => {
    const { participant, address } = await addPerson(project.value!.id, details, giveLink.value)
    project.value!.participants.push(participant)
    if (address) addresses[addressKey(participant.id)] = address
    choose(participant.id)
  })

const save = (details: PersonDetails) =>
  guard(async () => {
    replace((await updatePerson(project.value!.id, person.value!.id, details)).participant)
  })

const issue = () =>
  guard(async () => {
    const { participant, address } = await freshAddress(project.value!.id, person.value!.id)
    replace(participant)
    addresses[addressKey(participant.id)] = address
  })

const remove = () =>
  guard(async () => {
    const { participant } = await removePerson(project.value!.id, person.value!.id)
    const people = project.value!.participants
    people.splice(people.findIndex((p) => p.id === participant.id), 1)
    delete addresses[addressKey(participant.id)]
    choose(null)
  })
</script>

<template>
  <div v-if="!project || selected === 'project'" class="solo">
    <NameForm
      :heading="project ? 'Start another project' : 'Start your first project'"
      label="Project name"
      placeholder="A project, like Orchard Dash"
      submit-label="Create project"
      :busy="busy"
      @submit="makeProject"
    />
    <button v-if="project" type="button" class="quiet" @click="choose(null)">Never mind</button>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </div>

  <div v-else class="workspace">
    <PeopleSidebar
      :projects="projects"
      :project="project"
      :selected="selected"
      @select="choose"
      @add="choose('add')"
      @switch-project="switchProject"
      @new-project="choose('project')"
    />

    <section class="pane">
      <section v-if="selected === 'add'" aria-labelledby="add-heading">
        <h2 id="add-heading">Add a person</h2>
        <p class="hint">Anyone involved counts, even if they'll never chat to the coach themselves.</p>
        <PersonForm :initial="BLANK" submit-label="Add them" :busy="busy" lenses-follow-persona @submit="add">
          <label class="check">
            <input v-model="giveLink" type="checkbox" name="giveLink" />
            Give them a link to the coach now
          </label>
        </PersonForm>
      </section>

      <PersonPanel
        v-else-if="person"
        :key="person.id"
        :person="person"
        :project-name="project!.name"
        :address="addresses[addressKey(person.id)] ?? null"
        :busy="busy"
        @save="save"
        @issue="issue"
        @remove="remove"
      />

      <template v-else>
        <AlignmentCircle />
        <p class="hint">Pick someone from the list to see their details, or add a person.</p>
      </template>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </section>
  </div>
</template>

<style scoped>
.solo {
  display: grid;
  gap: 0.75rem;
  max-width: 32rem;
}

.workspace {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 48rem) {
  .workspace {
    grid-template-columns: 16rem minmax(0, 1fr);
    align-items: start;
  }
}

.pane {
  display: grid;
  gap: 1rem;
  min-width: 0;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  padding: 1rem;
}

.pane h2 {
  margin: 0;
  font-size: 1.25rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.check input {
  min-height: auto;
  width: 1.1rem;
  height: 1.1rem;
}

.error {
  margin: 0;
}
</style>
