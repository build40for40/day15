import { readFileSync } from 'node:fs'

import type { Env } from '../src/contracts'

const VARS = new URL('../.dev.vars', import.meta.url)

/** The key from the environment, else from workers/api/.dev.vars. Never printed. */
export function modelEnv(): Pick<Env, 'ANTHROPIC_API_KEY' | 'ANTHROPIC_WORKSPACE_ID'> {
  const fromFile: Record<string, string> = {}
  try {
    for (const line of readFileSync(VARS, 'utf8').split('\n')) {
      const match = line.match(/^\s*(ANTHROPIC_API_KEY|ANTHROPIC_WORKSPACE_ID)\s*=\s*(.*?)\s*$/)
      if (match) fromFile[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
    }
  } catch {}
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || fromFile.ANTHROPIC_API_KEY || undefined,
    ANTHROPIC_WORKSPACE_ID: process.env.ANTHROPIC_WORKSPACE_ID || fromFile.ANTHROPIC_WORKSPACE_ID || undefined,
  }
}
