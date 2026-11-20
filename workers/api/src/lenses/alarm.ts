import { logModelError } from '../model'

/** The runtime retries an alarm whose handler never finished. Past this many retries the set is given up on. */
export const MAX_ALARM_RETRIES = 1

export interface LensAlarmDeps {
  /** One set of lens rounds on the room as it is now. */
  run: () => Promise<void>
  /** Sets the room's one alarm to fire now. */
  setAlarm: () => Promise<void>
  /** Records a set that will not be tried again. */
  giveUp: () => Promise<void>
}

/**
 * Runs lens rounds from the ProjectRoom's alarm, one set at a time. A request while a set is running makes exactly
 * one more set run after it, on the newer room. A set that fails is logged, not thrown, so the runtime never
 * retries it.
 */
export class LensAlarm {
  private running = false
  private again = false

  constructor(private readonly deps: LensAlarmDeps) {}

  async request(): Promise<void> {
    if (this.running) this.again = true
    else await this.deps.setAlarm()
  }

  async alarm(info?: Pick<AlarmInvocationInfo, 'retryCount'>): Promise<void> {
    if (this.running) {
      this.again = true
      return
    }
    this.running = true
    try {
      if (info && info.retryCount > MAX_ALARM_RETRIES) await this.deps.giveUp()
      else await this.deps.run()
    } catch (error) {
      logModelError('Lens rounds', error)
    }
    this.running = false
    if (!this.again) return
    this.again = false
    await this.deps.setAlarm()
  }
}
