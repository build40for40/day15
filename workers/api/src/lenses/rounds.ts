import { LENS_IDS, LENS_NAMES, type LensId } from '@day15/shared/lenses'
import { lensReportSchema, type LensReport, type RoomSnapshot } from '@day15/shared/schema'
import { LENS_ROUNDS_BUDGET_MS, MAX_LENS_ROUNDS, type Env, type RoomStub, type RunLensRounds } from '../contracts'
import { logModelError, ModelUnavailableError } from '../model'
import { renderRoom } from '../room/render'
import { lensPrompt, type LensPrompt } from './prompt'
import { toLensFacts } from './proposals'

const MIN_ROUND_MS = 8_000

/** One lens reading one snapshot. Injected so tests never reach the model. */
export type CallLens = (env: Env, lens: LensId, prompt: LensPrompt, signal: AbortSignal) => Promise<LensReport>

export interface LensRoundsOptions {
  /** How long a set of rounds may take, inside the time `ctx.waitUntil` gives after the response. */
  budgetMs?: number
  /** A round only starts with at least this much of the budget left. */
  minRoundMs?: number
  now?: () => number
}

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

async function runLens(
  env: Env,
  room: RoomStub,
  callLens: CallLens,
  snapshot: RoomSnapshot,
  roomText: string,
  lens: LensId,
  round: number,
  signal: AbortSignal,
): Promise<boolean> {
  let report: LensReport | null = null
  try {
    const parsed = lensReportSchema.safeParse(await callLens(env, lens, lensPrompt(lens, snapshot, roomText), signal))
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
  room: RoomStub,
  callLens: CallLens,
  snapshot: RoomSnapshot,
  round: number,
  signal: AbortSignal,
): Promise<boolean> {
  const roomText = renderRoom(snapshot)
  const results = await Promise.allSettled(
    LENS_IDS.map((lens) => runLens(env, room, callLens, snapshot, roomText, lens, round, signal)),
  )
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
  return results.some((result) => result.status === 'fulfilled' && result.value)
}

async function runRounds(env: Env, room: RoomStub, callLens: CallLens, timeLeft: () => number, minRoundMs: number) {
  for (let round = 1; round <= MAX_LENS_ROUNDS && timeLeft() >= minRoundMs; round++) {
    const snapshot = await room.read()
    if (!snapshot) return
    if (!(await runRound(env, room, callLens, snapshot, round, AbortSignal.timeout(Math.max(timeLeft(), 0))))) return
  }
}

/**
 * Builds runLensRounds around a model call. One set of rounds runs per room at a time, and a call meanwhile queues
 * one more. Everything stops inside the budget and the lease is always released, so the runtime cutting off
 * `ctx.waitUntil` never leaves the room locked.
 */
export function lensRounds(
  callLens: CallLens,
  { budgetMs = LENS_ROUNDS_BUDGET_MS, minRoundMs = MIN_ROUND_MS, now = Date.now }: LensRoundsOptions = {},
): RunLensRounds {
  return async (env, room) => {
    const deadline = now() + budgetMs
    const timeLeft = () => deadline - now()
    try {
      const lease = await room.claimLensRounds()
      if (!lease) return
      let again: boolean
      do {
        try {
          await runRounds(env, room, callLens, timeLeft, minRoundMs)
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
