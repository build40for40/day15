import { coachTurn } from '../coach'
import type { HandleTeamApi } from '../contracts'
import { createTeamApi } from './api'
import { signedInUser } from './auth'

export const handleTeamApi: HandleTeamApi = createTeamApi(signedInUser, { coachTurn })
