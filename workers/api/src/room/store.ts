import type { Assessment } from '@day15/shared/alignment'
import type { LensId } from '@day15/shared/lenses'
import type {
  Ask,
  AskStatus,
  CloseAsk,
  OpenQuestion,
  Fact,
  Item,
  LensRun,
  NewAsk,
  NewFact,
  NewLensRun,
  NewParticipant,
  Participant,
  ParticipantUpdate,
  Project,
  RoomSnapshot,
} from '@day15/shared/schema'
import { hashSecret, newSecret } from './keys'
import * as questions from './questions'
import * as room from './room'
import { hasSchema, migrate } from './schema'
import type { Sql } from './sql'

/**
 * Everything the ProjectRoom Durable Object does, over any SQLite. The Durable Object forwards each method here,
 * and tests use it with node:sqlite.
 */
export class RoomStore {
  private migrated: boolean

  constructor(
    private readonly sql: Sql,
    private readonly transaction: <T>(run: () => T) => T = (run) => run(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.migrated = hasSchema(sql)
    if (this.migrated) this.transaction(() => migrate(sql))
  }

  /** A room nobody created writes nothing, so guessing project ids leaves no storage behind. */
  private readProject() {
    return this.migrated ? room.readProject(this.sql) : null
  }

  private exists() {
    if (!this.readProject()) throw new room.RoomError('There is no project here.')
  }

  async create(input: { id: string; name: string; ownerId: string }): Promise<Project> {
    if (!this.migrated) this.transaction(() => migrate(this.sql))
    this.migrated = true
    return room.createProject(this.sql, input, this.now())
  }

  async project(): Promise<Project | null> {
    return this.readProject()
  }

  /**
   * The secret comes back once and is never stored: only its hash is. With `link: false` the person is added with
   * no way in, and the secret is null.
   */
  async addParticipant(
    input: NewParticipant,
    options: { link?: boolean } = {},
  ): Promise<{ participant: Participant; secret: string | null }> {
    this.exists()
    const secret = options.link === false ? null : newSecret()
    const keyHash = secret ? await hashSecret(secret) : null
    return { participant: room.addParticipant(this.sql, input, keyHash, this.now()), secret }
  }

  /** People the coach heard about, with no link. Anyone already listed by that name on that side is skipped. */
  async addMentioned(people: NewParticipant[]): Promise<Participant[]> {
    this.exists()
    return this.transaction(() => {
      const added: Participant[] = []
      for (const person of people) {
        if (room.findParticipantByName(this.sql, person.name, person.side)) continue
        added.push(room.addParticipant(this.sql, person, null, this.now(), 'coach'))
      }
      return added
    })
  }

  async updateParticipant(participantId: number, input: ParticipantUpdate): Promise<Participant | null> {
    this.exists()
    return room.updateParticipant(this.sql, participantId, input)
  }

  async removeParticipant(participantId: number): Promise<Participant | null> {
    this.exists()
    return this.transaction(() => room.removeParticipant(this.sql, participantId, this.now()))
  }

  /** Gives a person a new secret, so their old address stops working. Gives a link to someone who had none. */
  async resetKey(participantId: number): Promise<{ participant: Participant; secret: string } | null> {
    this.exists()
    const secret = newSecret()
    const participant = room.replaceKeyHash(this.sql, participantId, await hashSecret(secret))
    return participant ? { participant, secret } : null
  }

  async identify(secret: string): Promise<Participant | null> {
    if (!this.readProject()) return null
    return room.findParticipantByKeyHash(this.sql, await hashSecret(secret))
  }

  async participants(): Promise<Participant[]> {
    return room.listParticipants(this.sql)
  }

  async addItem(participantId: number, text: string): Promise<Item> {
    this.exists()
    return room.addItem(this.sql, participantId, text, this.now())
  }

  /** All or nothing: one bad fact and none of the batch is kept. */
  async addFacts(facts: NewFact[]): Promise<Fact[]> {
    this.exists()
    return this.transaction(() => room.addFacts(this.sql, facts, this.now()))
  }

  async read(): Promise<RoomSnapshot | null> {
    return this.migrated ? room.readRoom(this.sql) : null
  }

  /** The mother agent's internal view. Only the coach reads it: it is not part of `read()`. */
  async assessment(): Promise<Assessment | null> {
    return this.migrated ? room.readAssessment(this.sql) : null
  }

  async saveAssessment(assessment: Assessment): Promise<void> {
    this.exists()
    room.writeAssessment(this.sql, assessment)
  }

  async saveLensRun(run: NewLensRun): Promise<LensRun> {
    this.exists()
    return this.transaction(() => room.saveLensRun(this.sql, run, this.now()))
  }

  async latestRuns(): Promise<Partial<Record<LensId, LensRun>>> {
    return room.latestRuns(this.sql)
  }

  async addAsk(ask: NewAsk): Promise<Ask> {
    this.exists()
    return room.addAsk(this.sql, ask, this.now())
  }

  async asks(filter: { addressedTo?: number; status?: AskStatus } = {}): Promise<Ask[]> {
    return room.listAsks(this.sql, filter)
  }

  async closeAsk(askId: number, close: CloseAsk): Promise<Ask | null> {
    return room.closeAsk(this.sql, askId, close, this.now())
  }

  async openQuestions(): Promise<OpenQuestion[]> {
    return this.migrated ? questions.listOpenQuestions(this.sql) : []
  }

  async setQuestionPriorities(changes: { id: number; priority: number }[]): Promise<OpenQuestion[]> {
    this.exists()
    return this.transaction(() => questions.setQuestionPriorities(this.sql, changes, this.now()))
  }

  async resolveQuestions(ids: number[], itemId: number): Promise<OpenQuestion[]> {
    this.exists()
    return this.transaction(() => questions.resolveQuestions(this.sql, ids, itemId, this.now()))
  }
}
