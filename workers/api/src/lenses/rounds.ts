import { LENS_IDS, LENS_NAMES, type LensId } from '@day15/shared/lenses'
import { lensReportSchema, type LensReport, type RoomSnapshot } from '@day15/shared/schema'
import { MAX_LENS_ROUNDS, type Env, type RoomStub, type RunLensRounds } from '../contracts'
import { logModelError, ModelUnavailableError } from '../model'
import { renderRoom } from '../room/render'
import { lensPrompt, type LensPrompt } from './prompt'
import { toLensFacts } from './proposals'

/** One lens reading one snapshot. Injected so tests never reach the model. */
export type CallLens = (env: Env, lens: LensId, prompt: LensPrompt) => Promise<LensReport>

async function saveProposals(room: RoomStub, lensRunId: number, report: LensReport, snapshot: RoomSnapshot) {
  let added = 0
  for (const fact of toLensFacts(report.proposed_facts ?? [], lensRunId, snapshot)) {
    try {
      await room.addFacts([fact])
      added++
    } catch (error) {
      logModelError('Saving a lens fact', error)
    }
  }
  return added
}

/** Runs the given lenses on one snapshot and returns the ones that added a fact. */
async function runRound(
  env: Env,
  room: RoomStub,
  callLens: CallLens,
  snapshot: RoomSnapshot,
  lenses: readonly LensId[],
  round: number,
): Promise<LensId[]> {
  const roomText = renderRoom(snapshot)
  const results = await Promise.allSettled(lenses.map((lens) => callLens(env, lens, lensPrompt(lens, snapshot, roomText))))
  if (results.some((result) => result.status === 'rejected' && result.reason instanceof ModelUnavailableError)) {
    throw new ModelUnavailableError()
  }

  const proposing: LensId[] = []
  for (const [index, lens] of lenses.entries()) {
    const result = results[index]!
    const parsed = result.status === 'fulfilled' ? lensReportSchema.safeParse(result.value) : null
    const report = parsed?.success ? parsed.data : null
    if (!report) logModelError(`The ${LENS_NAMES[lens]} lens`, result.status === 'rejected' ? result.reason : parsed?.error)

    const run = await room.saveLensRun({ lens, round, watermark: snapshot.watermark, report, status: report ? 'done' : 'failed' })
    if (report && (await saveProposals(room, run.id, report, snapshot)) > 0) proposing.push(lens)
  }
  return proposing
}

async function runRounds(env: Env, room: RoomStub, callLens: CallLens) {
  let lenses: readonly LensId[] = LENS_IDS
  for (let round = 1; round <= MAX_LENS_ROUNDS && lenses.length; round++) {
    const snapshot = await room.read()
    if (!snapshot) return
    lenses = await runRound(env, room, callLens, snapshot, lenses, round)
  }
}

/** Builds runLensRounds around a model call. One set of rounds runs per room at a time, and a call meanwhile queues one more. */
export function lensRounds(callLens: CallLens): RunLensRounds {
  return async (env, room) => {
    try {
      const lease = await room.claimLensRounds()
      if (!lease) return
      let again: boolean
      do {
        try {
          await runRounds(env, room, callLens)
        } catch (error) {
          logModelError('Lens rounds', error)
        }
        again = await room.releaseLensRounds(lease)
      } while (again)
    } catch (error) {
      logModelError('Lens rounds', error)
    }
  }
}
