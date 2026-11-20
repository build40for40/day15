#!/usr/bin/env node
// Turns the answers from the /onboarding interview into a link that opens A-Line's setup page, prefilled.
// Usage: node setup-link.mjs < answers.json   (the shape is in SKILL.md)
// The answers go in the URL fragment, so they are never sent to a server. The page reads them after sign-in.

import { readFileSync } from 'node:fs'

const BASE = (process.env.A_LINE_URL ?? 'https://a-line.build40for40.com').replace(/\/+$/, '')

let answers
try {
  answers = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  console.error('Expected the answers as JSON on stdin.')
  process.exit(1)
}

const named = (person) => typeof person?.name === 'string' && person.name.trim() !== ''
const missing = []
if (!named(answers.you)) missing.push('you.name')
if (!answers.project?.trim?.()) missing.push('project')
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`)
  process.exit(1)
}

const payload = { v: 1, ...answers }
console.log(`${BASE}/#setup=${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`)
