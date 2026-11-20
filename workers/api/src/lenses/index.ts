import { generateText, Output } from 'ai'

import { lensReportSchema } from '@day15/shared/schema'
import type { RunLensRounds } from '../contracts'
import { anthropicModel, PROVIDER_OPTIONS } from '../model'
import { lensRounds, type CallLens } from './rounds'

const callModel: CallLens = async (env, _lens, prompt, signal) => {
  const { output } = await generateText({
    model: anthropicModel(env),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt.room, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } },
          { type: 'text', text: prompt.instructions },
        ],
      },
    ],
    output: Output.object({ schema: lensReportSchema, name: 'report' }),
    providerOptions: PROVIDER_OPTIONS,
    abortSignal: signal,
  })
  return output
}

export const runLensRounds: RunLensRounds = lensRounds(callModel)
