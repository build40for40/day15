// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest'

import { anthropicGenerate, runCoachTurn } from '../src/coach/index'
import { fixtureRoom } from '../src/testing'
import { CASES } from './cases'
import { modelEnv } from './env'
import { CRITERIA, judge, type Criterion } from './judge'

const generate = anthropicGenerate(modelEnv() as Parameters<typeof anthropicGenerate>[0])
const results: { id: string; scores: Record<Criterion, string>; failures: string[] }[] = []

describe('coach turn', () => {
  for (const testCase of CASES) {
    it(testCase.id, async () => {
      const fixture = await fixtureRoom()
      await testCase.setup?.(fixture)
      const speaker = fixture.people[testCase.speaker].participant
      const before = (await fixture.room.read())!

      const reply = await runCoachTurn(generate, fixture.stub, speaker, testCase.message)
      const after = (await fixture.room.read())!
      const judgement = await judge(generate, { before, speaker, message: testCase.message, expect: testCase.expect, reply, after })

      const failures: string[] = []
      const scores = {} as Record<Criterion, string>
      for (const name of CRITERIA) {
        scores[name] = judgement[name].verdict
        if (judgement[name].verdict === 'fail') failures.push(`${name}: ${judgement[name].reason}`)
      }
      const open = after.asks.filter((ask) => ask.addressedTo === speaker.id && ask.status === 'open').length
      if (open > 1) {
        scores.one_ask = 'fail'
        failures.push(`one_ask: ${open} open asks for the speaker`)
      }
      if (reply.noted.some((fact) => !fact.sourceQuote)) {
        scores.faithful = 'fail'
        failures.push('faithful: a fact has no quote')
      }
      results.push({ id: testCase.id, scores, failures })
      expect(failures).toEqual([])
    })
  }

  afterAll(() => {
    const mark = (value: string) => (value === 'pass' ? 'pass' : value === 'na' ? '-' : 'FAIL')
    const width = Math.max(...CASES.map((testCase) => testCase.id.length))
    const lines = [
      '',
      `${'case'.padEnd(width)}  ${CRITERIA.map((name) => name.padEnd(14)).join('')}`,
      ...results.map((result) => `${result.id.padEnd(width)}  ${CRITERIA.map((name) => mark(result.scores[name]).padEnd(14)).join('')}`),
    ]
    const failed = results.filter((result) => result.failures.length)
    for (const result of failed) lines.push('', `${result.id}:`, ...result.failures.map((failure) => `  ${failure}`))
    lines.push('', `${results.length - failed.length}/${CASES.length} cases passed`)
    console.log(lines.join('\n'))
  })
})
