import { DurableObject } from 'cloudflare:workers'

import type { Env } from '../contracts'
import { RoomStore } from './store'

type Args<K extends keyof RoomStore> = RoomStore[K] extends (...args: infer A) => unknown ? A : never

/** One per project, named by the project id: the data room both sides and the five lenses share. */
export class ProjectRoom extends DurableObject<Env> {
  private readonly store: RoomStore

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.store = new RoomStore(ctx.storage.sql, (run) => ctx.storage.transactionSync(run))
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
  claimLensRounds() {
    return this.store.claimLensRounds()
  }
  releaseLensRounds(...args: Args<'releaseLensRounds'>) {
    return this.store.releaseLensRounds(...args)
  }
}
