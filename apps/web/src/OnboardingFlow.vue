<script setup lang="ts">
import { MAX_JOB_TITLE_LENGTH, MAX_NAME_LENGTH, MAX_ORGANISATION_LENGTH } from '@day15/shared/schema'
import { computed, onMounted, reactive, ref, useTemplateRef } from 'vue'

import { addPerson, createProject, createTeam, type Project, type Team } from './api'
import { inviteMessage, whatsappUrl } from './invite'
import {
  blocker,
  firstName,
  lonelySide,
  CLIENT_REP_KEY,
  newGuest,
  PROCUREMENT_KEY,
  roleName,
  seats,
  STEP_LABELS,
  STEPS,
  takeSetup,
  type Draft,
  type Step,
} from './onboarding'
import OnboardingSketch from './OnboardingSketch.vue'
import TeamEditor from './TeamEditor.vue'

const props = defineProps<{ team: Team | null }>()
const emit = defineEmits<{ finish: [team: Team, project: Project] }>()

const step = ref<Step>('hello')
// Talk: one question at a time. Form: every field on one page. Both end at the same review.
const mode = ref<'talk' | 'form'>('talk')
const phase = ref<'asking' | 'working' | 'done'>('asking')
const error = ref('')
const stage = useTemplateRef<HTMLElement>('stage')

const draft = reactive<Draft>({
  clientRep: newGuest(CLIENT_REP_KEY, 'marketing_lead', 'client'),
  procurementRep: newGuest(PROCUREMENT_KEY, 'procurement', 'client'),
  yourName: '',
  yourJobTitle: '',
  agencyName: '',
  projectName: '',
  clientName: '',
  guests: [],
})

// What has been made so far, so a retry after a failure carries on instead of starting again.
const madeTeam = ref<Team | null>(props.team)
const madeProject = ref<Project | null>(null)
const addresses = reactive<Record<number, string | null>>({})

const needsAgencyName = computed(() => !props.team)
const agencyName = computed(() => (props.team?.name ?? draft.agencyName).trim())
const plan = computed(() => seats(draft, agencyName.value))
const lonely = computed(() => lonelySide(draft))
const view = computed(() => (phase.value === 'done' ? 'done' : step.value === 'review' ? 'review' : mode.value === 'form' ? 'form' : step.value))
const stepIndex = computed(() => (phase.value === 'done' ? STEPS.length : STEPS.indexOf(step.value)))
const started = computed(() => madeProject.value !== null)
const withLinks = computed(() => plan.value.filter((seat) => seat.link))
// The people the agency rep sends links to come first, and their own link last.
const toSend = computed(() => [...withLinks.value.filter((seat) => !seat.you), ...withLinks.value.filter((seat) => seat.you)])
const anyone = computed(() => plan.value.length > 1)

const focusFirst = () => stage.value?.querySelector<HTMLElement>('[data-focus]')?.focus()

function arrive() {
  if ((stage.value?.getBoundingClientRect().top ?? 0) < 0) stage.value?.scrollIntoView({ block: 'start' })
  focusFirst()
}

// A setup made in chat arrives prefilled, and opens on the review so it can be checked and approved.
onMounted(() => {
  const setup = takeSetup(window.sessionStorage)
  if (setup) {
    Object.assign(draft, setup)
    step.value = blocker('hello', draft, needsAgencyName.value) || blocker('project', draft, false) ? 'hello' : 'review'
  }
  // A new step isn't in the page until the old one has left, so focus it when it arrives.
  focusFirst()
})

function go(to: Step) {
  error.value = ''
  step.value = to
}

function forward() {
  const stop = blocker(step.value, draft, needsAgencyName.value)
  if (stop) {
    error.value = stop
    return
  }
  go(STEPS[STEPS.indexOf(step.value) + 1]!)
}

function back() {
  go(mode.value === 'form' ? 'hello' : STEPS[STEPS.indexOf(step.value) - 1]!)
}

function submitForm() {
  for (const check of ['hello', 'project'] as const) {
    const stop = blocker(check, draft, needsAgencyName.value)
    if (stop) {
      error.value = stop
      return
    }
  }
  go('review')
}

function switchMode(to: 'talk' | 'form') {
  error.value = ''
  mode.value = to
  step.value = 'hello'
}

