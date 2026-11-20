// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LensAlarm, MAX_ALARM_RETRIES } from './alarm'

function setUp() {
  const sets: (() => void)[] = []
  const deps = {
    run: vi.fn(() => new Promise<void>((resolve) => sets.push(resolve))),
    setAlarm: vi.fn(async () => {}),
    giveUp: vi.fn(async () => {}),
  }
  const finishSet = () => sets.shift()!()
  return { alarm: new LensAlarm(deps), deps, finishSet }
}

afterEach(() => vi.restoreAllMocks())

describe('LensAlarm', () => {
  it('sets the alarm when asked and runs one set when it fires', async () => {
    const { alarm, deps, finishSet } = setUp()
    await alarm.request()
    expect(deps.setAlarm).toHaveBeenCalledOnce()
    const fired = alarm.alarm({ retryCount: 0 })
    expect(deps.run).toHaveBeenCalledOnce()
    finishSet()
    await fired
    expect(deps.setAlarm).toHaveBeenCalledOnce()
  })

  it('runs exactly one more set after the running one, however many times it is asked meanwhile', async () => {
    const { alarm, deps, finishSet } = setUp()
    const fired = alarm.alarm()
    await alarm.request()
    await alarm.request()
    expect(deps.setAlarm).not.toHaveBeenCalled()
    finishSet()
    await fired
    expect(deps.setAlarm).toHaveBeenCalledOnce()

    const again = alarm.alarm()
    finishSet()
    await again
    expect(deps.run).toHaveBeenCalledTimes(2)
    expect(deps.setAlarm).toHaveBeenCalledOnce()
  })

  it('never runs two sets at once: an alarm that fires mid-set leaves its set for after this one', async () => {
    const { alarm, deps, finishSet } = setUp()
    const first = alarm.alarm()
    await alarm.alarm()
    expect(deps.run).toHaveBeenCalledOnce()
    finishSet()
    await first
    expect(deps.setAlarm).toHaveBeenCalledOnce()
  })

  it('logs a set that throws without rethrowing, and gives up on a set the runtime keeps retrying', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { alarm, deps } = setUp()
    deps.run.mockRejectedValueOnce(new TypeError('what people typed'))
    await expect(alarm.alarm({ retryCount: 0 })).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('Lens rounds failed:', 'TypeError')

    await alarm.alarm({ retryCount: MAX_ALARM_RETRIES + 1 })
    expect(deps.giveUp).toHaveBeenCalledOnce()
    expect(deps.run).toHaveBeenCalledOnce()
  })
})
