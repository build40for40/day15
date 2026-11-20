// @vitest-environment node
import { appendFileSync } from 'node:fs'

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

      let reply: Awaited<ReturnType<typeof runCoachTurn>>
      let after: NonNullable<Awaited<ReturnType<typeof fixture.room.read>>>
      let judgement: Awaited<ReturnType<typeof judge>>
      try {
        reply = await runCoachTurn(generate, fixture.stub, speaker, testCase.message)
        after = (await fixture.room.read())!
        judgement = await judge(generate, { before, speaker, message: testCase.message, expect: testCase.expect, reply, after })
      } catch (error) {
        const name = error instanceof Error ? error.name : 'Unknown error'
        const scores = Object.fromEntries(CRITERIA.map((criterion) => [criterion, 'error'])) as Record<Criterion, string>
        results.push({ id: testCase.id, scores, failures: [`error: ${name}`] })
        throw new Error(`The model call failed: ${name}`)
      }

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
      const shown = `${reply.reply}\n${reply.ask?.ask ?? ''}`.toLowerCase()
      const leaked = (testCase.mustNotContain ?? []).filter((word) => shown.includes(word.toLowerCase()))
      if (leaked.length) {
        scores.no_leak = 'fail'
        failures.push(`no_leak: the reply contains ${leaked.map((word) => `"${word}"`).join(', ')}`)
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
    const mark = (value: string) => (value === 'pass' ? 'pass' : value === 'na' ? '-' : value === 'error' ? 'ERROR' : 'FAIL')
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

    const summary = process.env.GITHUB_STEP_SUMMARY
    if (!summary) return
    const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ')
    const markdown = [
      '## Coach evals',
      '',
      `| case | ${CRITERIA.join(' | ')} |`,
      `| --- | ${CRITERIA.map(() => '---').join(' | ')} |`,
      ...results.map((result) => `| ${result.id} | ${CRITERIA.map((name) => mark(result.scores[name])).join(' | ')} |`),
      '',
      `**${results.length - failed.length}/${CASES.length} cases passed**`,
      ...(failed.length ? ['', '### Why', '', ...failed.flatMap((result) => result.failures.map((failure) => `- **${result.id}:** ${cell(failure)}`))] : []),
      '',
    ]
    appendFileSync(summary, markdown.join('\n'))
  })
})