async function setUp() {
  phase.value = 'working'
  error.value = ''
  try {
    madeTeam.value ??= (await createTeam(agencyName.value)).team
    madeProject.value ??= (await createProject(draft.projectName.trim())).project
    for (const seat of plan.value) {
      if (seat.key in addresses) continue
      const { participant, address } = await addPerson(madeProject.value.id, seat.details, seat.link)
      madeProject.value.participants.push(participant)
      addresses[seat.key] = address
    }
    phase.value = 'done'
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Something went wrong. Try again?'
    phase.value = 'asking'
  }
}

const copiedKey = ref<number | null>(null)
const copyFailed = ref(false)

const invite = (key: number, name: string, you: boolean) =>
  inviteMessage({
    personName: name,
    projectName: madeProject.value!.name,
    address: addresses[key]!,
    from: you ? undefined : { name: draft.yourName.trim(), agency: agencyName.value },
  })

async function copy(key: number, name: string, you: boolean) {
  copyFailed.value = false
  try {
    await navigator.clipboard.writeText(invite(key, name, you))
    copiedKey.value = key
  } catch {
    copyFailed.value = true
  }
}

const finish = () => emit('finish', madeTeam.value!, madeProject.value!)
</script>

<template>
  <section ref="stage" class="flow" aria-label="Set up your first project">
    <div class="topline">
    <ol v-if="mode === 'talk'" class="progress" aria-label="Progress">
      <li
        v-for="(name, index) in STEPS"
        :key="name"
        :class="{ done: index < stepIndex, now: index === stepIndex }"
        :aria-current="index === stepIndex ? 'step' : undefined"
      >
        <span class="dot" aria-hidden="true">{{ index < stepIndex ? '✓' : index + 1 }}</span>
        <span class="label">{{ STEP_LABELS[name] }}</span>
      </li>
    </ol>
    <p v-else class="eyebrow">Your project, all on one page</p>
    <button v-if="phase === 'asking' && !started && step !== 'review'" type="button" class="quiet small switch" @click="switchMode(mode === 'talk' ? 'form' : 'talk')">
      {{ mode === 'talk' ? 'Prefer a form? Fill it in all at once' : 'Prefer to be asked? Talk me through it' }}
    </button>
    </div>

    <div class="layout">
      <div class="card">
        <Transition name="step" mode="out-in" @after-enter="arrive">
          <!-- The same questions on one page -->
          <form v-if="view === 'form'" key="form" class="ask" @submit.prevent="submitForm">
            <h2>Set up your project</h2>
            <p class="lead">Fill in what you know. Only the first few are needed, and nothing is created until you've reviewed it.</p>

            <section class="group">
              <h3>You, the agency rep</h3>
              <label>
                <span class="q">Your name</span>
                <input v-model="draft.yourName" data-focus :maxlength="MAX_NAME_LENGTH" autocomplete="name" placeholder="Your name" />
              </label>
              <label>
                <span class="q">Your job title</span>
                <input v-model="draft.yourJobTitle" :maxlength="MAX_JOB_TITLE_LENGTH" autocomplete="organization-title" placeholder="Managing Director" />
              </label>
              <label v-if="needsAgencyName">
                <span class="q">Your agency</span>
                <input v-model="draft.agencyName" :maxlength="MAX_NAME_LENGTH" autocomplete="organization" placeholder="Your agency" />
              </label>
              <p v-else class="hint">Setting this up for {{ team!.name }}.</p>
            </section>

            <section class="group">
              <h3>The project</h3>
              <label>
                <span class="q">Project name</span>
                <input v-model="draft.projectName" :maxlength="MAX_NAME_LENGTH" placeholder="Orchard Dash" />
              </label>
              <label>
                <span class="q">Client company</span>
                <input v-model="draft.clientName" :maxlength="MAX_ORGANISATION_LENGTH" autocomplete="off" placeholder="The client's company" />
              </label>
            </section>

            <section class="group">
              <TeamEditor :draft="draft" :agency-name="agencyName" />
            </section>

            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <div class="actions"><button type="submit">Review</button></div>
          </form>

          <!-- 1. Hello -->
          <form v-else-if="view === 'hello'" key="hello" class="ask" @submit.prevent="forward">
            <p class="eyebrow">Welcome to A-Line</p>
            <h2>You've just won the pitch. Let's make sure everyone means the same thing.</h2>
            <p class="lead">
              You're the agency rep, so you set everything up: your client's team, their profiles, and their invites. Four
              quick questions, answered the way you'd say them out loud. Nothing is created until you've seen it all and
              said go.
            </p>
            <label>
              <span class="q">What should I call you?</span>
              <input v-model="draft.yourName" data-focus :maxlength="MAX_NAME_LENGTH" autocomplete="name" placeholder="Your name" />
            </label>
            <label>
              <span class="q">What's your job title?</span>
              <input v-model="draft.yourJobTitle" :maxlength="MAX_JOB_TITLE_LENGTH" autocomplete="organization-title" placeholder="Managing Director" />
              <span class="hint">Optional. It helps the coach know how to talk to you.</span>
            </label>
            <label v-if="needsAgencyName">
              <span class="q">And your agency?</span>
              <input v-model="draft.agencyName" :maxlength="MAX_NAME_LENGTH" autocomplete="organization" placeholder="Your agency" />
              <span class="hint">It names your team. You can have as many projects as you like under it.</span>
            </label>
            <p v-else class="hint">Setting this up for {{ team!.name }}.</p>
            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <div class="actions"><button type="submit">That's me</button></div>
          </form>

          <!-- 2. The win -->
          <form v-else-if="view === 'project'" key="project" class="ask" @submit.prevent="forward">
            <p class="eyebrow">The win</p>
            <h2>Nice to meet you, {{ firstName(draft.yourName) }}. What have you just won?</h2>
            <p class="lead">Name it however your team does. A codename is fine.</p>
            <label>
              <span class="q">Project name</span>
              <input v-model="draft.projectName" data-focus :maxlength="MAX_NAME_LENGTH" placeholder="Orchard Dash" />
            </label>
            <label>
              <span class="q">Who's it for?</span>
              <input v-model="draft.clientName" :maxlength="MAX_ORGANISATION_LENGTH" autocomplete="off" placeholder="The client's company" />
              <span class="hint">You can skip this. It just helps me keep the two sides straight.</span>
            </label>
            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <div class="actions">
              <button type="button" class="quiet" @click="back">Back</button>
              <button type="submit">Next</button>
            </div>
          </form>

          <!-- 3. The teams -->
          <div v-else-if="view === 'people'" key="people" class="ask">
            <p class="eyebrow">The teams</p>
            <h2>Who's on each side?</h2>
            <p class="lead">
              You'll create a profile for everyone, then send each person their own link at the end. Start with the two
              people the coach needs to hear from first, then add the rest of the team on either side.
            </p>
            <TeamEditor :draft="draft" :agency-name="agencyName" />
            <p v-if="lonely" class="nudge">
              Nobody on the {{ draft.clientName.trim() || 'client' }} side yet. I find the most when I can hear from both
              sides, so add at least one if you can.
            </p>
            <div class="actions">
              <button type="button" class="quiet" @click="back">Back</button>
              <button type="button" @click="forward">{{ anyone ? 'Review' : 'Skip for now' }}</button>
            </div>
          </div>

          <!-- 4. Review -->
          <div v-else-if="view === 'review'" key="review" class="ask">
            <p class="eyebrow">Review</p>
            <h2 tabindex="-1" data-focus>Here's {{ draft.projectName.trim() }}. Shall I set it up?</h2>
            <p class="lead">
              Does that look right? Once you say go, I'll create the project and
              <template v-if="withLinks.length > 1">a personal link for each of the {{ withLinks.length }} people who get one.</template>
              <template v-else>your link to the coach.</template>
            </p>
            <ul class="added plain" aria-label="Who gets what">
              <li v-for="seat in plan" :key="seat.key">
                <span>
                  <strong>{{ seat.details.name }}<template v-if="seat.you"> (you)</template></strong>
                  <small>
                    {{ seat.details.jobTitle || roleName(seat.details.persona, seat.details.side) }}, {{ seat.details.organisation || seat.details.side }}{{ seat.details.notes ? ', with notes for the coach' : '' }}
                  </small>
                </span>
                <small class="nowrap">{{ seat.link ? 'Gets a link' : 'No link' }}</small>
              </li>
            </ul>
            <p class="hint">What people tell the coach is shared with both sides unless they ask for it to be kept private.</p>
            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <div class="actions">
              <button type="button" class="quiet" :disabled="phase === 'working' || started" @click="back">Back</button>
              <button type="button" :disabled="phase === 'working'" @click="setUp">
                {{ phase === 'working' ? 'Setting it up…' : error ? 'Try again' : "Set it up" }}
              </button>
            </div>
          </div>

          <!-- Done -->
          <div v-else key="done" class="ask">
            <p class="eyebrow">All set</p>
            <h2 tabindex="-1" data-focus>{{ draft.projectName.trim() }} is open.</h2>
            <p class="lead">
              Now send each person their own link, from you. We only keep a scrambled copy of each link, so this is the one
              and only showing. A link works like a password, so don't forward it.
            </p>
            <ul class="invites">
              <li v-for="seat in toSend" :key="seat.key">
                <p class="who">
                  <strong>{{ seat.you ? 'Your own link' : `For ${seat.details.name}` }}</strong>
                  <small>{{ roleName(seat.details.persona, seat.details.side) }}</small>
                </p>
                <p class="message">{{ invite(seat.key, seat.details.name, seat.you) }}</p>
                <div class="actions">
                  <button type="button" @click="copy(seat.key, seat.details.name, seat.you)">
                    {{ copiedKey === seat.key ? 'Copied' : 'Copy prompt' }}
                  </button>
                  <a class="share" :href="whatsappUrl(invite(seat.key, seat.details.name, seat.you))" target="_blank" rel="noopener">WhatsApp</a>
                </div>
              </li>
            </ul>
            <p v-if="copyFailed" class="error" role="alert">Your browser wouldn't copy it. Select the message and copy it by hand.</p>
            <div class="actions"><button type="button" @click="finish">Go to my project</button></div>
          </div>
        </Transition>
      </div>

      <OnboardingSketch
        class="sketch"
        :project-name="draft.projectName"
        :agency-name="agencyName"
        :client-name="draft.clientName"
        :seats="plan"
      />
    </div>
  </section>
