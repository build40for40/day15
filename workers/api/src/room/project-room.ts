import { DurableObject } from 'cloudflare:workers'

import type { Env } from '../contracts'
import { runLensRounds } from '../lenses'
import { LensAlarm } from '../lenses/alarm'
import { recordFailedRound } from '../lenses/rounds'
import { RoomStore } from './store'

type Args<K extends keyof RoomStore> = RoomStore[K] extends (...args: infer A) => unknown ? A : never

/** One per project, named by the project id: the data room both sides and the five lenses share. */
export class ProjectRoom extends DurableObject<Env> {
  private readonly store: RoomStore
  private readonly lenses: LensAlarm

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.store = new RoomStore(ctx.storage.sql, (run) => ctx.storage.transactionSync(run))
    this.lenses = new LensAlarm({
      run: () => runLensRounds(env, this.store),
      setAlarm: () => ctx.storage.setAlarm(Date.now()),
      giveUp: () => recordFailedRound(this.store),
    })
  }

  /** Has the alarm run the lenses soon, and returns at once. False when there is no project here. */
  async scheduleLensRounds(): Promise<boolean> {
    if (!(await this.store.project())) return false
    await this.lenses.request()
    return true
  }

  async alarm(info?: AlarmInvocationInfo) {
    await this.lenses.alarm(info)
  }

  create(...args: Args<'create'>) {
    return this.store.create(...args)
  }
  project() {
    return this.store.project()
  }
  addParticipant(...args: Args<'addParticipant'>) {
    return this.store.addParticipant(...args)
  }
  addMentioned(...args: Args<'addMentioned'>) {
    return this.store.addMentioned(...args)
  }
  updateParticipant(...args: Args<'updateParticipant'>) {
    return this.store.updateParticipant(...args)
  }
  removeParticipant(...args: Args<'removeParticipant'>) {
    return this.store.removeParticipant(...args)
  }
  resetKey(...args: Args<'resetKey'>) {
    return this.store.resetKey(...args)
  }
  identify(...args: Args<'identify'>) {
    return this.store.identify(...args)
  }
  participants() {
    return this.store.participants()
  }
  addItem(...args: Args<'addItem'>) {
    return this.store.addItem(...args)
  }
  addFacts(...args: Args<'addFacts'>) {
    return this.store.addFacts(...args)
  }
  read() {
    return this.store.read()
  }
  assessment() {
    return this.store.assessment()
  }
  saveAssessment(...args: Args<'saveAssessment'>) {
    return this.store.saveAssessment(...args)
  }
  saveLensRun(...args: Args<'saveLensRun'>) {
    return this.store.saveLensRun(...args)
  }
  latestRuns() {
    return this.store.latestRuns()
  }
  addAsk(...args: Args<'addAsk'>) {
    return this.store.addAsk(...args)
  }
  asks(...args: Args<'asks'>) {
    return this.store.asks(...args)
  }
  closeAsk(...args: Args<'closeAsk'>) {
    return this.store.closeAsk(...args)
  }
  openQuestions() {
    return this.store.openQuestions()
  }
  setQuestionPriorities(...args: Args<'setQuestionPriorities'>) {
    return this.store.setQuestionPriorities(...args)
  }
  resolveQuestions(...args: Args<'resolveQuestions'>) {
    return this.store.resolveQuestions(...args)
  }
}
