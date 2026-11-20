import type { HandleTeamApi } from '../contracts'

export const handleTeamApi: HandleTeamApi = async () =>
  Response.json({ error: 'The team API is not built yet.' }, { status: 501 })