</template>

<style scoped>
.flow {
  display: grid;
  gap: 1.25rem;
}

.topline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.25rem;
}

.switch {
  margin-left: auto;
}

.group {
  display: grid;
  gap: 0.85rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}

.group h3 {
  margin: 0;
  font-size: 1.2rem;
}

.progress {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 0.5rem 1.25rem;
  flex-wrap: wrap;
}

.progress li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted);
  font-size: 0.875rem;
}

.dot {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  border: 1px solid var(--line);
  font-size: 0.8125rem;
  font-weight: 600;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.progress .done .dot {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}

.progress .now {
  color: var(--ink);
  font-weight: 600;
}

.progress .now .dot {
  border-color: var(--accent);
  color: var(--lit);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 45%, transparent);
}

.layout {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 56rem) {
  .layout {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    align-items: start;
  }

  .sketch {
    position: sticky;
    top: 1.5rem;
  }
}

.card {
  background: linear-gradient(180deg, var(--raise), var(--card));
  border: 1px solid var(--line-2);
  border-radius: 1.25rem;
  padding: 1.5rem;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--lit) 3%, transparent) inset, 0 24px 48px -24px rgba(0, 0, 0, 0.7);
}

@media (min-width: 40rem) {
  .card {
    padding: 2rem;
  }
}

