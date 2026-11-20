import { DurableObject } from 'cloudflare:workers'

import type { Env } from '../contracts'
import { DirectoryStore } from './store'

type Args<K extends keyof DirectoryStore> = DirectoryStore[K] extends (...args: infer A) => unknown ? A : never

/** One per agency owner, named by their WorkOS user id: their team and its projects. */
export class TeamDirectory extends DurableObject<Env> {
  private readonly store: DirectoryStore

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.store = new DirectoryStore(ctx.storage.sql)
  }

  team() {
    return this.store.team()
  }
  createTeam(...args: Args<'createTeam'>) {
    return this.store.createTeam(...args)
  }
  addProject(...args: Args<'addProject'>) {
    return this.store.addProject(...args)
  }
  projects() {
    return this.store.projects()
  }
  hasProject(...args: Args<'hasProject'>) {
    return this.store.hasProject(...args)
  }
}
