import { parseRef } from '@day15/shared/refs'
import { MAX_STATEMENT_LENGTH, type NewLensFact, type ProposedFact, type RoomSnapshot } from '@day15/shared/schema'

export const MAX_PROPOSED_FACTS = 3

const normalise = (statement: string) => statement.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Turns what a lens proposed into facts the room will take. Drops any that cite no fact in the room, repeat a
 * fact that still holds, or try to replace something other than a standing lens fact.
 */
export function toLensFacts(proposed: ProposedFact[], lensRunId: number, room: RoomSnapshot): NewLensFact[] {
  const facts = new Map(room.facts.map((fact) => [fact.id, fact]))
  const standing = new Set(room.facts.filter((fact) => fact.status !== 'superseded').map((fact) => normalise(fact.statement)))
  const replaced = new Set<number>()

  return proposed.slice(0, MAX_PROPOSED_FACTS).flatMap((proposal) => {
    const statement = proposal.statement.trim().slice(0, MAX_STATEMENT_LENGTH)
    const basedOn = [...new Set(proposal.based_on.map((value) => parseRef('fact', value)))].filter(
      (id): id is number => id !== null && facts.has(id),
    )
    if (!statement || !basedOn.length || standing.has(normalise(statement))) return []

    let supersedes: number | null = null
    if (proposal.supersedes) {
      supersedes = parseRef('fact', proposal.supersedes)
      const old = supersedes === null ? undefined : facts.get(supersedes)
      if (!old || old.authorKind !== 'lens' || old.status === 'superseded' || replaced.has(old.id)) return []
      replaced.add(old.id)
    }

    standing.add(normalise(statement))
    return [{ authorKind: 'lens' as const, lensRunId, basedOn, topic: proposal.topic, statement, supersedes }]
  })
}
