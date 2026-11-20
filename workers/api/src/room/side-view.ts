import type { Fact, OpenQuestion, Participant, Project, RoomSnapshot, Side } from '@day15/shared/schema'

/** An open question as one side sees it. When `withheld`, its wording rests on the other side's private words. */
export type SideQuestion = OpenQuestion & { withheld: boolean }

/** Everything one side may see of a room. Every MCP tool reads the room through this and nothing else. */
export interface SideView {
  project: Project
  side: Side
  participants: Participant[]
  /** Every fact except the other side's private ones and lens facts that rest on them. */
  facts: Fact[]
  /** Every open question, most urgent first, with the wording withheld where it rests on the other side's privacy. */
  openQuestions: SideQuestion[]
  /** The newest fact this side can see that every lens has read, or 0 when none has. */
  checkedUpTo: number
}

/** The one rule for who sees a person's fact: everyone, unless it is private and the viewer is on the other side. */
export const canSee = (fact: Pick<Fact, 'private' | 'side'>, viewer: Side) => !fact.private || fact.side === viewer

/** The facts a viewer can't see: the other side's private facts, and every lens fact that rests on one. */
function hiddenFacts(facts: Fact[], viewer: Side): Set<number> {
  const byId = new Map(facts.map((fact) => [fact.id, fact]))
  const memo = new Map<number, boolean>()
  const hidden = (id: number): boolean => {
    const known = memo.get(id)
    if (known !== undefined) return known
    memo.set(id, false)
    const fact = byId.get(id)
    const result = !fact
      ? false
      : fact.authorKind === 'person'
        ? !canSee(fact, viewer)
        : fact.basedOn.some(hidden)
    memo.set(id, result)
    return result
  }
  return new Set(facts.filter((fact) => hidden(fact.id)).map((fact) => fact.id))
}

const WITHHELD = { topic: '', statement: '', because: '', agencySaid: null, clientSaid: null }

/**
 * One side's view of the room. The coach and the lenses read the full snapshot. A person sees everything except
 * the other side's private facts (with their quotes), lens facts resting on them, and the wording of any open
 * question resting on them. A question a lens flagged as resting on private material is withheld whenever the other
 * side has a private fact, since the lens may not cite it.
 */
export function sideView(room: RoomSnapshot, side: Side): SideView {
  const hidden = hiddenFacts(room.facts, side)
  const facts = room.facts.filter((fact) => !hidden.has(fact.id))
  const otherSideIsPrivate = room.facts.some(
    (fact) => fact.authorKind === 'person' && fact.status !== 'superseded' && !canSee(fact, side),
  )
  const openQuestions = room.openQuestions.map((question) => {
    const withheld = question.basedOn.some((id) => hidden.has(id)) || (question.restsOnPrivate && otherSideIsPrivate)
    return withheld ? { ...question, ...WITHHELD, withheld } : { ...question, withheld }
  })

  const watermarks = Object.values(room.latestRuns).map((run) => run?.watermark ?? 0)
  const read = watermarks.length ? Math.min(...watermarks) : 0
  const checkedUpTo = facts.filter((fact) => fact.id <= read).at(-1)?.id ?? 0

  return { project: room.project, side, participants: room.participants, facts, openQuestions, checkedUpTo }
}
