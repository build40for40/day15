import { LENS_IDS, LENS_NAMES, type LensId } from '@day15/shared/lenses'
import { lensReportSchema, type LensReport, type RoomSnapshot } from '@day15/shared/schema'
import { MAX_LENS_ROUNDS, type Env, type LensRoom, type RunLensRounds } from '../contracts'
import { logModelError, ModelUnavailableError } from '../model'
import { renderRoom } from '../room/render'
import { lensPrompt, type LensPrompt } from './prompt'
import { toLensFacts } from './proposals'

/** How long one lens call may take before it is aborted and saved as failed. */
export const LENS_CALL_TIMEOUT_MS = 90_000

/** One lens reading one snapshot. Injected so tests never reach the model. */
export type CallLens = (env: Env, lens: LensId, prompt: LensPrompt, signal: AbortSignal) => Promise<LensReport>

export interface LensRoundsOptions {
  timeoutMs?: number
}

/** Settles when the signal aborts, even if the call it guards never listens to it. */
const aborted = (signal: AbortSignal) =>
  new Promise<never>((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))

async function saveProposals(room: LensRoom, lensRunId: number, report: LensReport, snapshot: RoomSnapshot) {
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

async function runLens(
  env: Env,
  room: LensRoom,
  callLens: CallLens,
  snapshot: RoomSnapshot,
  roomText: string,
  lens: LensId,
  round: number,
  timeoutMs: number,
): Promise<boolean> {
  let report: LensReport | null = null
  try {
    const signal = AbortSignal.timeout(timeoutMs)
    const answer = await Promise.race([callLens(env, lens, lensPrompt(lens, snapshot, roomText), signal), aborted(signal)])
    const parsed = lensReportSchema.safeParse(answer)
    if (parsed.success) report = parsed.data
    else logModelError(`The ${LENS_NAMES[lens]} lens`, parsed.error)
  } catch (error) {
    if (error instanceof ModelUnavailableError) throw error
    logModelError(`The ${LENS_NAMES[lens]} lens`, error)
  }
  const run = await room.saveLensRun({ lens, round, watermark: snapshot.watermark, report, status: report ? 'done' : 'failed' })
  return report ? (await saveProposals(room, run.id, report, snapshot)) > 0 : false
}

/** All five lenses on one snapshot, each saved as soon as it answers. True when any of them added a fact. */
async function runRound(
  env: Env,
  room: LensRoom,
  callLens: CallLens,
  snapshot: RoomSnapshot,
  round: number,
  timeoutMs: number,
): Promise<boolean> {
  const roomText = renderRoom(snapshot)
  const results = await Promise.allSettled(
    LENS_IDS.map((lens) => runLens(env, room, callLens, snapshot, roomText, lens, round, timeoutMs)),
  )
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
  return results.some((result) => result.status === 'fulfilled' && result.value)
}

/** Builds runLensRounds around a model call. */
export function lensRounds(callLens: CallLens, { timeoutMs = LENS_CALL_TIMEOUT_MS }: LensRoundsOptions = {}): RunLensRounds {
  return async (env, room) => {
    try {
      for (let round = 1; round <= MAX_LENS_ROUNDS; round++) {
        const snapshot = await room.read()
        if (!snapshot) return
        if (!(await runRound(env, room, callLens, snapshot, round, timeoutMs))) return
      }
    } catch (error) {
      logModelError('Lens rounds', error)
    }
  }
}

/** Saves a failed run for every lens on the room as it is now, for a set of rounds that is given up on. */
export async function recordFailedRound(room: LensRoom): Promise<void> {
  try {
    const snapshot = await room.read()
    if (!snapshot) return
    for (const lens of LENS_IDS) {
      await room.saveLensRun({ lens, round: 1, watermark: snapshot.watermark, report: null, status: 'failed' })
    }
  } catch (error) {
    logModelError('Recording failed lens runs', error)
  }
}
