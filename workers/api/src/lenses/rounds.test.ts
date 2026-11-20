// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LENS_IDS, type LensId } from '@day15/shared/lenses'
import type { LensReport } from '@day15/shared/schema'
import { MAX_LENS_ROUNDS, type Env } from '../contracts'
import { ModelUnavailableError } from '../model'
import { fixtureRoom } from '../testing'
import { lensRounds, recordFailedRound, type CallLens, type LensRoundsOptions } from './rounds'

const env = {} as Env
const quiet: LensReport = { coverage: [], conflicts: [], questions: [], done: false }

async function setUp(callLens: CallLens, options?: LensRoundsOptions) {
  const fixture = await fixtureRoom()
  const saved = vi.spyOn(fixture.room, 'saveLensRun')
  const rounds = () => saved.mock.calls.map(([run]) => [run.round, run.lens, run.status])
  return { ...fixture, saved, rounds, run: () => lensRounds(callLens, options)(env, fixture.room) }
}

const proposing = (lenses: LensId[], basedOn: string) => {
  let count = 0
  return vi.fn<CallLens>(async (_env, lens) =>
    lenses.includes(lens)
      ? { ...quiet, proposed_facts: [{ topic: 'other', statement: `Estimate: thing ${++count}`, based_on: [basedOn] }] }
      : quiet,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('lensRounds', () => {
  it('runs all five lenses on one snapshot and stops when nobody proposes a fact', async () => {
    const callLens = vi.fn<CallLens>(async () => quiet)
    const { run, rounds, room } = await setUp(callLens)
    const before = (await room.read())!
    await run()
    expect(rounds()).toEqual(LENS_IDS.map((lens) => [1, lens, 'done']))
    for (const [, , prompt] of callLens.mock.calls) expect(prompt.room).toBe(callLens.mock.calls[0]![2].room)
    const after = (await room.read())!
    expect(after.latestRuns.agency?.watermark).toBe(before.watermark)
    expect(after.facts).toEqual(before.facts)
  })

  it(`stops after ${MAX_LENS_ROUNDS} rounds even while facts keep coming`, async () => {
    const { run, rounds } = await setUp(proposing([...LENS_IDS], 'f1'))
    await run()
    expect(rounds()).toHaveLength(LENS_IDS.length * MAX_LENS_ROUNDS)
    expect(rounds().at(-1)).toEqual([MAX_LENS_ROUNDS, 'procurement', 'done'])
  })

  it('writes proposed facts as lens facts, and all five lenses run again when one proposed a fact', async () => {
    const { run, rounds, room, facts } = await setUp(proposing(['procurement'], 'f1'))
    await run()
    expect(rounds()).toEqual([1, 2, 3].flatMap((round) => LENS_IDS.map((lens) => [round, lens, 'done'])))
    const added = (await room.read())!.facts.filter((fact) => fact.id > facts.budgetGap!.id)
    expect(added).toHaveLength(3)
    expect(added.every((fact) => fact.authorKind === 'lens' && fact.lens === 'procurement' && fact.status === 'proposed')).toBe(true)
    expect(added[0]!.basedOn).toEqual([1])
  })

  it('records a failing lens as failed, logs only its error name, and carries on', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const callLens = vi.fn<CallLens>(async (_env, lens) => {
      if (lens === 'procurement') throw new TypeError('secret words people typed')
      return lens === 'agency' ? ({ nonsense: true } as unknown as LensReport) : quiet
    })
    const { run, rounds, room } = await setUp(callLens)
    await run()
    expect(rounds()).toEqual(LENS_IDS.map((lens) => [1, lens, lens === 'procurement' || lens === 'agency' ? 'failed' : 'done']))
    expect((await room.read())!.latestRuns.client?.status).toBe('done')
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret words')
    expect(error).toHaveBeenCalledWith('The Procurement lens failed:', 'TypeError')
  })

  it('saves nothing and does not throw without an API key', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { run, saved } = await setUp(async () => {
      throw new ModelUnavailableError()
    })
    await expect(run()).resolves.toBeUndefined()
    expect(saved).not.toHaveBeenCalled()
  })

  it('aborts a lens that hangs past its timeout, records it as failed, and lets the rest of the round finish', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const callLens = vi.fn<CallLens>(async (_env, lens) => (lens === 'procurement' ? new Promise<LensReport>(() => {}) : quiet))
    const { run, rounds } = await setUp(callLens, { timeoutMs: 20 })
    await run()
    expect(rounds()).toHaveLength(LENS_IDS.length)
    expect(rounds()).toEqual(expect.arrayContaining(LENS_IDS.map((lens) => [1, lens, lens === 'procurement' ? 'failed' : 'done'])))
    expect(rounds().at(-1)).toEqual([1, 'procurement', 'failed'])
    expect(callLens.mock.calls.find(([, lens]) => lens === 'procurement')![3].aborted).toBe(true)
  })
})

describe('recordFailedRound', () => {
  it('saves a failed run for every lens on the room as it is now', async () => {
    const { room, saved, rounds } = await setUp(async () => quiet)
    await recordFailedRound(room)
    expect(rounds()).toEqual(LENS_IDS.map((lens) => [1, lens, 'failed']))
    expect(saved.mock.calls[0]![0].watermark).toBe((await room.read())!.watermark)
  })
})