.ask {
  display: grid;
  gap: 1rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

h2 {
  margin: 0;
  font-family: var(--serif);
  font-size: 1.85rem;
  font-weight: 400;
  line-height: 1.2;
  text-wrap: balance;
}

h2:focus {
  outline: none;
}

.lead {
  margin: 0;
  color: var(--muted);
}

label,
fieldset {
  display: grid;
  gap: 0.35rem;
}

fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}

legend {
  padding: 0;
  margin-bottom: 0.35rem;
}

.q {
  font-weight: 600;
}

.hint {
  font-size: 0.875rem;
  margin: 0;
}

input[type='text'],
input:not([type]) {
  font-size: 1.125rem;
  padding: 0.75rem 0.9rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.actions button:last-child:not(:only-child) {
  margin-left: auto;
}

button.small {
  min-height: 2.25rem;
  padding: 0.25rem 0.6rem;
  font-size: 0.875rem;
}

.error {
  margin: 0;
}

.added {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.added li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
}

.nowrap {
  white-space: nowrap;
}

.added li span {
  display: grid;
  min-width: 0;
  overflow-wrap: anywhere;
}

.nudge {
  margin: 0;
  padding: 0.75rem;
  border-left: 4px solid var(--accent);
  background: var(--paper);
  border-radius: 0.25rem;
  font-size: 0.9375rem;
}

.invites {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}

.invites li {
  display: grid;
  gap: 0.5rem;
}

.who {
  margin: 0;
  display: grid;
}

.who small {
  color: var(--muted);
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

.step-enter-active,
.step-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.step-enter-from {
  opacity: 0;
  transform: translateY(0.75rem);
}

.step-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}

@media (prefers-reduced-motion: reduce) {
  .step-enter-active,
  .step-leave-active,
  .dot {
    transition: none;
  }
}
</style>
