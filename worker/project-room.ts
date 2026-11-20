import { DurableObject } from 'cloudflare:workers'

import type { Party, Turn } from '../src/coach/schema'
import { emptyRoom, record, type Room } from './room'

/** One per project. Holds what both sides have told the coach. */
export class ProjectRoom extends DurableObject {
  async create(): Promise<void> {
    if (!(await this.ctx.storage.get('room'))) await this.ctx.storage.put('room', emptyRoom())
  }

  /** The room, or null if nobody created this project. */
  async read(): Promise<Room | null> {
    return (await this.ctx.storage.get<Room>('room')) ?? null
  }

  async record(party: Party, project: string, turn?: Turn): Promise<Room | null> {
    const room = await this.read()
    if (!room) return null
    const next = record(room, party, project, turn)
    await this.ctx.storage.put('room', next)
    return next
  }
}
