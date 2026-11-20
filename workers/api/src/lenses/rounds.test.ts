// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LENS_IDS, type LensId } from '@day15/shared/lenses'
import type { LensReport } from '@day15/shared/schema'
import { MAX_LENS_ROUNDS, type Env } from '../contracts'
import { ModelUnavailableError } from '../model'
import { fixtureRoom } from '../testing'
import { lensRounds, type CallLens } from './rounds'

const env = {} as Env
const quiet: LensReport = { coverage: [], conflicts: [], questions: [], done: false }

async function setUp(callLens: CallLens) {
  const fixture = await fixtureRoom()
  const saved = vi.spyOn(fixture.room, 'saveLensRun')
  const rounds = () => saved.mock.calls.map(([run]) => [run.round, run.lens, run.status])
  return { ...fixture, saved, rounds, run: () => lensRounds(callLens)(env, fixture.stub) }
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

  it('writes proposed facts as lens facts, and only lenses that proposed one run again', async () => {
    const { run, rounds, room, facts } = await setUp(proposing(['cfo'], 'f1'))
    await run()
    expect(rounds()).toEqual([
      ...LENS_IDS.map((lens) => [1, lens, 'done']),
      [2, 'cfo', 'done'],
      [3, 'cfo', 'done'],
    ])
    const added = (await room.read())!.facts.filter((fact) => fact.id > facts.budgetGap!.id)
    expect(added).toHaveLength(3)
    expect(added.every((fact) => fact.authorKind === 'lens' && fact.lens === 'cfo' && fact.status === 'proposed')).toBe(true)
    expect(added[0]!.basedOn).toEqual([1])
  })

  it('records a failing lens as failed, logs only its error name, and carries on', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const callLens = vi.fn<CallLens>(async (_env, lens) => {
      if (lens === 'procurement') throw new TypeError('secret words people typed')
      return lens === 'cto' ? ({ nonsense: true } as unknown as LensReport) : quiet
    })
    const { run, rounds, room } = await setUp(callLens)
    await run()
    expect(rounds()).toEqual(LENS_IDS.map((lens) => [1, lens, lens === 'procurement' || lens === 'cto' ? 'failed' : 'done']))
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

  it('runs once more, not twice at once, when asked while rounds are running', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const callLens = vi.fn<CallLens>(async () => {
      await gate
      return quiet
    })
    const { stub, rounds } = await setUp(callLens)
    const first = lensRounds(callLens)(env, stub)
    await lensRounds(callLens)(env, stub)
    expect(rounds()).toEqual([])
    release()
    await first
    expect(rounds()).toHaveLength(LENS_IDS.length * 2)
  })
})
