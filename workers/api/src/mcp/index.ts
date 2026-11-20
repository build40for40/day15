import { coachTurn, openingBrief } from '../coach'
import type { HandleMcp } from '../contracts'
import { runLensRounds } from '../lenses'
import { createHandleMcp } from './server'

export const handleMcp: HandleMcp = createHandleMcp({ coachTurn, openingBrief, runLensRounds })
